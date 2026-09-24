package ai.remote365.host.input

import android.os.Handler
import android.os.Looper
import android.util.Log
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlin.math.abs
import kotlin.math.hypot

/**
 * Translates viewer input messages into accessibility gestures.
 *
 * The shape of this mirrors the RN host's handler (hostStore.ts) because the viewer protocol
 * and the tuning constants are shared. Two behaviours matter most and are easy to get wrong:
 *
 *  - Drags STREAM. Buffering a drag and replaying it as one swipe on release means the viewer
 *    drags, sees nothing, releases, and only then does the phone scroll. That dead interval is
 *    what makes a session feel laggy even when the video is smooth.
 *  - Wheel events COALESCE. A normal scroll emits 10-30 events/sec; giving each its own
 *    gesture makes them overlap and Android serialises or cancels them.
 */
class InputRouter {

    private val handler = Handler(Looper.getMainLooper())

    private var downX = 0f
    private var downY = 0f
    private var lastX = 0f
    private var lastY = 0f
    private var downAt = 0L
    private var pointerDown = false
    private var dragActive = false
    private var lastDragSentAt = 0L

    private var wheelAccumX = 0f
    private var wheelAccumY = 0f
    private var wheelAnchor: Pair<Float, Float>? = null
    private var wheelFlushScheduled = false

    /** Set from the control channel; suppresses nav-strip routing while the phone is locked. */
    @Volatile
    var screenLocked = false

    /**
     * Called when input arrives at a sleeping display. Android rejects gestures outright when
     * the screen is off, so without this every remote tap on a dark phone vanishes.
     */
    var onWakeNeeded: (() -> Unit)? = null

    /** Supplied by the host service; true when the display is on. */
    var isScreenInteractive: () -> Boolean = { true }

    private val service: HostAccessibilityService?
        get() = HostAccessibilityService.instance

    fun handle(msg: JsonObject) {
        if (VERBOSE) Log.d(TAG, "in $msg")
        val a11y = service ?: run {
            Log.w(TAG, "input dropped: accessibility service not enabled")
            return
        }
        val type = msg.str("type") ?: return

        // Wake first, then drop THIS event. The gesture would be rejected anyway on a dark
        // screen, and the operator's instinct is "tap the black screen to wake it" — exactly
        // how the phone behaves in their hand.
        if (type in POINTER_TYPES && !isScreenInteractive()) {
            Log.i(TAG, "input on sleeping display -> waking")
            onWakeNeeded?.invoke()
            pointerDown = false
            dragActive = false
            return
        }

        when (type) {
            "mousedown", "touch-start" -> {
                downX = msg.x(downX)
                downY = msg.y(downY)
                lastX = downX
                lastY = downY
                downAt = System.currentTimeMillis()
                pointerDown = true
                dragActive = false
            }

            "mousemove", "touch-move" -> {
                if (!pointerDown) return
                val x = msg.x(lastX)
                val y = msg.y(lastY)
                lastX = x
                lastY = y
                if (!dragActive && hypot(x - downX, y - downY) > DRAG_START_DISTANCE) {
                    dragActive = true
                    lastDragSentAt = 0
                    a11y.startDrag(downX, downY)
                }
                if (dragActive) {
                    // Every move would be its own dispatchGesture, flooding the accessibility
                    // queue and making the drag stutter. 16ms matches the viewer's 60Hz.
                    val now = System.currentTimeMillis()
                    if (now - lastDragSentAt >= DRAG_SEND_INTERVAL_MS) {
                        lastDragSentAt = now
                        a11y.updateDrag(x, y)
                    }
                }
            }

            "mouseup", "touch-end" -> {
                // Many viewers send mouseup with NO coordinates — only the button. Defaulting
                // those to 0 taps the top-left corner, which reads as "clicking is dead".
                val x = msg.x(lastX)
                val y = msg.y(lastY)
                if (dragActive) {
                    a11y.endDrag(x, y)
                } else if (pointerDown) {
                    val distance = hypot(x - downX, y - downY)
                    val elapsed = System.currentTimeMillis() - downAt
                    if (distance > TAP_SLOP) {
                        a11y.swipe(downX, downY, x, y, elapsed.coerceIn(160, 420))
                    } else if (!routeNavigationTap(x, y)) {
                        // Preserve a press-and-hold: dispatching the held duration as a single
                        // stationary stroke makes Android fire the view's long-press — so holding
                        // a dialer key types "+" on 0, opens key pop-ups, and raises context menus,
                        // exactly as a real finger does. A quick release stays an ordinary tap.
                        if (elapsed >= LONG_PRESS_MS) {
                            // Dispatch a stroke of at least LONG_PRESS_DISPATCH_MIN, not the raw held
                            // time: a 360ms hold detects intent but a 360ms stroke is under Android's
                            // ~400-500ms long-press timeout and would fire as a plain click.
                            a11y.tap(x, y, elapsed.coerceIn(LONG_PRESS_DISPATCH_MIN, MAX_LONG_PRESS_MS))
                        } else {
                            a11y.tap(x, y)
                        }
                    }
                }
                pointerDown = false
                dragActive = false
            }

            "tap" -> {
                val x = msg.f("x").clamp01()
                val y = msg.f("y").clamp01()
                if (!routeNavigationTap(x, y)) {
                    val duration = msg.f("duration").toLong()
                        .takeIf { it > 0 } ?: HostAccessibilityService.TAP_DURATION_MS
                    a11y.tap(x, y, duration)
                }
            }

            "swipe" -> a11y.swipe(
                msg.f("startX").clamp01(),
                msg.f("startY").clamp01(),
                msg.f("endX").clamp01(),
                msg.f("endY").clamp01(),
                msg.f("duration").toLong().takeIf { it > 0 } ?: 180L,
            )

            "wheel" -> accumulateWheel(msg)

            "text", "typeText" -> msg.str("text")?.let { injectText(it, a11y) }

            // The WEB viewer cannot forward Ctrl+V as a keystroke — the browser owns that
            // shortcut and turns it into a paste event — so it resolves the clipboard itself
            // and sends the resulting text under this type. Without handling it, Ctrl+V from
            // the web viewer does nothing at all.
            "paste-clipboard", "paste" -> msg.str("text")?.let { injectText(it, a11y) }

            "keydown" -> handleKeydown(msg, a11y)

            "globalAction" -> msg.str("action")?.toIntOrNull()?.let { a11y.globalAction(it) }
        }
    }

