package ai.remote365.host.rtc

import ai.remote365.host.provisioning.selfpair.LibAdbTransport
import android.content.Context
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.InputStream
import kotlin.math.abs
import kotlin.math.log10
import kotlin.math.sqrt

/**
 * Bridges the shell-uid call-audio helper into the app.
 *
 * The phone's telephony audio (the far party on a call) can only be captured by a process that
 * holds CAPTURE_AUDIO_OUTPUT — which the app uid never can, but the ADB **shell** uid does. So the
 * app launches [ai.remote365.callaudio.CallAudioServer] (shipped as the `callaudio.dex` asset) as
 * shell via `app_process`, over the phone's OWN wireless-debugging channel that Self-Pair already
 * trusts ([LibAdbTransport]). The helper streams a 16-byte header + PCM16 back over the same
 * `exec:` pipe; this class reads it.
 *
 * Requires wireless debugging to be enabled and the device already Self-Paired. If it is not, every
 * entry point fails soft (logs and returns) — the rest of the host is unaffected, only call audio
 * is absent.
 */
class CallAudioBridge(private val context: Context) {

    private var transport: LibAdbTransport? = null

    /**
     * Diagnostic: capture [source] for [seconds] and report loudness. Confirms the whole chain —
     * shell capture + FakeContext attribution + ADB streaming — on a real call, without touching
     * the live WebRTC track. Source ints: 3=VOICE_DOWNLINK, 4=VOICE_CALL, 1=MIC, 2=VOICE_UPLINK.
     */
    suspend fun probe(source: Int, seconds: Int): String = withContext(Dispatchers.IO) {
        val t = ensureReady() ?: return@withContext "ADB_UNAVAILABLE (enable wireless debugging; device must be Self-Paired)"
        val cmd = helperCommand(source)
        val stream = runCatching { t.openExec(cmd) }.getOrElse { return@withContext "EXEC_FAIL ${it.message}" }
        try {
            val input = stream.input
            val hdr = readHeader(input)
                ?: return@withContext "NO_STREAM (helper output logged above — CTOR_FAIL / class-not-found / corrupt dex)"
            val rate = hdr.rate
            val ch = hdr.ch
            val src = hdr.src

            val buf = ByteArray(8192)
            var samples = 0L
            var sumSq = 0.0
            var peak = 0
            val end = System.currentTimeMillis() + seconds * 1000L
            while (System.currentTimeMillis() < end) {
                val n = try { input.read(buf) } catch (e: Exception) { break }
                if (n < 0) break
                var i = 0
                while (i + 1 < n) {
                    val s = ((buf[i].toInt() and 0xFF) or (buf[i + 1].toInt() shl 8)).toShort().toInt()
                    sumSq += (s * s).toDouble()
                    samples++
                    val a = abs(s)
                    if (a > peak) peak = a
                    i += 2
                }
            }
            val rms = if (samples > 0) sqrt(sumSq / samples) else 0.0
            val dbfs = if (rms > 0) 20 * log10(rms / 32768.0) else -999.0
            val verdict = if (rms > 30) "AUDIO_PRESENT" else "SILENT"
            "$verdict source=$src rate=${rate}Hz ch=$ch rms=${"%.1f".format(rms)} dBFS=${"%.1f".format(dbfs)} peak=$peak"
        } finally {
            runCatching { stream.close() }
        }
    }

    // --- live streaming (step 2: fed into HostAudio's call ring) ----------------------------

    @Volatile private var streaming = false
    private var streamHandle: LibAdbTransport.ExecStream? = null
    private var readerThread: Thread? = null

    /**
     * Start streaming [source] and deliver each PCM chunk to [onFrame] (called on a reader thread)
     * until [stop]. [onReady] reports the negotiated rate/channels or null on failure. Fails soft.
     */
    fun start(source: Int, onReady: (rate: Int, channels: Int) -> Unit, onFrame: (ByteArray, Int) -> Unit) {
        if (streaming) return
        streaming = true
        readerThread = Thread({
            try {
                val t = kotlinx.coroutines.runBlocking { ensureReady() }
                if (t == null) { Log.w(TAG, "call-audio stream: ADB unavailable"); onReady(0, 0); return@Thread }
                val handle = kotlinx.coroutines.runBlocking { runCatching { t.openExec(helperCommand(source)) }.getOrNull() }
                if (handle == null) { Log.w(TAG, "call-audio stream: exec failed"); onReady(0, 0); return@Thread }
                streamHandle = handle
                val input = handle.input
                val hdr = readHeader(input)
                if (hdr == null) { Log.w(TAG, "call-audio stream: no header (see sniff above)"); onReady(0, 0); return@Thread }
                Log.i(TAG, "call-audio streaming: source=${hdr.src} ${hdr.rate}Hz ch=${hdr.ch}")
                onReady(hdr.rate, hdr.ch)
                val buf = ByteArray(8192)
                while (streaming) {
                    val n = try { input.read(buf) } catch (e: Exception) { break }
                    if (n < 0) break
                    if (n > 0) onFrame(buf, n)
                }
            } catch (t: Throwable) {
                Log.w(TAG, "call-audio stream ended: ${t.message}")
            } finally {
                runCatching { streamHandle?.close() }
                streamHandle = null
            }
        }, "CallAudioReader").apply { isDaemon = true; start() }
    }

