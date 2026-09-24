package ai.remote365.host.ui

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathMeasure
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate

/**
 * On-brand onboarding illustrations, drawn with Canvas primitives rather than raster assets.
 *
 * Vector art buys us the one property the onboarding needs most: it renders identically and
 * crisply on every phone regardless of screen density — no `-hdpi/-xhdpi/...` buckets, no
 * blur on tall panels, no network fetch. Each hero is the same visual system (a soft glow, a
 * rounded gradient tile in the brand orange, a white glyph, a few floating accent dots) with a
 * per-screen glyph, so the flow reads as one coherent set.
 */
enum class HeroArt { WELCOME, CONSENT, INPUT, DEVOPTIONS, WIRELESS, PAIRING, CONGRATS }

private val Ink = Color(0xFF111315)
private val Accent = Color(0xFFFF8A00)
private val Accent2 = Color(0xFFFFB347)
private val Grey = Color(0xFFD5D9DE)

/**
 * @param progress drives the CONGRATS draw-on animation (0 = nothing, 1 = complete). Every other
 *   hero is static, so it simply ignores this.
 */
@Composable
fun Hero(art: HeroArt, modifier: Modifier = Modifier, progress: Float = 1f) {
    Canvas(modifier = modifier) {
        val s = size.minDimension

        // Ambient glow + a few floating dots so the tile doesn't sit on dead space.
        drawCircle(Color(0x12FF8A00), radius = 0.46f * s, center = Offset(s / 2f, s * 0.52f))
        drawCircle(Color(0x22FF8A00), radius = 0.018f * s, center = Offset(0.20f * s, 0.24f * s))
        drawCircle(Color(0x1AFF8A00), radius = 0.026f * s, center = Offset(0.82f * s, 0.30f * s))
        drawCircle(Color(0x14111315), radius = 0.014f * s, center = Offset(0.76f * s, 0.74f * s))

        // The rounded gradient tile every glyph sits on.
        val side = 0.58f * s
        val tl = Offset((s - side) / 2f, (s - side) / 2f)
        val cr = CornerRadius(0.20f * s)
        drawRoundRect(Color(0x14000000), topLeft = tl + Offset(0f, 0.02f * s), size = Size(side, side), cornerRadius = cr)
        drawRoundRect(
            brush = Brush.linearGradient(listOf(Accent, Accent2), start = tl, end = Offset(tl.x + side, tl.y + side)),
            topLeft = tl,
            size = Size(side, side),
            cornerRadius = cr,
        )

        when (art) {
            HeroArt.WELCOME -> glyphWelcome(s)
            HeroArt.CONSENT -> glyphConsent(s)
            HeroArt.INPUT -> glyphInput(s)
            HeroArt.DEVOPTIONS -> glyphDevOptions(s)
            HeroArt.WIRELESS -> glyphWireless(s)
            HeroArt.PAIRING -> glyphPairing(s)
            HeroArt.CONGRATS -> glyphCongrats(s, progress)
        }
    }
}

// --- glyphs (white on the orange tile) ----------------------------------------------------------

/** The Remote 365 lightning mark. */
private fun DrawScope.glyphWelcome(s: Float) {
    val bolt = Path().apply {
        moveTo(0.545f * s, 0.375f * s)
        lineTo(0.430f * s, 0.560f * s)
        lineTo(0.498f * s, 0.560f * s)
        lineTo(0.452f * s, 0.655f * s)
        lineTo(0.590f * s, 0.458f * s)
        lineTo(0.512f * s, 0.458f * s)
        close()
    }
    drawPath(bolt, Color.White)
}

/** A shield with a keyhole — permission / trust. */
private fun DrawScope.glyphConsent(s: Float) {
    val shield = Path().apply {
        moveTo(0.500f * s, 0.378f * s)
        lineTo(0.635f * s, 0.428f * s)
        lineTo(0.635f * s, 0.540f * s)
        quadraticBezierTo(0.635f * s, 0.622f * s, 0.500f * s, 0.668f * s)
        quadraticBezierTo(0.365f * s, 0.622f * s, 0.365f * s, 0.540f * s)
        lineTo(0.365f * s, 0.428f * s)
        close()
    }
    drawPath(shield, Color.White)
    drawCircle(Accent, radius = 0.028f * s, center = Offset(0.5f * s, 0.508f * s))
    drawRoundRect(
        Accent,
        topLeft = Offset(0.487f * s, 0.518f * s),
        size = Size(0.026f * s, 0.056f * s),
        cornerRadius = CornerRadius(0.013f * s),
    )
}

