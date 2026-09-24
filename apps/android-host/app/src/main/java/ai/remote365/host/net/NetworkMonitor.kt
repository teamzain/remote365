package ai.remote365.host.net

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Tracks the device's default network so the host can react to connectivity changes the moment
 * they happen instead of waiting for a dead socket to time out.
 *
 * Why this exists: after Airplane Mode (or a Wi-Fi/cellular handover) the signaling socket does
 * not always fail promptly, and even when it does the reconnect was driven purely by an
 * exponential backoff that could sit at 60s. The OS knows the instant a network becomes usable —
 * `ConnectivityManager` delivers `VALIDATED` once captive-portal/DNS probing succeeds — so we
 * listen for that and let the service reconnect immediately.
 *
 * Semantics:
 *  - [Listener.onOnline] fires once per distinct default network, when it is validated (or after
 *    a short grace period if the OS never validates it — some private networks never do, but the
 *    signaling server may still be reachable).
 *  - [Listener.onOffline] fires when the current default network is lost with no replacement.
 *  - A handover (cellular → Wi-Fi) shows up as `onOnline(newNetwork)` with a different
 *    [Network], which is the caller's cue that any socket bound to the old one is doomed.
 */
class NetworkMonitor(
    context: Context,
    private val scope: CoroutineScope,
    private val listener: Listener,
) {

    interface Listener {
        fun onOnline(network: Network)
        fun onOffline()
    }

    private val cm = context.getSystemService(ConnectivityManager::class.java)

    /** The default network we consider usable, or null while offline. */
    @Volatile
    var current: Network? = null
        private set

    val isOnline: Boolean get() = current != null

    private var validationGrace: Job? = null
    private var registered = false

    private val callback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            Log.i(TAG, "default network available: $network")
            // Prefer to wait for VALIDATED (delivered via onCapabilitiesChanged right after this),
            // but never wait forever — an un-validated network is still worth a try.
            validationGrace?.cancel()
            validationGrace = scope.launch {
                delay(VALIDATION_GRACE_MS)
                markOnline(network, validated = false)
            }
        }

        override fun onCapabilitiesChanged(network: Network, caps: NetworkCapabilities) {
            val usable = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
            if (!usable) return
            validationGrace?.cancel()
            validationGrace = null
            markOnline(network, validated = true)
        }

        override fun onLost(network: Network) {
            Log.w(TAG, "network lost: $network (current=$current)")
            // On a handover the new default's onAvailable can precede the old one's onLost —
            // only treat it as going offline if the lost network is the one we rely on.
            if (network == current) {
                current = null
                listener.onOffline()
            }
        }

        override fun onUnavailable() {
            Log.w(TAG, "no default network")
            if (current != null) {
                current = null
                listener.onOffline()
            }
        }
    }

    @Synchronized
    private fun markOnline(network: Network, validated: Boolean) {
        if (network == current) return
        Log.i(TAG, "online via $network (validated=$validated)")
        current = network
        listener.onOnline(network)
    }

    fun start() {
        if (registered) return
        registered = true
        // Seed from the current state so a service (re)start on a healthy network is "online"
        // immediately rather than after the first callback.
        cm.activeNetwork?.let { active ->
            val caps = cm.getNetworkCapabilities(active)
            if (caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true) {
                current = active
            }
        }
        runCatching { cm.registerDefaultNetworkCallback(callback) }
            .onFailure { Log.e(TAG, "registerDefaultNetworkCallback failed", it) }
    }

    fun stop() {
        if (!registered) return
        registered = false
        validationGrace?.cancel()
        runCatching { cm.unregisterNetworkCallback(callback) }
    }

    private companion object {
        const val TAG = "NetworkMonitor"
        /** How long to wait for VALIDATED before treating an available network as usable. */
        const val VALIDATION_GRACE_MS = 6_000L
    }
}
