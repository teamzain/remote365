package ai.remote365.host.rtc

import ai.remote365.callaudio.AudioProtocol as Wire
import ai.remote365.host.provisioning.selfpair.LibAdbTransport
import android.content.Context
import android.os.*
import java.io.DataInputStream
import java.security.SecureRandom
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlin.concurrent.thread

/** ADB bootstraps only. Capture uses an authenticated Binder and a framed local pipe. */
class CallDaemonClient(private val context: Context) {
    private data class Capture(val binder: IBinder, val id: Long, val fd: ParcelFileDescriptor,
        val ended: (String) -> Unit)
    private val active = AtomicReference<Capture?>(null)
    private var renewal: java.util.concurrent.ScheduledFuture<*>? = null
    private val scheduler = Executors.newSingleThreadScheduledExecutor { r -> Thread(r, "AudioLease").apply { isDaemon = true } }
    private val credential get() = secret(context)
    val isReady: Boolean get() = binder?.isBinderAlive == true

    suspend fun launchDaemon(): String = activation.withLock { withContext(Dispatchers.IO) {
        if (isReady) return@withContext "Helper ready; call support still requires a test"
        status.value = "Activating audio helper…"
        val t = LibAdbTransport(context)
        try {
            val endpoint = activationEndpoint(context)
            if (endpoint.isEmpty()) t.connect(context, 15_000)
            else {
                val host = endpoint.substringBefore(':')
                val local = ai.remote365.host.provisioning.selfpair.LocalNetwork.wifiIpv4()
                check(host == "127.0.0.1" || host == local) { "Debugging address must belong to this phone" }
                t.connectAt(host, endpoint.substringAfter(':').toInt())
            }
            val uid = context.applicationInfo.uid
            val dex = "/data/local/tmp/remote365-audio-v2-$uid.dex"
            val keyPath = "/data/local/tmp/remote365-audio-${randomHex()}.key"
            t.pushFile(dex, context.assets.open("callaudio.dex").use { it.readBytes() })
            t.pushFile(keyPath, credential.toByteArray(Charsets.US_ASCII), privateFile = true)
            // Neither the secret nor PCM travels in command arguments. No ongoing ADB transport.
            val command = "CLASSPATH=$dex nohup setsid app_process /data/local/tmp " +
                "ai.remote365.callaudio.CallAudioDaemon ${context.packageName} $uid $keyPath " +
                "</dev/null >/dev/null 2>&1 &"
            // Keep the launching shell alive briefly so nohup/setsid can detach before ADB
            // tears down that shell. Readiness still requires the authenticated handoff.
            t.exec(command + " sleep 1")
            repeat(40) {
                if (isReady) return@withContext "Helper ready; test call audio with debugging off"
                delay(250)
            }
            "No authenticated helper response; activation required"
        } catch (e: Exception) {
            "Activation failed: ${(e.message ?: e.javaClass.simpleName).take(160)}. Check debugging and pairing."
        } finally { t.close() }
    }.also { status.value = it } }

    suspend fun ping(): String = withContext(Dispatchers.IO) {
        val candidate = binder
        if (candidate != null && verify(candidate, credential))
            "Helper reachable. This does not verify audible call capture."
        else "Helper unavailable; activate again"
    }

    /** Call off the main thread. Fixed 48 kHz mono PCM16 is explicitly negotiated. */
    @Synchronized
    fun startCapture(source: Int, rate: Int, onEnded: (String) -> Unit = {},
                     onFrame: (ByteArray, Int) -> Unit): Boolean {
        stopCapture()
        val b = binder ?: return false
        val pipe = ParcelFileDescriptor.createPipe()
        val id = SecureRandom().nextLong()
        val session = Capture(b, id, pipe[0], onEnded)
        val ok = try {
            transaction(b, Wire.START, credential, id, {
                writeInt(source); writeInt(rate); pipe[1].writeToParcel(this, 0)
            }) { readInt() == 1 && readInt() == Wire.RATE && readInt() == Wire.CHANNELS }
        } catch (_: Exception) { false }
        finally { pipe[1].close() }
        if (!ok) { pipe[0].close(); status.value = "Call source unavailable"; return false }
        active.set(session)
        status.value = "Call source opened; waiting for audio frames"
        renewal = scheduler.scheduleAtFixedRate({
            if (active.get() === session) {
                val alive = runCatching {
                    transaction(b, Wire.RENEW, credential, id) { readInt() == 1 }
                }.getOrDefault(false)
                if (!alive) finish(session, "Audio helper stopped; activation or a new call test required")
            }
        }, 2, 2, TimeUnit.SECONDS)
        thread(name = "CallPcmReader", isDaemon = true) {
            try {
                DataInputStream(ParcelFileDescriptor.AutoCloseInputStream(pipe[0])).use { input ->
                    var sequence = 0L
                    var lastTimestamp = 0L
                    val frame = ByteArray(Wire.FRAME_BYTES)
                    while (active.get() === session) {
                        check(input.readLong() == sequence++) { "Out-of-order audio" }
                        val timestamp = input.readLong()
                        check(timestamp > lastTimestamp) { "Invalid audio clock" }
                        lastTimestamp = timestamp
                        check(input.readInt() == frame.size) { "Invalid audio format" }
                        input.readFully(frame)
                        if (active.get() !== session) break
                        // Bound old pipe data too, rather than replaying a backlog after a stall.
                        if (SystemClock.elapsedRealtimeNanos() - timestamp > 150_000_000L) continue
                        onFrame(frame, frame.size)
                        if (sequence == 1L) status.value = "Call audio frames arriving; confirm speech on desktop"
                    }
                }
            } catch (_: Exception) { /* EOF and recorder failures are terminal, not silent success. */ }
            finally { finish(session, "Call audio stream ended") }
        }
        return true
    }