    fun stop() {
        streaming = false
        runCatching { streamHandle?.close() }
        streamHandle = null
        readerThread = null
    }

    fun release() {
        stop()
        runCatching { transport?.close() }
        transport = null
        runCatching { multicastLock?.takeIf { it.isHeld }?.release() }
        multicastLock = null
    }

    // --- plumbing --------------------------------------------------------------------------

    private var multicastLock: android.net.wifi.WifiManager.MulticastLock? = null

    /** Samsung drops inbound multicast unless a lock is held, which breaks the mDNS discovery
     *  libadb uses to find the wireless-debugging connect port. Same reason Self-Pair holds one. */
    private fun acquireMulticast() {
        if (multicastLock?.isHeld == true) return
        val wifi = context.applicationContext.getSystemService(Context.WIFI_SERVICE)
            as? android.net.wifi.WifiManager ?: return
        multicastLock = wifi.createMulticastLock("remote365-calladb").apply {
            setReferenceCounted(false)
            runCatching { acquire() }
        }
    }

    private suspend fun ensureReady(): LibAdbTransport? {
        val t = transport ?: LibAdbTransport(context).also { transport = it }
        acquireMulticast()
        runCatching { t.connect(context, 15_000) }
            .getOrElse { Log.w(TAG, "ADB connect failed (wireless debugging off / not Self-Paired?): ${it.message}"); return null }
        val dex = runCatching { context.assets.open(DEX_ASSET).use { it.readBytes() } }
            .getOrElse { Log.e(TAG, "callaudio.dex asset missing — build did not bundle it"); return null }
        runCatching { t.pushFile(DEX_REMOTE, dex) }
            .getOrElse { Log.w(TAG, "staging helper dex failed: ${it.message}"); return null }
        return t
    }

    private fun helperCommand(source: Int) =
        "CLASSPATH=$DEX_REMOTE app_process /data/local/tmp $HELPER_MAIN $source 48000"

    private data class Hdr(val rate: Int, val ch: Int, val src: Int)

    /**
     * Read the 'R3CA' header, resyncing past any stray leading bytes (a merged stderr line, a Java
     * stack trace from a bad launch, etc.). On failure it logs the first bytes actually received —
     * that text tells us whether the helper crashed, the dex is corrupt, or nothing ran at all.
     */
    private fun readHeader(input: InputStream): Hdr? {
        val sniff = ByteArrayOutputStream()
        var b0 = -1; var b1 = -1; var b2 = -1; var b3 = -1
        var scanned = 0
        while (scanned < 8192) {
            val b = try { input.read() } catch (e: Exception) { -1 }
            if (b < 0) break
            sniff.write(b); scanned++
            b0 = b1; b1 = b2; b2 = b3; b3 = b
            if (b0 == 'R'.code && b1 == '3'.code && b2 == 'C'.code && b3 == 'A'.code) {
                val rest = ByteArray(12)
                if (!readFully(input, rest)) break
                return Hdr(leInt(rest, 0), leInt(rest, 4), leInt(rest, 8))
            }
        }
        val bytes = sniff.toByteArray()
        val text = String(bytes.copyOf(minOf(bytes.size, 200)), Charsets.US_ASCII)
            .replace(Regex("[^\\x20-\\x7e]"), ".")
        Log.w(TAG, "no R3CA header in first ${bytes.size}B: $text")
        return null
    }

    private fun readFully(input: InputStream, out: ByteArray): Boolean {
        var off = 0
        while (off < out.size) {
            val n = try { input.read(out, off, out.size - off) } catch (e: Exception) { return false }
            if (n < 0) return false
            off += n
        }
        return true
    }

    private fun leInt(b: ByteArray, o: Int): Int =
        (b[o].toInt() and 0xFF) or ((b[o + 1].toInt() and 0xFF) shl 8) or
            ((b[o + 2].toInt() and 0xFF) shl 16) or ((b[o + 3].toInt() and 0xFF) shl 24)

    private companion object {
        const val TAG = "CallAudioBridge"
        const val DEX_ASSET = "callaudio.dex"
        const val DEX_REMOTE = "/data/local/tmp/callaudio.dex"
        const val HELPER_MAIN = "ai.remote365.callaudio.CallAudioServer"
    }
}
