package ai.remote365.host.provisioning.selfpair

import ai.remote365.host.input.HostAccessibilityService
import ai.remote365.host.service.ScreenWaker
import android.content.Context
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/** Where the wizard is in the one-time Self-Pair flow. */
sealed interface SelfPairState {
    /** Explain the three manual taps and deep-link to Developer options. */
    data object Intro : SelfPairState

    /** Scanning mDNS for the pairing port the user just opened. */
    data object Discovering : SelfPairState

    /** Watching in the background for the pairing dialog to open; auto-advances when detected. */
    data object Watching : SelfPairState

    /**
     * Ready for the 6-digit code. [endpoint] is non-null when the port was auto-discovered; when
     * null the user must also type the port shown on the pairing dialog. [suggestedHost] pre-fills
     * the manual host with this device's Wi-Fi IP (loopback is refused on some OEMs).
     */
    data class AwaitingCode(val endpoint: PairingEndpoint?, val suggestedHost: String) : SelfPairState

    /** Pairing → connecting → applying grants. [step] is a short human-readable status. */
    data class Working(val step: String) : SelfPairState

    data class Done(val result: GrantSequence.Result) : SelfPairState
    data class Failed(val message: String) : SelfPairState
}

/**
 * Drives the Self-Pair flow and exposes it as a single [state] the UI renders.
 *
 * A process-wide singleton with an **app-lifetime** scope — NOT tied to any Activity. That's on
 * purpose: pairing happens while the user is away in Settings, so the onboarding Activity is
 * backgrounded and can be destroyed by the system. If the watch lived on the Activity it would die
 * mid-pairing (it did). Living here, it keeps reading the pair dialog and pairs regardless.
 */
class SelfPairController private constructor(context: Context) {

    private val appContext = context.applicationContext
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var watchJob: Job? = null

    // Keep the display lit for the whole setup — a normal screen timeout dozing to the Always-On
    // Display makes the Settings/pair screen no longer the active window, so the watcher can't read
    // or pair. Reuses the session wake (SCREEN_BRIGHT lock + 3s re-wake) that already works on One UI.
    private val screenWaker = ScreenWaker(appContext)

    private val _state = MutableStateFlow<SelfPairState>(SelfPairState.Intro)
    val state: StateFlow<SelfPairState> = _state.asStateFlow()

    /**
     * Watch in the background for the "Pair device with pairing code" dialog to open, then finish
     * with as little user effort as the device allows:
     *
     *  - **Accessibility on** → read the 6-digit code + IP:port straight off the dialog and pair
     *    automatically. The user types nothing and we pull the wizard back to the front.
     *  - **Accessibility off** → discover the port over mDNS and advance to the code screen, where
     *    the user types only the 6 digits (host + port pre-filled).
     */
    /**
     * Start the watch if it isn't already running. Safe to call repeatedly — from the Activity's
     * onResume, for instance — without restarting an in-flight pairing attempt.
     *
     * This, not a Compose `LaunchedEffect`, is how onboarding must arm the watch. Once the user
     * backgrounds into Settings, Compose PAUSES recomposition, so the state change that mounts the
     * pairing screen (and would fire its effect) is deferred until they return — by which point
     * they've already opened the dialog and nothing was watching. Driving it from onResume arms the
     * watch while the Activity is still foreground, and it then runs on this singleton's own scope
     * across every later Settings trip.
     */
    fun ensureWatching() {
        if (watchJob?.isActive == true) return
        when (_state.value) {
            is SelfPairState.Working, is SelfPairState.Done -> return
            else -> watchForPairing()
        }
    }

    fun watchForPairing() {
        screenWaker.holdScreenOn()
        _state.value = SelfPairState.Watching
        watchJob?.cancel()
        watchJob = scope.launch {
            val scanner = PairingPortScanner(appContext)
            val suggestedHost = LocalNetwork.wifiIpv4() ?: "127.0.0.1"
            var ticks = 0
            var lastTried: String? = null
            while (isActive) {
                val a11y = HostAccessibilityService.instance

                // 1. Read the code off the dialog and pair. CRITICAL: on failure we do NOT give up —
                //    a read can catch a stale or mid-open code, so keep watching and retry.
                val info = a11y?.readPairingInfo()
                if (ticks % 5 == 0) Log.d(TAG, "watch: a11y=${a11y != null} info=$info")
                if (info != null) {
                    // mDNS is authoritative for the pairing port: adbd advertises the live
                    // _adb-tls-pairing service, whereas the on-screen text can be misread (or be
                    // the connect port from the screen behind). Fall back to the parsed port.
                    val port = runCatching { scanner.discover(1_500) }.getOrNull()?.port ?: info.port
                    // Key the retry guard on code AND port — reopening the dialog mints a new pair,
                    // and guarding on the code alone would skip a retry whenever only the port moved.
                    val key = "${info.code}@$port"
                    if (key != lastTried) {
                        lastTried = key
                        if (attemptPairing(info.code, info.host, port)) {
                            HostAccessibilityService.instance?.bringWizardToFront()
                            screenWaker.release()
                            return@launch
                        }
                        _state.value = SelfPairState.Watching
                        ticks = 0
                    }
                }

                // 2. Open the pair-code row ourselves so the user doesn't have to hunt for it.
                //    Never while the dialog is already up — tapping behind it would dismiss and
                //    remint the code, which is what previously thrashed this into stale reads.
                if (info == null) a11y?.openPairingDialog()

                // 3. Type-the-code fallback — ONLY when there is no accessibility service to read
                //    the dialog for us. With accessibility on we keep watching indefinitely rather
                //    than bailing out, because bailing left the UI on a dead "waiting…" screen.
                if (a11y == null && ticks >= 12) {
                    val endpoint = runCatching { scanner.discover(2_000) }.getOrNull()
                    if (endpoint != null) {
                        _state.value = SelfPairState.AwaitingCode(endpoint, suggestedHost)
                        screenWaker.release()
                        return@launch
                    }
                }
                ticks++
                delay(if (a11y != null) 400 else 300)
            }
        }
    }