    private fun handleKeydown(msg: JsonObject, a11y: HostAccessibilityService) {
        val key = msg.str("key").orEmpty()
        // Viewers emit the modifier as its own keydown ("Control", repeating while held).
        // Falling through to the combo table below matches nothing and, worse, a bare
        // "Shift" would reach the printable-character path and be injected as text.
        if (key in MODIFIER_KEYS) return
        if (msg.bool("ctrlKey") || msg.bool("metaKey")) {
            when (key.lowercase()) {
                "a" -> a11y.editorCommand("selectAll")
                "c" -> a11y.editorCommand("copy")
                "x" -> a11y.editorCommand("cut")
                "v" -> a11y.editorCommand("paste")
                "z" -> a11y.editorCommand("undo")
                "y" -> a11y.editorCommand("redo")
            }
            return
        }
        // Alt combos are OS shortcuts on the viewer side, not text to inject.
        if (msg.bool("altKey")) return

        // A single printable char goes through the IME when one is connected — it inserts at
        // the cursor and works in fields where accessibility SET_TEXT corrupts the value.
        // Everything else (Backspace, arrows, Enter…) stays on the accessibility editor path.
        if (key.length == 1 && HostImeService.instance?.commitText(key) == true) return
        a11y.pressKey(key, msg.f("keyCode").toInt(), msg.bool("shiftKey"))
    }

    /** IME first (works everywhere), accessibility as the fallback when no field is connected. */
    private fun injectText(text: String, a11y: HostAccessibilityService) {
        if (HostImeService.instance?.commitText(text) == true) return
        a11y.injectText(text)
    }

    // --- wheel ---------------------------------------------------------------------------

    private fun accumulateWheel(msg: JsonObject) {
        if (wheelAnchor == null) {
            wheelAnchor = msg.f("x").clamp01() to msg.f("y").clamp01()
        }
        // Negated: a positive wheel delta scrolls content DOWN, which is a finger moving UP.
        wheelAccumY += -msg.f("deltaY") / WHEEL_DIVISOR
        wheelAccumX += -msg.f("deltaX") / WHEEL_DIVISOR
        if (!wheelFlushScheduled) {
            wheelFlushScheduled = true
            handler.postDelayed(::flushWheel, WHEEL_FLUSH_MS)
        }
    }

