package ai.remote365.host.provisioning.selfpair

import android.content.Context
import android.os.Build
import android.util.Base64
import io.github.muntashirakon.adb.AbsAdbConnectionManager
import io.github.muntashirakon.adb.AdbStream
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.Closeable
import java.io.InputStream
import java.security.PrivateKey
import java.security.cert.Certificate

/**
 * [AdbTransport] backed by libadb-android. The **only** class that imports the wireless-debugging
 * library — everything else in Self-Pair depends on the [AdbTransport] interface.
 */
class LibAdbTransport(context: Context) : AdbTransport {

    private val identity = AdbKeyStore.create(context.applicationContext).loadOrCreate()
    private val manager = Manager(identity)

    override suspend fun pair(host: String, port: Int, code: String) = withContext(Dispatchers.IO) {
        val paired = runCatching { manager.pair(host, port, code) }
            .getOrElse { throw AdbException(it.message ?: "Pairing failed") }
        if (!paired) throw AdbException("Pairing was refused — re-check the 6-digit code.")
    }

    override suspend fun connect(context: Context, timeoutMs: Long) = withContext(Dispatchers.IO) {
        val multicast = (context.applicationContext.getSystemService(Context.WIFI_SERVICE) as android.net.wifi.WifiManager)
            .createMulticastLock("remote365-adb-discovery").apply { setReferenceCounted(false) }
        val connected = try {
            multicast.acquire()
            manager.autoConnect(context.applicationContext, timeoutMs)
        } catch (e: Exception) { throw AdbException(e.message ?: "Connection failed") }
        finally { if (multicast.isHeld) multicast.release() }
        if (!connected) throw AdbException("Could not connect to wireless debugging on this device.")
    }

    /** Owner-supplied address from Wireless debugging when mDNS discovery is unavailable. */
    suspend fun connectAt(host: String, port: Int) = withContext(Dispatchers.IO) {
        manager.setTimeout(10_000, java.util.concurrent.TimeUnit.MILLISECONDS)
        if (!manager.connect(host, port)) throw AdbException("Wireless debugging connection refused")
    }

    override suspend fun exec(command: String): String = withContext(Dispatchers.IO) {
        // "shell:<cmd>" runs one command like `adb shell <cmd>`. libadb throws IOException("Stream
        // closed") at end-of-stream instead of returning -1, especially for commands with no output
        // (appops set, pm grant), so treat any read error as EOF and keep whatever we got.
        val stream = manager.openStream("shell:$command")
        val out = java.io.ByteArrayOutputStream()
        try {
            val input = stream.openInputStream()
            val buf = ByteArray(4096)
            while (true) {
                val n = try {
                    input.read(buf)
                } catch (e: java.io.IOException) {
                    break
                }
                if (n < 0) break
                out.write(buf, 0, n)
            }
        } finally {
            runCatching { stream.close() }
        }
        out.toString("UTF-8").trim()
    }

    /**
     * Write [bytes] to [remotePath] on the device, binary-safe. Uses `exec:base64 -d > path`:
     * `exec:` runs through the shell (so the redirect works) but on a raw pipe with no PTY (so
     * neither the base64 text we send nor anything else is line-ending-mangled). The app can't
     * write /data/local/tmp itself (app uid), so this shell-uid channel is the only way to stage
     * the call-audio helper dex there where `app_process` can load it.
     */
    suspend fun pushFile(remotePath: String, bytes: ByteArray, privateFile: Boolean = false) = withContext(Dispatchers.IO) {
        val b64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
        val prefix = if (privateFile) "umask 077; " else ""
        // AdbOutputStream.close() does not half-close remote stdin. Bound the payload explicitly
        // so base64 receives EOF after the expected bytes instead of waiting forever.
        val stream = manager.openStream("exec:${prefix}head -c ${b64.length} | base64 -d > $remotePath")
        try {
            stream.openOutputStream().use { it.write(b64.toByteArray(Charsets.US_ASCII)); it.flush() }
            // Draining stdout blocks until base64 has exited, i.e. the file is fully written.
            runCatching { stream.openInputStream().use { it.readBytesCompat() } }
        } finally {
            runCatching { stream.close() }
        }
    }

    /**
     * Start a long-lived `exec:` command and stream its stdout. `exec:` (unlike `shell:`) forwards
     * only stdout on a raw pipe, so the helper's 16-byte header + PCM arrive uncorrupted while its
     * diagnostics on stderr are dropped. Caller reads [ExecStream.input] and [ExecStream.close]s to
     * stop the remote process.
     */
    suspend fun openExec(command: String): ExecStream = withContext(Dispatchers.IO) {
        ExecStream(manager.openStream("exec:$command"))
    }

    /** Wraps an [AdbStream] so callers never import the libadb type directly. */
    class ExecStream internal constructor(private val stream: AdbStream) : Closeable {
        val input: InputStream get() = stream.openInputStream()
        override fun close() {
            runCatching { stream.close() }
        }
    }

    override fun close() {
        runCatching { manager.close() }
    }

    private fun InputStream.readBytesCompat() {
        val buf = ByteArray(4096)
        while (true) {
            val n = try { read(buf) } catch (e: java.io.IOException) { break }
            if (n < 0) break
        }
    }

    /** The single subclass of the library's connection manager, fed our durable ADB identity. */
    private class Manager(private val identity: AdbIdentity) : AbsAdbConnectionManager() {
        init {
            setApi(Build.VERSION.SDK_INT)
        }

        override fun getPrivateKey(): PrivateKey = identity.privateKey
        override fun getCertificate(): Certificate = identity.certificate
        override fun getDeviceName(): String = "Remote365 Host"
    }
}
