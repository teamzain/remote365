package ai.remote365.host.ui

import ai.remote365.host.R
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

/**
 * Branded splash. Deliberately drawn in Compose (not the Android-12 SplashScreen API, which only
 * allows a centred icon) so it matches the design exactly.
 *
 * "Identical on every phone" is engineered, not hoped for:
 *  - all sizes are in **dp** → same physical size across pixel densities;
 *  - the cluster is **centre-anchored** → a taller/shorter/wider screen only changes the white
 *    margin, never the artwork;
 *  - the glow is a **radial gradient fading into white** (no `Modifier.blur`, which is API-31+ and
 *    would look different on older devices);
 *  - the font scale is **pinned to 1.0** so the user's system font-size setting can't resize the
 *    text — the splash always renders at the design size.
 */
class SplashActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            SplashScreen(onDone = {
                // A device that's already set up (silent capture granted) goes straight home;
                // otherwise run first-time onboarding.
                val paired = ai.remote365.host.provisioning.ProvisioningInspector
                    .inspect(this).projectMediaGranted
                val target = if (paired) MainActivity::class.java else OnboardingActivity::class.java
                startActivity(Intent(this, target))
                @Suppress("DEPRECATION")
                overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
                finish()
            })
        }
    }
}

@Composable
private fun SplashScreen(onDone: () -> Unit) {
    LaunchedEffect(Unit) {
        delay(SPLASH_MS)
        onDone()
    }

    // Pin fontScale = 1.0 so the design text size is identical regardless of the user's font setting.
    val base = LocalDensity.current
    CompositionLocalProvider(
        LocalDensity provides Density(density = base.density, fontScale = 1f),
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.White),
            contentAlignment = Alignment.Center,
        ) {
            // Ellipse 2 — 450dp radial glow, fading to white so it melts into the background on any
            // device (matches radial-gradient(50% 50% at 50% 50%, #FF8A00→#FFB347→#FFFFFF @ .54)).
            Box(
                modifier = Modifier
                    .size(450.dp)
                    .background(
                        Brush.radialGradient(
                            colorStops = arrayOf(
                                0.0f to Color(0x8AFF8A00),
                                0.281f to Color(0x8AFFB347),
                                1.0f to Color(0x8AFFFFFF),
                            ),
                        ),
                    ),
            )

            // Frame 1160445178 — the centred brand cluster.
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    Image(
                        painter = painterResource(R.drawable.logo_mark),
                        contentDescription = "Remote365",
                        modifier = Modifier.size(60.dp),
                    )
                    androidx.compose.material3.Text(
                        text = "Remote365",
                        fontFamily = Brand,
                        fontWeight = FontWeight.Bold,
                        fontSize = 24.sp,
                        lineHeight = 34.sp,
                        color = Color(0xFF111315),
                    )
                }

                // Frame 1160445177 — line · "Secure Node Mesh" · line.
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Rule()
                    androidx.compose.material3.Text(
                        text = "Secure Node Mesh",
                        fontFamily = Brand,
                        fontWeight = FontWeight.Medium,
                        fontSize = 14.sp,
                        lineHeight = 20.sp,
                        color = Color(0xFF1A1D21),
                    )
                    Rule()
                }
            }
        }
    }
}

@Composable
private fun Rule() {
    Box(
        modifier = Modifier
            .width(50.dp)
            .height(2.dp)
            .background(Color(0xFF1A1D21)),
    )
}

/**
 * The design uses "Mona Sans". Drop `mona_sans.ttf` into `res/font/` and set this to
 * `FontFamily(Font(R.font.mona_sans))` to match exactly; until then the closest system sans is used.
 */
private val Brand = MonaSans

private const val SPLASH_MS = 1500L
