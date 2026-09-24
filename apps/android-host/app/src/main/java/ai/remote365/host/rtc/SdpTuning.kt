package ai.remote365.host.rtc

/**
 * Seeds encoder bitrate through SDP.
 *
 * The x-google-* hints must be appended to the H.264 `a=fmtp:` lines ONLY. Applying them to
 * every fmtp line (including VP8/VP9 or audio) confuses the bandwidth estimator.
 */
object SdpTuning {

    fun seedBitrate(sdp: String, quality: Quality): String {
        val h264Payloads = h264PayloadTypes(sdp)
        if (h264Payloads.isEmpty()) return sdp

        val max = quality.bitrateKbps
        // Start high. WebRTC's bandwidth estimator ramps from the start bitrate, and the climb
        // is exactly the window where a session looks blocky and stuttery before "settling".
        // On a screencast the first seconds are also the most detail-heavy (the operator is
        // reading the screen), so starting low is worst exactly when it is most visible.
        val start = (max * 0.85).toInt()
        val min = (max * 0.25).toInt()
        val hints = ";x-google-start-bitrate=$start;x-google-min-bitrate=$min;x-google-max-bitrate=$max"

        return sdp.lineSequence().joinToString("\r\n") { line ->
            val payload = line.substringAfter("a=fmtp:", "").substringBefore(' ')
            if (line.startsWith("a=fmtp:") && payload in h264Payloads && !line.contains("x-google-max-bitrate")) {
                line + hints
            } else {
                line
            }
        }
    }

    /** Payload types whose rtpmap names H264, including those bound via apt= (RTX). */
    private fun h264PayloadTypes(sdp: String): Set<String> =
        sdp.lineSequence()
            .filter { it.startsWith("a=rtpmap:") && it.contains("H264", ignoreCase = true) }
            .map { it.removePrefix("a=rtpmap:").substringBefore(' ') }
            .toSet()
}
