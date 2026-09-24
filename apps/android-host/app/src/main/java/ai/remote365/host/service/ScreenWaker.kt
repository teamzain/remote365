package ai.remote365.host.service

import android.content.Context
import android.os.PowerManager
import android.util.Log

/**
 * Keeps the display awake for a session so MediaProjection captures real frames — not the black
 * secure surface and not the dozing Always-On Display clock.
 *
 * Two mechanisms, because neither alone is enough on One UI:
 *  - A held SCREEN_BRIGHT wake lock KEEPS the screen on once it is on (so it never dozes to the
 *    AOD mid-session, which is what showed the "02 56" clock instead of live video).
 *  - Turning the screen on FROM off is done by [WakeActivity], because the wake-lock's
 *    ACQUIRE_CAUSES_WAKEUP is ignored on modern Android / One UI.
 *
 * Neither dismisses the keyguard: on a locked phone the operator should see the real lock
 * screen and PIN pad and unlock it remotely.
 */
class ScreenWaker(private val context: Context) {

    private val power = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    private var lock: PowerManager.WakeLock? = null

    private val handler = android.os.Handler(android.os.Looper.getMainLooper())
    private var sessionActive = false

    /**
     * Re-assert the wake every few seconds while a session runs.
     *
     * A held SCREEN_BRIGHT lock is not always enough on One UI: the OEM power manager can still
     * doze the display (and the keyguard then engages mid-session, which is the lock screen
     * appearing in the middle of a call). Re-lighting it as soon as it drops is what keeps the
     * session usable without needing the user to touch the phone.
     */
    private val keepAwake = object : Runnable {
        override fun run() {
            if (!sessionActive) return
            if (!power.isInteractive) {
                Log.i(TAG, "display dozed mid-session -> re-waking")
                wakeIfOff()
            }
            handler.postDelayed(this, KEEPALIVE_MS)
        }
    }

    /** Hold the screen on for the whole session, and light it if it is currently off. */
    fun beginSessionAwake() {
        sessionActive = true
        handler.removeCallbacks(keepAwake)
        handler.postDelayed(keepAwake, KEEPALIVE_MS)
        if (lock?.isHeld != true) {
            @Suppress("DEPRECATION")
            val wakeLock = power.newWakeLock(
                PowerManager.SCREEN_BRIGHT_WAKE_LOCK or
                    PowerManager.ACQUIRE_CAUSES_WAKEUP or
                    PowerManager.ON_AFTER_RELEASE,
                WAKE_TAG,
            ).apply { setReferenceCounted(false) }
            runCatching {
                wakeLock.acquire()
                lock = wakeLock
                Log.i(TAG, "session wake lock held (interactive=${power.isInteractive})")
            }.onFailure { Log.w(TAG, "wake lock failed", it) }
        }
        wakeIfOff()
    }

    /**
     * Hold the screen on WITHOUT the re-wake-via-Activity behaviour of [beginSessionAwake]. For
     * Self-Pair: the user is navigating Settings, so launching [WakeActivity] would pop our window
     * over the pair dialog and dismiss it. Just holds the SCREEN_BRIGHT lock (enough while the user
     * is actively there); no auto-relaunch if One UI dozes anyway.
     */
    fun holdScreenOn() {
        if (lock?.isHeld == true) return
        @Suppress("DEPRECATION")
        val wakeLock = power.newWakeLock(
            PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ON_AFTER_RELEASE,
            WAKE_TAG,
        ).apply { setReferenceCounted(false) }
        runCatching {
            wakeLock.acquire(10 * 60 * 1000L)
            lock = wakeLock
            Log.i(TAG, "hold-screen lock held (interactive=${power.isInteractive})")
        }.onFailure { Log.w(TAG, "hold-screen lock failed", it) }
    }

    /** Light the screen from fully off — the Activity path, since the wake lock can't. */
    fun wakeIfOff() {
        if (power.isInteractive) return
        Log.i(TAG, "screen off -> launching WakeActivity")
        WakeActivity.wake(context)
    }

    fun release() {
        sessionActive = false
        handler.removeCallbacks(keepAwake)
        runCatching { lock?.takeIf { it.isHeld }?.release() }
            .onFailure { Log.w(TAG, "wake release failed", it) }
        lock = null
    }

    val isInteractive: Boolean get() = power.isInteractive

    private companion object {
        const val TAG = "ScreenWaker"
        const val WAKE_TAG = "Remote365:session"

        /** Fast enough that a mid-session doze is barely visible to the operator. */
        const val KEEPALIVE_MS = 3_000L
    }
}
