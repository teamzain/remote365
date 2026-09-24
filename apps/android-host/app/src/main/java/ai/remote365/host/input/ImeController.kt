package ai.remote365.host.input

import android.content.Context
import android.provider.Settings
import android.util.Log
import android.view.inputmethod.InputMethodManager

/**
 * Switches the device to the headless host IME for the duration of a remote session, then puts
 * the user's own keyboard back.
 *
 * The host IME is what makes typing work in every field (see [HostImeService]), but it renders
 * no keys — so leaving it active would strip the LOCAL user of a usable keyboard. Scoping the
 * switch to an active session keeps the phone normal when nobody is connected.
 *
 * Requires WRITE_SECURE_SETTINGS (granted over ADB in provisioning). The IME must ALSO be
 * enabled first — provisioning runs `ime enable` — because on targetSdk 34+ the
 * ENABLED_INPUT_METHODS secure setting is no longer app-readable, so we can neither read nor
 * safely rewrite it here. We only ever flip DEFAULT_INPUT_METHOD, checking "enabled" through
 * InputMethodManager instead.
 */
class ImeController(private val context: Context) {

    /**
     * Resolved from the system's own list rather than built by hand: the platform may report
     * the id in abbreviated form ("pkg/.input.HostImeService") while the class name is fully
     * qualified ("pkg/pkg.input.HostImeService"). Comparing the two as strings silently fails,
     * which made activateForSession() think the IME was never enabled.
     */
    private val hostImeFallback = "${context.packageName}/${HostImeService::class.java.name}"
    private var previousIme: String? = null

    private val hostIme: String
        get() = resolveHostImeId() ?: hostImeFallback

    private fun resolveHostImeId(): String? {
        val imm = context.getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
            ?: return null
        return imm.enabledInputMethodList
            .firstOrNull { it.packageName == context.packageName }
            ?.id
    }

    fun activateForSession() {
        if (!canWrite()) {
            Log.w(TAG, "WRITE_SECURE_SETTINGS not held; leaving keyboard as-is")
            return
        }
        if (!isHostImeEnabled()) {
            // Not enabled means provisioning didn't run `ime enable`. Don't try to enable it
            // here — the enabled list is unreadable on targetSdk 34+ — just fall back to the
            // accessibility typing path.
            Log.w(TAG, "host IME not enabled; run provisioning. Falling back to a11y typing.")
            return
        }
        val current = currentDefaultIme()
        if (current == hostIme) return // already ours (e.g. dedicated host device)
        previousIme = current
        if (setDefaultIme(hostIme)) Log.i(TAG, "host IME activated (was $current)")
    }

    fun restoreAfterSession() {
        val prev = previousIme ?: return
        previousIme = null
        if (!canWrite()) return
        if (currentDefaultIme() != hostIme) return // user already changed it; don't fight them
        if (setDefaultIme(prev)) Log.i(TAG, "restored keyboard to $prev")
    }

    /** Match on PACKAGE, not on a hand-built id string — see [resolveHostImeId]. */
    private fun isHostImeEnabled(): Boolean = resolveHostImeId() != null

    /** DEFAULT_INPUT_METHOD is still app-readable (unlike ENABLED_INPUT_METHODS). */
    private fun currentDefaultIme(): String? = runCatching {
        Settings.Secure.getString(context.contentResolver, Settings.Secure.DEFAULT_INPUT_METHOD)
    }.getOrNull()

    private fun setDefaultIme(id: String): Boolean = runCatching {
        Settings.Secure.putString(
            context.contentResolver, Settings.Secure.DEFAULT_INPUT_METHOD, id,
        )
    }.onFailure { Log.e(TAG, "setDefaultIme failed", it) }.isSuccess

    private fun canWrite(): Boolean = context.checkSelfPermission(
        android.Manifest.permission.WRITE_SECURE_SETTINGS,
    ) == android.content.pm.PackageManager.PERMISSION_GRANTED

    private companion object {
        const val TAG = "ImeController"
    }
}