    /** Fallback: skip auto-detect and let the user type host/port/code by hand. */
    fun manualEntry() {
        watchJob?.cancel()
        _state.value = SelfPairState.AwaitingCode(null, LocalNetwork.wifiIpv4() ?: "127.0.0.1")
    }

    /**
     * One pairing attempt: pair → connect → apply grants. Sets Working/Done and returns true on
     * success. On failure returns false (and logs) WITHOUT setting Failed — the caller decides
     * whether to retry (the watch) or surface an error (manual entry). Doesn't touch the screen lock.
     */
    private suspend fun attemptPairing(code: String, host: String, port: Int): Boolean {
        val transport = LibAdbTransport(appContext)
        return try {
            Log.i(TAG, "pairing to $host:$port …")
            _state.value = SelfPairState.Working("Pairing…")
            transport.pair(host, port, code.trim())
            Log.i(TAG, "paired; connecting …")

            _state.value = SelfPairState.Working("Connecting…")
            transport.connect(appContext)
            Log.i(TAG, "connected; applying grants …")

            _state.value = SelfPairState.Working("Applying setup…")
            val result = GrantSequence(appContext.packageName) { transport.exec(it) }.run()
            result.steps.forEach { Log.i(TAG, "grant [${if (it.ok) "OK" else "FAIL"}] ${it.label} — ${it.detail}") }

            if (result.allCriticalOk) {
                // Reuse the owner's one-time setup flow; no separate call-audio screen.
                transport.close()
                _state.value = SelfPairState.Working("Activating call audio…")
                val audio = ai.remote365.host.rtc.CallDaemonClient(appContext)
                try {
                    ai.remote365.host.rtc.CallDaemonClient.setActivationEndpoint(appContext, "")
                    Log.i(TAG, "Call audio: ${audio.launchDaemon()}")
                } finally { audio.close() }
                Log.i(TAG, "self-pair DONE — device is unattended")
                _state.value = SelfPairState.Done(result)
                true
            } else {
                Log.w(TAG, "self-pair incomplete: ${result.failedCritical.joinToString { it.label }}")
                false
            }
        } catch (e: Exception) {
            Log.w(TAG, "pairing attempt failed: ${e.message}")
            false
        } finally {
            transport.close()
        }
    }

    /**
     * Manual path: pair with the code the user typed. [manualHost]/[manualPort] are used only when
     * auto-discovery failed. Unlike the watch, a failure here surfaces as [SelfPairState.Failed].
     */
    fun submitCode(code: String, endpoint: PairingEndpoint?, manualHost: String, manualPort: Int) {
        val host = endpoint?.host ?: manualHost.ifBlank { LOOPBACK }
        val port = endpoint?.port ?: manualPort
        if (port <= 0) {
            _state.value = SelfPairState.Failed("Enter the port shown on the pairing screen.")
            return
        }
        scope.launch {
            try {
                if (attemptPairing(code, host, port)) {
                    HostAccessibilityService.instance?.bringWizardToFront()
                } else {
                    _state.value = SelfPairState.Failed(
                        "Pairing failed — reopen the pairing dialog for a fresh code and try again.",
                    )
                }
            } finally {
                screenWaker.release()
            }
        }
    }

    fun reset() {
        watchJob?.cancel()
        screenWaker.release()
        _state.value = SelfPairState.Intro
    }

    /** Stop watching and drop the screen lock (e.g. the user backed out of setup). Does NOT tear
     *  down the singleton — the scope is app-lifetime so a paused/destroyed Activity can't kill it. */
    fun stop() {
        watchJob?.cancel()
        screenWaker.release()
    }

    companion object {
        private const val TAG = "SelfPair"
        private const val LOOPBACK = "127.0.0.1"

        @Volatile
        private var instance: SelfPairController? = null

        /** The process-wide controller. Survives Activity destruction so pairing can't be interrupted. */
        fun get(context: Context): SelfPairController =
            instance ?: synchronized(this) {
                instance ?: SelfPairController(context.applicationContext).also { instance = it }
            }
    }
}
