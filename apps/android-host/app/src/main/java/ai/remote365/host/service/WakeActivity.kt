package ai.remote365.host.service

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper

/**
 * Turns a fully-off display back on, then gets out of the way so MediaProjection captures the
 * phone's OWN lock screen — including the real PIN pad — rather than our window.
 *
 * Why an Activity and not a wake lock: SCREEN_BRIGHT_WAKE_LOCK/ACQUIRE_CAUSES_WAKEUP have been
 * deprecated since API 17 and are IGNORED on modern Android / One UI. The only supported way for
 * a normal app to light the screen from off is an Activity declaring setTurnScreenOn(true). This
 * was learned the hard way in the RN host; do not "simplify" it back to a wake lock.
 *
 * setShowWhenLocked briefly occludes the keyguard so the screen lights — then we immediately
 * withdraw (moveTaskToBack + clear the flag) so the real keyguard is what gets captured and what
 * remote taps land on. Leaving the flag set keeps our (blank) window in front of the PIN pad.
 */
class WakeActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }
        // Screen is lit now; reveal the real keyguard behind us.
        Handler(Looper.getMainLooper()).postDelayed({
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) setShowWhenLocked(false)
            moveTaskToBack(true)
            finish()
            overridePendingTransition(0, 0)
        }, REVEAL_DELAY_MS)
    }

    companion object {
        private const val REVEAL_DELAY_MS = 700L

        fun wake(context: Context) {
            val intent = Intent(context, WakeActivity::class.java).apply {
                addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_NO_ANIMATION or
                        Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS,
                )
            }
            // Android 14+ blocks a background SERVICE from launching an activity (BAL_BLOCK),
            // which is why waking the screen silently did nothing. An accessibility service is
            // exempt, so start from it when available and fall back to the plain context.
            val a11y = ai.remote365.host.input.HostAccessibilityService.instance
            if (a11y != null) a11y.startActivity(intent) else context.startActivity(intent)
        }
    }
}