    private fun flushWheel() {
        wheelFlushScheduled = false
        val anchor = wheelAnchor ?: return
        val dx = wheelAccumX
        val dy = wheelAccumY
        wheelAccumX = 0f
        wheelAccumY = 0f
        wheelAnchor = null
        val a11y = service ?: return

        // Duration scales with distance so a big flick isn't crammed into a tiny stroke (which
        // Android reads as a fling) — but stays short so strokes can't queue up.
        if (abs(dy) >= abs(dx) && abs(dy) > WHEEL_MIN_DELTA) {
            val target = (anchor.second + dy.coerceIn(-0.6f, 0.6f)).clamp01()
            val duration = (abs(dy) * 220f).toLong().coerceIn(60, 140)
            a11y.swipe(anchor.first, anchor.second, anchor.first, target, duration)
        } else if (abs(dx) > WHEEL_MIN_DELTA) {
            val target = (anchor.first + dx.coerceIn(-0.6f, 0.6f)).clamp01()
            val duration = (abs(dx) * 220f).toLong().coerceIn(60, 140)
            a11y.swipe(anchor.first, anchor.second, target, anchor.second, duration)
        } else {
            // A high-resolution wheel whose accumulated delta never reaches the threshold
            // would otherwise silently produce nothing.
            Log.d(TAG, "wheel below threshold dx=$dx dy=$dy")
        }
    }

    // --- navigation strip -------------------------------------------------------------------

    /**
     * The bottom strip stands in for Android's navigation bar — except on the lock screen,
     * where the keyguard's PIN pad runs to the bottom edge. Swallowing those taps as
     * Back/Home/Recents (which the keyguard ignores anyway) would make the pad's last row
     * untappable, so the PIN could never be entered remotely.
     */
    private fun routeNavigationTap(x: Float, y: Float): Boolean {
        if (screenLocked) return false
        val a11y = service ?: return false
        if (a11y.isKeyguardActive()) return false
        if (y < NAV_STRIP_TOP) return false
        return when {
            x < 0.33f -> a11y.globalAction(GLOBAL_ACTION_RECENTS)
            x > 0.67f -> a11y.globalAction(GLOBAL_ACTION_BACK)
            else -> a11y.globalAction(GLOBAL_ACTION_HOME)
        }
    }

    // --- json helpers -------------------------------------------------------------------------

    private fun JsonObject.str(key: String): String? =
        (this[key] as? JsonPrimitive)?.takeIf { it.isString || it.content != "null" }?.content

    private fun JsonObject.f(key: String): Float =
        (this[key] as? JsonPrimitive)?.content?.toFloatOrNull() ?: 0f

    private fun JsonObject.bool(key: String): Boolean =
        (this[key] as? JsonPrimitive)?.content?.toBoolean() ?: false

    private fun Float.clamp01(): Float = coerceIn(0f, 1f)

    /**
     * Coordinate readers that fall back to the last known position instead of 0. An absent
     * key and a genuine 0.0 must not be confused: 0 is the top-left corner, and silently
     * tapping there on every coordinate-less event looks exactly like broken input.
     */
    private fun JsonObject.x(fallback: Float): Float =
        if (containsKey("x")) f("x").clamp01() else fallback

    private fun JsonObject.y(fallback: Float): Float =
        if (containsKey("y")) f("y").clamp01() else fallback

    private companion object {
        const val TAG = "InputRouter"

        /** Logs every inbound input message. Debug builds only — this is high volume. */
        val VERBOSE = ai.remote365.host.BuildConfig.DEBUG
        const val DRAG_START_DISTANCE = 0.02f
        const val DRAG_SEND_INTERVAL_MS = 16L
        const val TAP_SLOP = 0.035f

        /**
         * Hold ≥ this (ms) with no movement → dispatch a long-press instead of a tap. Android's
         * long-press timeout is ~400ms; 350 is just under it so a deliberate hold reliably lands,
         * while a normal click (well under 200ms) never does. Capped so a viewer that pauses on a
         * key doesn't dispatch a multi-second stroke that blocks the gesture queue.
         */
        const val LONG_PRESS_MS = 350L
        const val LONG_PRESS_DISPATCH_MIN = 600L
        const val MAX_LONG_PRESS_MS = 1200L
        const val WHEEL_FLUSH_MS = 32L

        /**
         * Wheel delta -> screen fraction. Higher divides more, so scrolling is slower.
         *
         * 150 (inherited from the RN host) overshot badly on this screen: a browser wheel
         * notch is ~100-120px, so one notch travelled ~0.8 of the screen and a normal scroll
         * flew past everything. 420 puts one notch at roughly a quarter screen, which tracks
         * how the phone behaves under a real finger.
         */
        const val WHEEL_DIVISOR = 420f
        const val WHEEL_MIN_DELTA = 0.005f
        const val NAV_STRIP_TOP = 0.925f

        val POINTER_TYPES = setOf(
            "mousedown", "touch-start", "mouseup", "touch-end", "tap", "swipe", "wheel",
        )

        val MODIFIER_KEYS = setOf(
            "Control", "Shift", "Alt", "Meta", "OS", "CapsLock", "AltGraph", "Dead",
        )

        const val GLOBAL_ACTION_BACK = 1
        const val GLOBAL_ACTION_HOME = 2
        const val GLOBAL_ACTION_RECENTS = 3
    }
}
