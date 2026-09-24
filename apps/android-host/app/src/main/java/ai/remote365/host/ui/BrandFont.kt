package ai.remote365.host.ui

import ai.remote365.host.R
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight

/**
 * Mona Sans — the exact family from the Figma design, bundled as static TTFs in res/font (no CDN,
 * no downloadable-font flash). Used across the splash and onboarding so type matches the design.
 */
val MonaSans = FontFamily(
    Font(R.font.mona_sans_regular, FontWeight.Normal),
    Font(R.font.mona_sans_medium, FontWeight.Medium),
    Font(R.font.mona_sans_semibold, FontWeight.SemiBold),
    Font(R.font.mona_sans_bold, FontWeight.Bold),
)