    private fun finish(session: Capture, reason: String) {
        if (!active.compareAndSet(session, null)) return
        runCatching { session.fd.close() }
        status.value = reason
        session.ended(reason)
        // Capture lease is no longer renewed; the daemon also stops on pipe closure.
    }

    @Synchronized fun stopCapture() {
        renewal?.cancel(false); renewal = null
        val old = active.getAndSet(null) ?: return
        runCatching { old.fd.close() }
        runCatching { transaction(old.binder, Wire.STOP, credential, old.id) { Unit } }
        status.value = if (isReady) "Audio helper ready" else "Audio helper needs activation"
    }
    fun close() { stopCapture(); scheduler.shutdownNow() }

    companion object {
        @Volatile private var binder: IBinder? = null
        private val activation = Mutex()
        private val status = MutableStateFlow("Audio helper needs activation")
        val state = status.asStateFlow()
        fun activationEndpoint(context: Context): String = context
            .getSharedPreferences("call_audio_settings", Context.MODE_PRIVATE).getString("endpoint", "").orEmpty()
        fun setActivationEndpoint(context: Context, endpoint: String) {
            val value = endpoint.trim()
            if (value.isNotEmpty()) {
                val parts = value.split(':')
                require(parts.size == 2 && parts[1].toIntOrNull() in 1..65535) { "Enter IP address:port" }
                val octets = parts[0].split('.')
                require(octets.size == 4 && octets.all { it.toIntOrNull() in 0..255 }) { "Enter the phone's IPv4 address" }
            }
            context.getSharedPreferences("call_audio_settings", Context.MODE_PRIVATE)
                .edit().putString("endpoint", value).apply()
        }
        fun preferredSource(context: Context): Int = if (context
            .getSharedPreferences("call_audio_settings", Context.MODE_PRIVATE)
            .getBoolean("hear_both_sides", true)) 4 else 3
        fun setHearBothSides(context: Context, enabled: Boolean) {
            context.getSharedPreferences("call_audio_settings", Context.MODE_PRIVATE)
                .edit().putBoolean("hear_both_sides", enabled).apply()
        }
        private fun randomHex(): String = ByteArray(32).also { SecureRandom().nextBytes(it) }
            .joinToString("") { "%02x".format(it.toInt() and 255) }
        @Synchronized private fun secret(context: Context): String {
            val prefs = context.getSharedPreferences("call_audio_private", Context.MODE_PRIVATE)
            return prefs.getString("credential", null) ?: randomHex().also {
                check(prefs.edit().putString("credential", it).commit())
            }
        }
        private fun verify(b: IBinder, secret: String): Boolean = runCatching {
            val challenge = randomHex()
            val data = Parcel.obtain(); val reply = Parcel.obtain()
            try {
                data.writeInterfaceToken(Wire.DESCRIPTOR); data.writeString(challenge)
                check(b.transact(Wire.PING, data, reply, 0)); reply.readException()
                reply.readInt() == Wire.VERSION && Wire.equal(Wire.proof(secret, challenge), reply.readString())
            } finally { data.recycle(); reply.recycle() }
        }.getOrDefault(false)

        /** Receiver runs this on a worker; challenge proof is checked before trusting the Binder. */
        fun onBinderReceived(context: Context, candidate: IBinder) {
            if (binder?.isBinderAlive == true || !verify(candidate, secret(context))) return
            synchronized(this) {
                if (binder?.isBinderAlive == true) return
                binder = candidate
                try {
                    candidate.linkToDeath({
                        synchronized(this) {
                            if (binder === candidate) {
                                binder = null; status.value = "Audio helper stopped; activate again"
                            }
                        }
                    }, 0)
                    status.value = "Audio helper ready; call support unverified"
                } catch (_: Exception) { binder = null }
            }
        }
        private fun <T> transaction(b: IBinder, code: Int, key: String, id: Long,
            body: Parcel.() -> Unit = {}, result: Parcel.() -> T): T {
            val data = Parcel.obtain(); val reply = Parcel.obtain()
            try {
                data.writeInterfaceToken(Wire.DESCRIPTOR); data.writeString(key); data.writeLong(id)
                data.body(); check(b.transact(code, data, reply, 0)); reply.readException()
                return reply.result()
            } finally { data.recycle(); reply.recycle() }
        }
    }
}