/** A tap ripple — remote input / accessibility. */
private fun DrawScope.glyphInput(s: Float) {
    val c = Offset(0.5f * s, 0.535f * s)
    drawCircle(Color.White, radius = 0.052f * s, center = c)
    drawCircle(Color.White, radius = 0.112f * s, center = c, style = Stroke(width = 0.026f * s))
    drawArc(
        Color(0x66FFFFFF),
        startAngle = -35f,
        sweepAngle = -110f,
        useCenter = false,
        topLeft = Offset(c.x - 0.165f * s, c.y - 0.165f * s),
        size = Size(0.33f * s, 0.33f * s),
        style = Stroke(width = 0.020f * s, cap = StrokeCap.Round),
    )
}

/** A gear — developer options. */
private fun DrawScope.glyphDevOptions(s: Float) {
    val c = Offset(0.5f * s, 0.535f * s)
    for (k in 0 until 8) {
        rotate(degrees = k * 45f, pivot = c) {
            drawRoundRect(
                Color.White,
                topLeft = Offset(c.x - 0.028f * s, c.y - 0.190f * s),
                size = Size(0.056f * s, 0.062f * s),
                cornerRadius = CornerRadius(0.014f * s),
            )
        }
    }
    drawCircle(Color.White, radius = 0.135f * s, center = c)
    drawCircle(Accent, radius = 0.052f * s, center = c)
}

/** Broadcast arcs — wireless debugging. */
private fun DrawScope.glyphWireless(s: Float) {
    val base = Offset(0.5f * s, 0.612f * s)
    drawCircle(Color.White, radius = 0.030f * s, center = base)
    for (r in listOf(0.088f, 0.145f)) {
        drawArc(
            Color.White,
            startAngle = 202f,
            sweepAngle = 136f,
            useCenter = false,
            topLeft = Offset(base.x - r * s, base.y - r * s),
            size = Size(2 * r * s, 2 * r * s),
            style = Stroke(width = 0.026f * s, cap = StrokeCap.Round),
        )
    }
}

/** Two interlocking rings — pairing. */
private fun DrawScope.glyphPairing(s: Float) {
    val cl = Offset(0.438f * s, 0.535f * s)
    val cr = Offset(0.562f * s, 0.535f * s)
    drawCircle(Color.White, radius = 0.086f * s, center = cl, style = Stroke(width = 0.030f * s))
    drawCircle(Color.White, radius = 0.086f * s, center = cr, style = Stroke(width = 0.030f * s))
}

/**
 * A check that draws itself on. [t] runs 0→1: the stroke is revealed along its own length with
 * [PathMeasure], then the confetti pops out in the back half of the animation.
 */
private fun DrawScope.glyphCongrats(s: Float, t: Float) {
    val check = Path().apply {
        moveTo(0.412f * s, 0.540f * s)
        lineTo(0.475f * s, 0.602f * s)
        lineTo(0.600f * s, 0.452f * s)
    }
    // Reveal the stroke over the first 70% of the animation.
    val drawn = (t / 0.7f).coerceIn(0f, 1f)
    val measure = PathMeasure().apply { setPath(check, false) }
    val revealed = Path()
    measure.getSegment(0f, measure.length * drawn, revealed, true)
    drawPath(
        revealed,
        Color.White,
        style = Stroke(width = 0.042f * s, cap = StrokeCap.Round, join = StrokeJoin.Round),
    )

    // Confetti, kept clear of the tile — which spans 0.21..0.79 on both axes — so nothing
    // collides with its rounded corners. Scales up once the check has landed.
    val pop = ((t - 0.55f) / 0.45f).coerceIn(0f, 1f)
    if (pop > 0f) {
        drawCircle(Accent, radius = 0.020f * s * pop, center = Offset(0.145f * s, 0.325f * s))
        drawCircle(Accent2, radius = 0.016f * s * pop, center = Offset(0.868f * s, 0.300f * s))
        drawCircle(Grey, radius = 0.014f * s * pop, center = Offset(0.170f * s, 0.700f * s))
        drawCircle(Accent2, radius = 0.013f * s * pop, center = Offset(0.845f * s, 0.720f * s))
    }
}
