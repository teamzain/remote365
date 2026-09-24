package ai.remote365.host.input

import android.inputmethodservice.InputMethodService
import android.inputmethodservice.InputMethodService.Insets
import android.util.Log
import android.view.KeyEvent
import android.view.View

/**
 * A headless input method — the reliable path for "typing works everywhere".
 *
 * `AccessibilityNodeInfo.ACTION_SET_TEXT` reads the field's current text, edits it, and writes
 * it back. That breaks against any field that reports a label instead of its value: the Samsung
 * calculator's EditText reports "Calculator input field 0", so appending a digit produces
 * nonsense and the calculator shows "invalid format".
 *
 * An IME instead injects through `InputConnection.commitText`, which inserts at the cursor
 * without ever reading the field — so it behaves exactly like the real keyboard in the
 * calculator, browsers, chat apps, and anything else with a genuine input connection.
 *
 * It renders no keyboard: on a remote-controlled host the operator supplies the keystrokes, and
 * a visible keyboard would only cover the screen they are trying to see.
 */
class HostImeService : InputMethodService() {

    override fun onCreate() {
        super.onCreate()
        instance = this
        Log.i(TAG, "IME created")
    }

    override fun onDestroy() {
        if (instance === this) instance = null
        super.onDestroy()
    }

    override fun onStartInput(info: android.view.inputmethod.EditorInfo?, restarting: Boolean) {
        super.onStartInput(info, restarting)
        Log.d(TAG, "onStartInput pkg=${info?.packageName} connected=${currentInputConnection != null}")
    }

    /**
     * No input view at all.
     *
     * Returning a real View made apps reserve (and resize for) a keyboard window that draws
     * nothing — the large blank slab under a focused text field. Returning null plus
     * onEvaluateInputViewShown=false means the app lays out as if no keyboard is open, which is
     * what a remote operator wants: the whole screen stays visible.
     */
    override fun onCreateInputView(): View? = null

    override fun onEvaluateInputViewShown(): Boolean = false

    override fun onEvaluateFullscreenMode(): Boolean = false

    /** Never let the (non-existent) keyboard window take space. */
    override fun onComputeInsets(outInsets: Insets?) {
        super.onComputeInsets(outInsets)
        outInsets?.apply {
            contentTopInsets = window?.window?.decorView?.height ?: 0
            visibleTopInsets = contentTopInsets
            touchableInsets = Insets.TOUCHABLE_INSETS_CONTENT
        }
    }

    /** @return true if an input connection was available and the text was committed. */
    fun commitText(text: String): Boolean {
        val ic = currentInputConnection ?: return false
        return ic.commitText(text, 1)
    }

    fun sendKey(keyCode: Int): Boolean {
        val ic = currentInputConnection ?: return false
        val now = android.os.SystemClock.uptimeMillis()
        ic.sendKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_DOWN, keyCode, 0))
        ic.sendKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_UP, keyCode, 0))
        return true
    }

    /** True when a field is focused and we can actually inject — i.e. the IME is usable now. */
    fun hasConnection(): Boolean = currentInputConnection != null

    /**
     * Reads the system clipboard. Android 10+ only lets the FOREGROUND app or the ACTIVE IME
     * read the clipboard; a background service always gets empty. Because this host IME is the
     * active method during a session, reading from HERE succeeds where the service cannot —
     * which is what makes phone->desktop clipboard sync work at all.
     */
    fun readClipboard(): String = runCatching {
        val cm = getSystemService(CLIPBOARD_SERVICE) as? android.content.ClipboardManager
            ?: return@runCatching ""
        val clip = cm.primaryClip ?: return@runCatching ""
        if (clip.itemCount == 0) return@runCatching ""
        clip.getItemAt(0).coerceToText(this).toString()
    }.getOrDefault("")

    companion object {
        private const val TAG = "HostIme"

        @Volatile
        var instance: HostImeService? = null
            private set
    }
}
