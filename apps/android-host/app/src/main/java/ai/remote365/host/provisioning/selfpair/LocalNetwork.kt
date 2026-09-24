package ai.remote365.host.provisioning.selfpair

import java.net.Inet4Address
import java.net.NetworkInterface

/**
 * The device's own Wi-Fi IPv4.
 *
 * Needed because `adbd`'s pairing server refuses loopback on some OEMs: verified on Samsung
 * One UI 7 / Android 15, where `127.0.0.1:<pairPort>` gives ECONNREFUSED but the wlan IP works.
 * So the manual-entry fallback pre-fills this instead of `127.0.0.1`.
 */
object LocalNetwork {

    fun wifiIpv4(): String? = runCatching {
        NetworkInterface.getNetworkInterfaces().asSequence()
            .filter { it.isUp && !it.isLoopback }
            .flatMap { it.inetAddresses.asSequence() }
            .filterIsInstance<Inet4Address>()
            .firstOrNull { it.isSiteLocalAddress }
            ?.hostAddress
    }.getOrNull()
}
