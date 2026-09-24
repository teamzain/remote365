package ai.remote365.host.provisioning.selfpair

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.coroutines.suspendCancellableCoroutine
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.coroutines.resume

data class PairingEndpoint(val host: String, val port: Int)

/**
 * Discovers the **pairing** port that "Pair device with pairing code" opened, over mDNS on this
 * device. The port is randomised each time the screen is shown, so finding it automatically means
 * the user types only the 6-digit code — never an IP or port.
 *
 * Best-effort: if discovery fails (some OEM mDNS stacks are flaky), the wizard falls back to a
 * manual port field with host `127.0.0.1`, which the pairing dialog also shows.
 */
class PairingPortScanner(private val context: Context) {

    suspend fun discover(timeoutMs: Long = 8_000): PairingEndpoint? {
        // Samsung (and others) drop inbound mDNS multicast unless a multicast lock is held, which is
        // why the pairing service was invisible on the A05s. Hold one for the duration of the scan.
        val wifi = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
        val lock = wifi?.createMulticastLock("remote365-adb-mdns")?.apply {
            setReferenceCounted(false)
            runCatching { acquire() }
        }
        return try {
            scan(timeoutMs)
        } finally {
            runCatching { lock?.release() }
        }
    }

    private suspend fun scan(timeoutMs: Long): PairingEndpoint? = withTimeoutOrNull(timeoutMs) {
        suspendCancellableCoroutine<PairingEndpoint?> { cont ->
            val nsd = context.getSystemService(Context.NSD_SERVICE) as NsdManager
            val done = AtomicBoolean(false)

            val listener = object : NsdManager.DiscoveryListener {
                override fun onServiceFound(info: NsdServiceInfo) {
                    @Suppress("DEPRECATION")
                    nsd.resolveService(info, object : NsdManager.ResolveListener {
                        override fun onServiceResolved(resolved: NsdServiceInfo) {
                            @Suppress("DEPRECATION")
                            val host = resolved.host?.hostAddress ?: return
                            if (done.compareAndSet(false, true) && cont.isActive) {
                                cont.resume(PairingEndpoint(host, resolved.port))
                            }
                        }

                        override fun onResolveFailed(info: NsdServiceInfo?, errorCode: Int) = Unit
                    })
                }

                override fun onStartDiscoveryFailed(type: String?, errorCode: Int) {
                    if (done.compareAndSet(false, true) && cont.isActive) cont.resume(null)
                }

                override fun onDiscoveryStarted(type: String?) = Unit
                override fun onServiceLost(info: NsdServiceInfo?) = Unit
                override fun onDiscoveryStopped(type: String?) = Unit
                override fun onStopDiscoveryFailed(type: String?, errorCode: Int) = Unit
            }

            runCatching { nsd.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, listener) }
                .onFailure { if (cont.isActive) cont.resume(null) }

            cont.invokeOnCancellation { runCatching { nsd.stopServiceDiscovery(listener) } }
        }
    }

    private companion object {
        const val SERVICE_TYPE = "_adb-tls-pairing._tcp"
    }
}
