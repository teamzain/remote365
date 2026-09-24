package ai.remote365.host.provisioning.selfpair

import android.content.Context

/**
 * The ADB transport used by Self-Pair, isolated behind this interface so the wizard, state
 * machine, and grant sequence never touch the wireless-debugging library directly. Swapping the
 * implementation (e.g. if Google ever restricts loopback ADB — see UNATTENDED.md §6) means
 * replacing exactly one class.
 */
interface AdbTransport {

    /**
     * Pair with the phone's own `adbd` using the 6-digit code from the wireless-debugging
     * "Pair device with pairing code" screen. Establishes the trust that later connects reuse.
     */
    suspend fun pair(host: String, port: Int, code: String)

    /** Discover the connect port over mDNS and open a trusted ADB connection. */
    suspend fun connect(context: Context, timeoutMs: Long = 15_000)

    /** Run one shell command (as `adb shell <command>`) and return its combined output. */
    suspend fun exec(command: String): String

    fun close()
}

/** Any failure in the Self-Pair transport, surfaced to the wizard with a user-readable message. */
class AdbException(message: String) : Exception(message)
