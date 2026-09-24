package ai.remote365.host.rtc

/**
 * Stream quality tiers.
 *
 * Resolution caps are the load-bearing part: budget Android hardware H.264 encoders are
 * typically Level 3.1 (~0.9 Mpx). A phone's native panel (e.g. 720x1600 = 1.15 Mpx) already
 * EXCEEDS that, so feeding it unscaled fills the encoder queue and it drops every frame —
 * "HardwareVideoEncoder: Dropped frame, encoder queue full" — and the viewer sees nothing.
 * maxLongEdge therefore stays at or below 1280 for the everyday tiers so the scaled frame fits
 * inside Level 3.1's pixel budget.
 */
enum class Quality(val bitrateKbps: Int, val fps: Int, val maxLongEdge: Int) {
    SMOOTH(1_500, 30, 1_024),
    BALANCED(2_500, 30, 1_280),
    SHARP(4_000, 30, 1_280),
    ULTRA(6_000, 30, 1_600);

    companion object {
        /**
         * Viewer aliases. "auto"/"high" map to BALANCED, NOT the top tier: defaulting to
         * ULTRA (9 Mbps, full-res) is exactly what overwhelmed the budget encoder. A capable
         * device can still be pushed up explicitly via "sharp"/"ultra".
         */
        fun fromMode(mode: String?): Quality = when (mode?.lowercase()) {
            "ultra", "max" -> ULTRA
            "sharp", "high", "quality" -> SHARP
            "auto", "medium", "balanced" -> BALANCED
            "low", "speed", "smooth" -> SMOOTH
            else -> BALANCED
        }
    }
}
