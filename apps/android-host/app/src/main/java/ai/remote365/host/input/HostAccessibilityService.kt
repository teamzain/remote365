package ai.remote365.host.input

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityService.GestureResultCallback
import android.accessibilityservice.GestureDescription
import android.app.KeyguardManager
import android.content.Context
import android.graphics.Path
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * Input injection primitives. `dispatchGesture` is the only non-privileged route on Android.
 *
 * Behaviour here deliberately mirrors the proven RN host (RemoteLinkAccessibilityService) —
 * the constants and the continueStroke chaining were tuned against real devices, and drifting
 * from them reintroduces the stutter and dead-drag bugs that were already fixed once.
 *
 * Viewer coordinates are normalised 0.0-1.0 and scaled here, so the viewer never needs to know
 * the device resolution or rotation.
 */
class HostAccessibilityService : AccessibilityService() {

    private var currentStroke: GestureDescription.StrokeDescription? = null
    private var lastX = 0f
    private var lastY = 0f
    private var cachedScreenSize: Pair<Int, Int>? = null

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        val (rw, rh) = realScreenSize()
        val dm = resources.displayMetrics
        Log.i(
            TAG,
            "connected; realScreen=${rw}x$rh displayMetrics=${dm.widthPixels}x${dm.heightPixels}",
        )
    }

    override fun onDestroy() {
        if (instance === this) instance = null
        super.onDestroy()
    }

    /**
     * Tracks the most recent text SELECTION.
     *
     * Android 10+ blocks background apps from reading the clipboard, so "copy on the phone,
     * paste on the desktop" cannot be done by reading the clip. What we CAN see is the text the
     * user selected just before they hit Copy — so that selection is what gets published to the
     * viewer's clipboard.
     *
     * `event.source` is a BLOCKING IPC into the app that produced the event, so it is only
     * touched for the two event types that can actually change a selection. Calling it for every
     * event would block this thread on a round trip before our own taps could dispatch.
     */
    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        val e = event ?: return
        if (e.eventType != AccessibilityEvent.TYPE_VIEW_TEXT_SELECTION_CHANGED &&
            e.eventType != AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED
        ) {
            return
        }
        runCatching {
            val node = e.source ?: return
            val value = node.text?.toString() ?: return
            if (value.isEmpty()) return
            val start = node.textSelectionStart
            val end = node.textSelectionEnd
            if (start < 0 || end < 0 || start == end) return
            val from = minOf(start, end).coerceIn(0, value.length)
            val to = maxOf(start, end).coerceIn(0, value.length)
            if (from == to) return
            lastSelectedText = value.substring(from, to)
        }
    }

    /** Most recent non-empty selection seen on the phone; "" when nothing was selected. */
    @Volatile
    var lastSelectedText: String = ""
        private set

    override fun onInterrupt() = Unit

    // --- geometry ---------------------------------------------------------------------

    /**
     * Real screen size in physical pixels.
     *
     * NOT `resources.displayMetrics`: for a Service context on Android 11+ that reports the
     * app's own configuration, which differs from the real display whenever a density
     * override is set (Settings > Display > Screen zoom — common on Samsung). Gestures are
     * dispatched in true screen pixels, so scaling by the wrong size sends every tap to the
     * wrong place, and the failure looks like "input is dead" rather than "input is offset".
     */
    private fun realScreenSize(): Pair<Int, Int> {
        cachedScreenSize?.let { return it }
        val wm = getSystemService(Context.WINDOW_SERVICE) as android.view.WindowManager
        val size = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val bounds = wm.currentWindowMetrics.bounds
            bounds.width() to bounds.height()
        } else {
            @Suppress("DEPRECATION")
            val metrics = android.util.DisplayMetrics().also { wm.defaultDisplay.getRealMetrics(it) }
            metrics.widthPixels to metrics.heightPixels
        }
        cachedScreenSize = size
        return size
    }

    private fun toScreen(xRatio: Float, yRatio: Float): Pair<Float, Float> {
        val (width, height) = realScreenSize()
        return Pair(
            (xRatio * width).coerceIn(0f, width - 1f),
            (yRatio * height).coerceIn(0f, height - 1f),
        )
    }

    private val gestureResult = object : GestureResultCallback() {
        override fun onCancelled(gestureDescription: GestureDescription?) {
            // A cancelled stroke can never be continued. Keeping the reference would make the
            // next updateDrag build an invalid continuation, which Android REJECTS outright and
            // that kills all further input for the session.
            currentStroke = null
            Log.w(TAG, "gesture CANCELLED")
        }
    }

    private fun dispatchStroke(stroke: GestureDescription.StrokeDescription) {
        runCatching {
            val gesture = GestureDescription.Builder().addStroke(stroke).build()
            val accepted = dispatchGesture(gesture, gestureResult, null)
            if (!accepted) {
                // By far the most common cause is a sleeping display: Android refuses to
                // dispatch gestures to a non-interactive screen and returns false with no
                // other signal. Say so explicitly rather than leaving a bare failure.
                val power = getSystemService(Context.POWER_SERVICE) as? android.os.PowerManager
                val interactive = power?.isInteractive
                Log.w(
                    TAG,
                    "dispatchGesture REJECTED (screenInteractive=$interactive" +
                        "${if (interactive == false) " <- screen is asleep" else ""})",
                )
            }
        }.onFailure { Log.w(TAG, "dispatchStroke failed: ${it.message}") }
    }

    // --- discrete gestures -------------------------------------------------------------

    fun tap(normX: Float, normY: Float, durationMs: Long = TAP_DURATION_MS) {
        // Drop any stale continuation state. Do NOT try to "close" it by dispatching another
        // continueStroke: once the previous stroke has finished, that produces an INVALID
        // gesture which Android rejects outright (dispatchGesture -> false), killing all input.
        currentStroke = null
        val (x, y) = toScreen(normX, normY)
        // The lineTo to the SAME point is required, not redundant: a moveTo-only path has
        // zero contours, and StrokeDescription treats it as empty — Android then cancels the
        // gesture with no error, so every tap silently does nothing.
        val path = Path().apply {
            moveTo(x, y)
            lineTo(x, y)
        }
        dispatchStroke(GestureDescription.StrokeDescription(path, 0, durationMs))
    }

    fun swipe(
        startX: Float,
        startY: Float,
        endX: Float,
        endY: Float,
        durationMs: Long = 180,
    ) {
        val (sx, sy) = toScreen(startX, startY)
        val (ex, ey) = toScreen(endX, endY)
        val path = Path().apply {
            moveTo(sx, sy)
            // Guard the degenerate case: a swipe whose start and end round to the same pixel
            // would otherwise build an empty path and be cancelled like the tap bug above.
            if (sx == ex && sy == ey) lineTo(ex, ey + 1f) else lineTo(ex, ey)
        }
        dispatchStroke(GestureDescription.StrokeDescription(path, 0, durationMs))
    }

    // --- continuous drag ----------------------------------------------------------------
    // A remote drag is a CHAIN of short strokes, each continuing the previous via
    // continueStroke(). That is what makes Android treat them as one unbroken finger rather
    // than a burst of unrelated gestures.

    fun startDrag(normX: Float, normY: Float) {
        val (x, y) = toScreen(normX, normY)
        lastX = x
        lastY = y
        val path = Path().apply {
            moveTo(x, y)
            lineTo(x, y)
        }
        val stroke = GestureDescription.StrokeDescription(path, 0, GESTURE_SEGMENT_MS, true)
        currentStroke = stroke
        dispatchStroke(stroke)
    }

    fun updateDrag(normX: Float, normY: Float) {
        val previous = currentStroke ?: return
        val (x, y) = toScreen(normX, normY)
        // Segment ONLY: continueStroke requires the new path to begin where the last ended.
        val path = Path().apply {
            moveTo(lastX, lastY)
            lineTo(x, y)
        }
        // continueStroke throws if the previous stroke already ended; drop the drag rather
        // than letting the exception escape and leave input permanently wedged.
        val stroke = runCatching {
            previous.continueStroke(path, 0, GESTURE_SEGMENT_MS, true)
        }.getOrElse {
            Log.w(TAG, "continueStroke rejected: ${it.message}")
            currentStroke = null
            return
        }
        currentStroke = stroke
        dispatchStroke(stroke)
        lastX = x
        lastY = y
    }

    fun endDrag(normX: Float, normY: Float) {
        val previous = currentStroke ?: return
        val (x, y) = toScreen(normX, normY)
        val path = Path().apply {
            moveTo(lastX, lastY)
            lineTo(x, y)
        }
        // willContinue = false closes the chain and lifts the finger.
        dispatchStroke(previous.continueStroke(path, 0, GESTURE_SEGMENT_MS, false))
        currentStroke = null
        lastX = x
        lastY = y
    }

    fun isDragging(): Boolean = currentStroke != null


    // --- Self-Pair: read the wireless-debugging pairing dialog ---------------------------------
    // The "Pair device with pairing code" dialog shows the 6-digit code and the IP:port as plain
    // text nodes (proven readable — uiautomator, an accessibility client, dumps them). Reading them
    // here lets Self-Pair grab the code itself, so the user never types or navigates back.

    /**
     * Scan the visible windows for the wireless-debugging pairing dialog and pull its 6-digit code
     * and IP:port. Returns null until both are on screen together. Requires this service to already
     * be enabled — at first-run the user enables it before opening the dialog.
     */
    fun readPairingInfo(): PairingInfo? {
        // Scan window by window and require the code AND the IP:port to come from the SAME subtree.
        // Flattening every window into one list is a trap: the Wireless debugging screen *behind*
        // the dialog also shows an "IP address and port", but that is the long-lived **connect**
        // port — not the one-shot **pairing** port in the dialog. Pairing the dialog's code against
        // the connect port is refused by adbd as "connection closed", and because the code on screen
        // never changes the watch then retries nothing.
        val roots = mutableListOf<AccessibilityNodeInfo>()
        rootInActiveWindow?.let(roots::add)
        runCatching { windows }.getOrNull()?.forEach { w ->
            runCatching { w.root }.getOrNull()?.let(roots::add)
        }
        for (root in roots) {
            val texts = mutableListOf<String>()
            collectTexts(root, texts, 0)
            // Only the pairing dialog carries a bare 6-digit code, so its presence identifies it.
            val code = texts.map { it.trim() }.firstOrNull { CODE.matches(it) } ?: continue
            val ipPort = texts.firstNotNullOfOrNull { IP_PORT.find(it.trim()) } ?: continue
            val port = ipPort.groupValues[2].toIntOrNull() ?: continue
            return PairingInfo(code, ipPort.groupValues[1], port)
        }
        return null
    }

    private fun collectTexts(node: AccessibilityNodeInfo?, out: MutableList<String>, depth: Int) {
        val current = node ?: return
        if (depth > 40) return
        current.text?.toString()?.takeIf { it.isNotBlank() }?.let { out.add(it) }
        current.contentDescription?.toString()?.takeIf { it.isNotBlank() }?.let { out.add(it) }
        for (index in 0 until current.childCount) collectTexts(current.getChild(index), out, depth + 1)
    }

    /**
     * Pull the setup wizard back to the foreground. Called the instant the code is read off the
     * pairing dialog, so the user sees pairing progress instead of being stranded in Settings.
     * An accessibility service is exempt from the background-activity-launch restrictions that
     * would otherwise block this, and SelfPairActivity is same-app so exported=false is fine.
     */
    fun bringWizardToFront() {
        runCatching {
            val intent = android.content.Intent(this, ai.remote365.host.ui.OnboardingActivity::class.java)
                .addFlags(
                    android.content.Intent.FLAG_ACTIVITY_NEW_TASK or
                        android.content.Intent.FLAG_ACTIVITY_SINGLE_TOP or
                        android.content.Intent.FLAG_ACTIVITY_REORDER_TO_FRONT,
                )
            startActivity(intent)
        }.onFailure { Log.w(TAG, "bringWizardToFront failed: ${it.message}") }
    }

    fun globalAction(action: Int): Boolean = performGlobalAction(action)

    /** Return to the home screen — used after Self-Pair so an operator never lands on Settings. */
    fun goHome(): Boolean = runCatching { performGlobalAction(GLOBAL_ACTION_HOME) }.getOrDefault(false)

    /**
     * Best-effort: click the Settings *row* whose label contains [substr] (e.g. "Wireless
     * debugging", "Pair device with pairing code"). Walks up to the clickable ancestor, so it opens
     * the row rather than toggling a switch, and only acts inside a Settings window. Returns true if
     * it clicked something — used to auto-navigate the user to the pairing dialog.
     */
    fun tapRowByText(substr: String): Boolean {
        val root = rootInActiveWindow ?: return false
        if (root.packageName?.toString()?.lowercase()?.contains("settings") != true) return false
        val node = findNodeContaining(root, substr, 0) ?: return false
        return clickNodeOrParent(node)
    }

    /**
     * Tap "Pair device with pairing code" for the user IF it is already on screen — never scroll.
     *
     * We deliberately do NOT auto-scroll. The row's own text is what we match, and it exists only on
     * the Wireless debugging detail screen; a "Wireless debugging" guard is useless because the
     * Developer options list also carries a row by that name, so scrolling there churned the page
     * under the user's finger looking for a row that isn't on it. Matching the exact row text means
     * this fires only on the real screen, and only when the row is visible — the user scrolls the
     * Settings list themselves, and the instant the row appears we open it.
     *
     * Only called while the dialog is closed; tapping with it open would dismiss it and remint the
     * code. Returns true once the row has been clicked.
     */
    fun openPairingDialog(): Boolean {
        val root = rootInActiveWindow ?: return false
        if (root.packageName?.toString()?.lowercase()?.contains("settings") != true) return false
        val node = findNodeContaining(root, "Pair device with pairing code", 0) ?: return false
        return clickNodeOrParent(node)
    }

    /** True if any node in the active window contains [substr] — used to tell which Settings
     *  screen we're on ("USB debugging" ⇒ Developer options; "Pair device…" ⇒ Wireless debugging). */
    fun hasText(substr: String): Boolean {
        val root = rootInActiveWindow ?: return false
        return findNodeContaining(root, substr, 0) != null
    }

    private fun findNodeContaining(
        node: AccessibilityNodeInfo?,
        substr: String,
        depth: Int,
    ): AccessibilityNodeInfo? {
        val current = node ?: return null
        if (depth > 40) return null
        current.text?.toString()?.let { if (it.contains(substr, ignoreCase = true)) return current }
        current.contentDescription?.toString()
            ?.let { if (it.contains(substr, ignoreCase = true)) return current }
        for (index in 0 until current.childCount) {
            findNodeContaining(current.getChild(index), substr, depth + 1)?.let { return it }
        }
        return null
    }

    fun isKeyguardActive(): Boolean {
        val km = getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager ?: return false
        return km.isKeyguardLocked
    }

    fun isKeyguardSecure(): Boolean {
        val km = getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager ?: return false
        return km.isKeyguardSecure
    }

    // --- keyguard PIN pad ----------------------------------------------------------------
    // The PIN pad is FLAG_SECURE, so MediaProjection captures it black — the operator types
    // blind. These click the pad buttons by their label so the phone can still be unlocked
    // remotely. The digit sits on the BUTTON's contentDescription; the node whose `text` is
    // the digit is only a non-clickable label, so we must walk up to the real button.

    fun pressKeyguardKey(label: String): Boolean =
        clickKeyguardNode { it.equals(label, ignoreCase = true) }

    fun pressKeyguardDelete(): Boolean =
        clickKeyguardNode { it.startsWith("DELETE", ignoreCase = true) }

    private fun clickKeyguardNode(matches: (String) -> Boolean): Boolean {
        val root = rootInActiveWindow ?: return false
        // Only ever act on the system keyguard, never a normal app screen.
        if (root.packageName?.toString()?.lowercase()?.contains("systemui") != true) return false
        val target = findNodeByLabel(root, matches, 0) ?: return false
        return clickNodeOrParent(target)
    }

    private fun findNodeByLabel(
        node: AccessibilityNodeInfo?,
        matches: (String) -> Boolean,
        depth: Int,
    ): AccessibilityNodeInfo? {
        val current = node ?: return null
        if (depth > 24) return null
        current.contentDescription?.toString()?.trim()?.takeIf { it.isNotEmpty() }
            ?.let { if (matches(it)) return current }
        current.text?.toString()?.trim()?.takeIf { it.isNotEmpty() }
            ?.let { if (matches(it)) return current }
        for (index in 0 until current.childCount) {
            findNodeByLabel(current.getChild(index), matches, depth + 1)?.let { return it }
        }
        return null
    }

    private fun clickNodeOrParent(node: AccessibilityNodeInfo?): Boolean {
        var current = node
        var depth = 0
        while (current != null && depth < 4) {
            if (current.isClickable && current.isEnabled) {
                return current.performAction(AccessibilityNodeInfo.ACTION_CLICK)
            }
            current = current.parent
            depth += 1
        }
        return false
    }

    // --- text -----------------------------------------------------------------------------

    fun injectText(text: String) = replaceSelection(text)

    /**
     * Printable characters are ALWAYS injected as text — never "click the button whose label
     * matches". On a T9 dialer that turned a typed "A" into a "2".
     */
    fun pressKey(key: String, keyCode: Int, shift: Boolean) {
        // Keyguard FIRST: on the lock screen there is no editable field, the only thing that
        // accepts input is the PIN pad. Enter/Backspace especially must be caught here before
        // the editor arms below return early. Only a SECURE keyguard has a pad to type into.
        if (isKeyguardActive() && isKeyguardSecure()) {
            val handled = when {
                key.length == 1 && key[0].isDigit() -> pressKeyguardKey(key)
                key == "Enter" || key == "NumpadEnter" -> pressKeyguardKey("OK") ||
                    pressKeyguardKey("Enter")
                key == "Backspace" || key == "Delete" -> pressKeyguardDelete()
                else -> false
            }
            if (handled) return
        }
        // Prefer the IME for editing keys too — key events reach fields (calculator, custom
        // views) that the accessibility editor path cannot touch. Fall through if unconnected.
        val ime = HostImeService.instance
        if (ime?.hasConnection() == true) {
            val code = when (key) {
                "Backspace" -> android.view.KeyEvent.KEYCODE_DEL
                "Delete" -> android.view.KeyEvent.KEYCODE_FORWARD_DEL
                "Enter", "NumpadEnter" -> android.view.KeyEvent.KEYCODE_ENTER
                "Tab" -> android.view.KeyEvent.KEYCODE_TAB
                "ArrowLeft" -> android.view.KeyEvent.KEYCODE_DPAD_LEFT
                "ArrowRight" -> android.view.KeyEvent.KEYCODE_DPAD_RIGHT
                "ArrowUp" -> android.view.KeyEvent.KEYCODE_DPAD_UP
                "ArrowDown" -> android.view.KeyEvent.KEYCODE_DPAD_DOWN
                else -> 0
            }
            if (code != 0 && ime.sendKey(code)) return
        }

        when (key) {
            "Backspace" -> { editorCommand("backspace"); return }
            "Delete" -> { editorCommand("delete"); return }
            "Enter", "NumpadEnter" -> { editorCommand("enter"); return }
            "Tab" -> { editorCommand("tab"); return }
            "Escape" -> { editorCommand("escape"); return }
            "ArrowLeft" -> { moveSelection(-1, shift); return }
            "ArrowRight" -> { moveSelection(1, shift); return }
            "ArrowUp" -> { editorCommand("arrowup"); return }
            "ArrowDown" -> { editorCommand("arrowdown"); return }
            "Home" -> { editorCommand("home"); return }
            "End" -> { editorCommand("end"); return }
        }
        if (key.length == 1) {
            injectText(key)
            return
        }
        // Numeric fallback for senders that only fill keyCode. These are Windows VK codes
        // (== JS keyCode for non-printables) — Android keycodes must NEVER be matched here,
        // they collide with VK letter codes.
        when (keyCode) {
            8 -> editorCommand("backspace")
            46 -> editorCommand("delete")
            13 -> editorCommand("enter")
            9 -> editorCommand("tab")
            27 -> editorCommand("escape")
            37 -> moveSelection(-1, shift)
            39 -> moveSelection(1, shift)
            38 -> editorCommand("arrowup")
            40 -> editorCommand("arrowdown")
            36 -> editorCommand("home")
            35 -> editorCommand("end")
        }
    }

    fun editorCommand(command: String) {
        val normalized = command.lowercase()
        if (normalized == "escape" || normalized == "back") {
            performGlobalAction(GLOBAL_ACTION_BACK)
            return
        }
        val node = editableFocus() ?: return
        when (normalized) {
            "backspace" -> deleteAroundSelection(backward = true)
            "delete" -> deleteAroundSelection(backward = false)
            "enter" -> replaceSelection("\n")
            "tab" -> replaceSelection("\t")
            "arrowleft" -> moveSelection(-1, false)
            "arrowright" -> moveSelection(1, false)
            "arrowup" -> node.performAction(
                AccessibilityNodeInfo.ACTION_PREVIOUS_AT_MOVEMENT_GRANULARITY, movementArgs(),
            )
            "arrowdown" -> node.performAction(
                AccessibilityNodeInfo.ACTION_NEXT_AT_MOVEMENT_GRANULARITY, movementArgs(),
            )
            "home" -> selectRange(0, 0)
            "end" -> editableText(node).length.let { selectRange(it, it) }
            "selectall" -> selectRange(0, editableText(node).length)
            "copy" -> node.performAction(AccessibilityNodeInfo.ACTION_COPY)
            "cut" -> node.performAction(AccessibilityNodeInfo.ACTION_CUT)
            "paste" -> node.performAction(AccessibilityNodeInfo.ACTION_PASTE)
            // Accessibility has no universal undo/redo action for arbitrary apps.
            "undo", "redo" -> Unit
        }
    }

    private fun movementArgs() = Bundle().apply {
        putInt(
            AccessibilityNodeInfo.ACTION_ARGUMENT_MOVEMENT_GRANULARITY_INT,
            AccessibilityNodeInfo.MOVEMENT_GRANULARITY_LINE,
        )
    }

    private fun editableFocus(): AccessibilityNodeInfo? =
        rootInActiveWindow?.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)?.takeIf { it.isEditable }

    /** Hint text is reported as `text` on empty fields; treating it as content duplicates it. */
    private fun editableText(node: AccessibilityNodeInfo): String {
        val value = node.text?.toString() ?: ""
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val hint = node.hintText?.toString()
            if (!hint.isNullOrEmpty() && value == hint) return ""
        }
        return value
    }

    private fun selection(node: AccessibilityNodeInfo, length: Int): Pair<Int, Int> {
        val rawStart = node.textSelectionStart
        val rawEnd = node.textSelectionEnd
        val start = if (rawStart >= 0) rawStart.coerceIn(0, length) else length
        val end = if (rawEnd >= 0) rawEnd.coerceIn(0, length) else start
        return minOf(start, end) to maxOf(start, end)
    }

    private fun setEditableText(node: AccessibilityNodeInfo, text: String, cursor: Int) {
        val args = Bundle().apply {
            putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
        }
        node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
        selectRange(cursor, cursor)
    }

    private fun replaceSelection(inserted: String) {
        val node = editableFocus() ?: return
        val current = editableText(node)
        val (start, end) = selection(node, current.length)
        val next = current.substring(0, start) + inserted + current.substring(end)
        setEditableText(node, next, start + inserted.length)
    }

    private fun deleteAroundSelection(backward: Boolean) {
        val node = editableFocus() ?: return
        val current = editableText(node)
        val (start, end) = selection(node, current.length)
        if (start != end) {
            setEditableText(node, current.removeRange(start, end), start)
            return
        }
        if (backward) {
            if (start == 0) return
            setEditableText(node, current.removeRange(start - 1, start), start - 1)
        } else {
            if (end >= current.length) return
            setEditableText(node, current.removeRange(end, end + 1), start)
        }
    }

    private fun moveSelection(delta: Int, extend: Boolean) {
        val node = editableFocus() ?: return
        val current = editableText(node)
        val (start, end) = selection(node, current.length)
        val anchor = if (delta < 0) start else end
        val target = (anchor + delta).coerceIn(0, current.length)
        if (extend) selectRange(minOf(start, target), maxOf(end, target))
        else selectRange(target, target)
    }

    private fun selectRange(start: Int, end: Int) {
        val node = editableFocus() ?: return
        val args = Bundle().apply {
            putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_START_INT, start)
            putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_END_INT, end)
        }
        node.performAction(AccessibilityNodeInfo.ACTION_SET_SELECTION, args)
    }

    companion object {
        private const val TAG = "HostA11y"

        /** IP:port and the standalone 6-digit code as shown on the pairing dialog. */
        private val IP_PORT = Regex("""(\d{1,3}(?:\.\d{1,3}){3}):(\d{2,5})""")
        private val CODE = Regex("""\d{6}""")

        /** Android registers a tap far below its 100ms timeout; longer is pure added latency. */
        const val TAP_DURATION_MS = 25L

        /**
         * Length of each drag segment. Must comfortably exceed the viewer's send interval so
         * consecutive segments overlap slightly and the stroke never starves between updates,
         * which would read as a stutter.
         */
        private const val GESTURE_SEGMENT_MS = 40L

        @Volatile
        var instance: HostAccessibilityService? = null
            private set
    }
}

/** The 6-digit code and endpoint read off the wireless-debugging pairing dialog. */
data class PairingInfo(val code: String, val host: String, val port: Int)
