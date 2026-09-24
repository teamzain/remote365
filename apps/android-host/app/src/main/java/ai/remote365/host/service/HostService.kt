package ai.remote365.host.service

import ai.remote365.host.BuildConfig
import ai.remote365.host.input.ClipboardBridge
import ai.remote365.host.input.ImeController
import ai.remote365.host.input.InputRouter
import ai.remote365.host.provisioning.AccessibilitySelfHeal
import ai.remote365.host.provisioning.selfpair.SelfPairController
import ai.remote365.host.net.DeviceRegistrar
import ai.remote365.host.net.HostIdentity
import ai.remote365.host.net.NetworkMonitor
import ai.remote365.host.net.SignalingClient
import android.net.Network
import ai.remote365.host.rtc.CallAudioBridge
import ai.remote365.host.rtc.CallDaemonClient
import ai.remote365.host.rtc.HostAudio
import ai.remote365.host.rtc.WebRtcSession
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
import android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
import android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
import android.os.Build
import android.os.IBinder
import android.util.DisplayMetrics
import android.util.Log
import android.view.WindowManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.float
import org.webrtc.EglBase
import org.webrtc.IceCandidate
import org.webrtc.PeerConnectionFactory

/**
 * Long-lived host process: holds the warm signaling socket and, during a session, the capture
 * pipeline and peer connection.
 *
 * "Instant connect" depends on this service staying alive, so the socket is already open and
 * presence is already `online` when the operator clicks the device.
 */
class HostService : Service(), SignalingClient.Listener {

    private val scope = CoroutineScope(SupervisorJob())
    private lateinit var identity: HostIdentity
    private lateinit var signaling: SignalingClient
    private lateinit var eglBase: EglBase
    private lateinit var factory: PeerConnectionFactory

    private val inputRouter = InputRouter()
    private lateinit var clipboard: ClipboardBridge
    private lateinit var screenWaker: ScreenWaker
    private lateinit var imeController: ImeController
    private lateinit var hostAudio: HostAudio
    private val callAudioBridge by lazy { CallAudioBridge(applicationContext) }
    private val callDaemonClient by lazy { CallDaemonClient(applicationContext) }
    private var session: WebRtcSession? = null
    private var activeViewerId: String? = null
    private var reconnectJob: Job? = null
    /** Consecutive failed attempts since the last `registered`; drives the backoff. */
    private var reconnectAttempt = 0
    private lateinit var network: NetworkMonitor
    /** The default network the current socket was registered over (null = not registered). */
    private var socketNetwork: Network? = null

    private var audioManager: android.media.AudioManager? = null
    @Volatile private var callAudioOn = false
    @Volatile private var audioListening = true
    @Volatile private var audioDestroyed = false
    private val audioWorker = java.util.concurrent.Executors.newSingleThreadExecutor()
    private val audioGeneration = java.util.concurrent.atomic.AtomicLong()
    // Created only on API 31+ (the type does not exist earlier — eager init would crash the host
    // on older fleet devices). Call audio needs 31+ for shell attribution anyway.
    private var modeListener: android.media.AudioManager.OnModeChangedListener? = null

    override fun onCreate() {
        super.onCreate()
        identity = HostIdentity.create(applicationContext)
        // Also repair here, not just in BootReceiver: a sideloaded/adb reinstall does not
        // always deliver MY_PACKAGE_REPLACED before the app is launched again.
        AccessibilitySelfHeal.ensureEnabled(applicationContext)
        clearScreenShareProtection()
        clipboard = ClipboardBridge(applicationContext) { session?.sendControl(it) }
        screenWaker = ScreenWaker(applicationContext)
        imeController = ImeController(applicationContext)
        inputRouter.isScreenInteractive = { screenWaker.isInteractive }
        inputRouter.onWakeNeeded = { screenWaker.wakeIfOff() }
        registerTypeTestReceiver()
        eglBase = EglBase.create()
        hostAudio = HostAudio(applicationContext)
        hostAudio.onInputStateChanged = { ready ->
            if (ready && audioListening && isInCall()) startCallAudio()
            else if (!ready) stopCallAudio()
        }
        factory = WebRtcSession.createFactory(
            applicationContext, eglBase, hostAudio.createAudioDeviceModule(),
        )
        signaling = SignalingClient(scope, identity, this)
        network = NetworkMonitor(applicationContext, scope, networkListener)
        // Watch the audio mode so call audio starts/stops automatically with the phone call.
        audioManager = (getSystemService(Context.AUDIO_SERVICE) as? android.media.AudioManager)?.also { am ->
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val listener = android.media.AudioManager.OnModeChangedListener { mode -> onAudioModeChanged(mode) }
                modeListener = listener
                runCatching { am.addOnModeChangedListener(mainExecutor, listener) }
            }
        }
        // specialUse: the persistent phase (socket + presence) has no projection yet, and
        // starting a mediaProjection-typed FGS without one crashes on Android 14+.
        startForegroundCompat(FOREGROUND_SERVICE_TYPE_SPECIAL_USE, "Connecting…")
        network.start()
        bootstrap()
        // Activation is explicit in Audio Setup. Receiving a Binder never starts capture itself.
        scope.launch {
            CallDaemonClient.state.collect { state ->
                session?.sendControl(JsonObject(mapOf(
                    "type" to JsonPrimitive("audio-status"), "message" to JsonPrimitive(state),
                )).toString())
                if (callAudioOn) updateNotification("Remote session • $state")
                if ((state.startsWith("Audio helper ready") || state.startsWith("Helper ready")) &&
                    session != null && audioListening && isInCall()) startCallAudio()
            }
        }
    }

    // Carrier-call detection deliberately excludes MODE_IN_COMMUNICATION, which our own WebRTC
    // connection may set. Other applications' VoIP capture needs separate qualification.
    private fun onAudioModeChanged(mode: Int) {
        if (mode == android.media.AudioManager.MODE_IN_CALL && session != null && audioListening)
            startCallAudio() else stopCallAudio()
    }

    @Synchronized private fun startCallAudio() {
        if (audioDestroyed || callAudioOn || session == null || !audioListening || !hostAudio.hasPermission) return
        callAudioOn = true
        val generation = audioGeneration.incrementAndGet()
        audioWorker.execute {
            if (generation != audioGeneration.get()) return@execute
            if (!callDaemonClient.isReady) {
                if (generation == audioGeneration.get()) callAudioOn = false
                updateNotification("Remote session • Audio helper needs activation")
                return@execute
            }
            // Wait briefly for WebRTC's media recorder to initialise; never claim a successful
            // call source switch before that recorder exists.
            var switched = false
            repeat(10) {
                if (!switched && generation == audioGeneration.get()) {
                    switched = hostAudio.enterCallMode()
                    if (!switched) Thread.sleep(100)
                }
            }
            if (generation != audioGeneration.get() || !switched) {
                hostAudio.exitCallMode(); if (generation == audioGeneration.get()) callAudioOn = false
                return@execute
            }
            val ok = callDaemonClient.startCapture(CallDaemonClient.preferredSource(applicationContext), 48_000,
                onEnded = { reason ->
                    if (generation == audioGeneration.get()) {
                        Log.w(TAG, reason)
                        stopCallAudio(generation)
                        updateNotification("Remote session • $reason")
                    }
                },
                onFrame = { bytes, count ->
                    if (generation == audioGeneration.get()) hostAudio.writeCallAudio(bytes, count)
                },
            )
            if (!ok || generation != audioGeneration.get()) {
                callDaemonClient.stopCapture(); hostAudio.exitCallMode(); if (generation == audioGeneration.get()) callAudioOn = false
                updateNotification("Remote session • Call audio unavailable")
            } else updateNotification("Remote session • Listening to call audio")
        }
    }

    @Synchronized private fun stopCallAudio(expectedGeneration: Long? = null) {
        if (expectedGeneration != null && expectedGeneration != audioGeneration.get()) return
        audioGeneration.incrementAndGet()
        callAudioOn = false
        if (audioWorker.isShutdown) return
        audioWorker.execute {
            callDaemonClient.stopCapture()
            hostAudio.exitCallMode()
        }
    }

    private fun isInCall(): Boolean = audioManager?.mode == android.media.AudioManager.MODE_IN_CALL

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            // Isolated wake check. Delivered as a SERVICE action on purpose: starting an
            // activity wakes the display by itself, which would mask a broken wake lock.
            ACTION_WAKE -> screenWaker.wakeIfOff()

            ACTION_PROJECTION_GRANTED -> {
                @Suppress("DEPRECATION")
                val data: Intent? = intent.getParcelableExtra(EXTRA_PROJECTION_INTENT)
                val viewerId = intent.getStringExtra(EXTRA_VIEWER_ID)
                val ice = pendingIceServers
                if (data != null && viewerId != null) {
                    beginSession(viewerId, data, ice)
                }
            }
        }
        // Restart if the system kills us — this service is the whole product.
        return START_STICKY
    }

    /**
     * Newer One UI 7 (Android 15) builds black out sensitive surfaces — Developer options, Wireless
     * debugging, password fields, notifications — during remote capture, showing "App content hidden
     * from screen share for security". We hold WRITE_SECURE_SETTINGS, so clear the same global that
     * Developer options > "Disable screen share protection" toggles, letting the operator see those
     * screens. This runs on every start, so devices paired before the grant sequence set it are
     * covered on the next launch/update. Harmless where the setting or permission is absent.
     */
    private fun clearScreenShareProtection() {
        runCatching {
            android.provider.Settings.Global.putInt(
                contentResolver,
                "disable_screen_share_protections_for_apps_and_notifications",
                1,
            )
        }.onFailure { Log.w(TAG, "screenshare-protection clear failed: ${it.message}") }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        audioDestroyed = true
        // Never leave the user stuck with our keyless IME if the service dies mid-session.
        if (::imeController.isInitialized) imeController.restoreAfterSession()
        stopCallAudio()
        callAudioBridge.release()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            modeListener?.let { l -> runCatching { audioManager?.removeOnModeChangedListener(l) } }
        }
        session?.close("service destroyed")
        audioWorker.execute { callDaemonClient.close() }
        audioWorker.shutdown()
        if (::network.isInitialized) network.stop()
        signaling.disconnect()
        scope.cancel()
        eglBase.release()
        super.onDestroy()
    }

    /**
     * Self-register (idempotent), then open the warm socket. Both steps live inside the
     * reconnect loop so a boot without network — or a first launch that could not reach the
     * API — keeps retrying instead of leaving the device keyless and permanently offline.
     */
    private fun bootstrap() = scheduleReconnect(delayMs = 0)

    /** True when the device has an access key, registering if it has to. Network errors → false. */
    private suspend fun ensureRegistered(): Boolean {
        val registrar = DeviceRegistrar(identity)
        val result = registrar.register(applicationContext)
        result.onSuccess { Log.i(TAG, "registered as ${it.accessKey}") }
            .onFailure { Log.e(TAG, "self-register failed: ${it.message}") }
        // A stale-but-present key is enough to connect: the hostSecret authenticates it.
        return identity.accessKey != null
    }

    // --- network -------------------------------------------------------------------------

    private val networkListener = object : NetworkMonitor.Listener {
        override fun onOnline(net: Network) {
            val handover = signaling.isRegistered && socketNetwork != null && socketNetwork != net
            Log.i(TAG, "network online: $net (registered=${signaling.isRegistered} handover=$handover)")
            if (!signaling.isRegistered || handover) {
                // Fresh network = fresh backoff. A socket bound to the previous network is
                // doomed anyway (it dies a few seconds later with "connection abort"), so on
                // a handover swap it out proactively rather than waiting for that.
                reconnectAttempt = 0
                scheduleReconnect(delayMs = 0)
            }
            // A live session: give ICE a moment to regather on the new interface by itself
            // (continual gathering), then force a restart if it has not come back.
            session?.let { live ->
                scope.launch {
                    delay(ICE_RESTART_GRACE_MS)
                    if (session === live && !live.isConnected) live.restartIce()
                }
            }
        }

        override fun onOffline() {
            Log.w(TAG, "network offline")
            if (session == null) updateNotification("Waiting for network…")
        }
    }

    // --- signaling callbacks --------------------------------------------------------------

    override fun onRegistered(sessionId: String, connectionId: String) {
        reconnectJob?.cancel()
        reconnectJob = null
        reconnectAttempt = 0
        socketNetwork = network.current
        updateNotification(if (session != null) "Session active" else "Online · ID $sessionId")
    }

    override fun onRegistrationError(error: String) {
        Log.e(TAG, "registration error: $error")
        updateNotification("Registration failed")
        scheduleReconnect()
    }

    override fun onViewerRequest(viewerId: String, viewerName: String?, viewerDeviceId: String?) {
        // Unattended devices auto-approve; attended builds will surface a prompt here.
        // Server auto-denies after 30s of silence.
        signaling.approve(viewerId, trustDevice = true)
    }

    override fun onViewerRequestCancelled(viewerId: String) = Unit

    private var pendingIceServers: JsonArray? = null

    override fun onViewerJoined(
        viewerId: String,
        iceServers: JsonObject?,
        remoteSessionId: String,
        expiresAt: String,
    ) {
        pendingIceServers = iceServers as? JsonArray
        // A viewer reconnecting after a network drop arrives here while the previous session
        // may still be alive (its ICE takes up to ~30s to fail). End it explicitly first, so
        // its delayed failure cannot later run the teardown path against the NEW session.
        session?.let { previous ->
            Log.i(TAG, "viewer $viewerId joined while a session was live; replacing it")
            previous.close("replaced by new viewer")
        }
        activeViewerId = viewerId
        // Tier A: the app-op grant lets MediaProjection start with no dialog. Tier C must
        // bounce through MainActivity to show the system consent sheet.
        ProjectionRequestActivity.request(applicationContext, viewerId)
    }

    private fun beginSession(viewerId: String, projectionIntent: Intent, ice: JsonArray?) {
        session?.let { existing ->
            if (viewerId == activeViewerId) {
                // Two grants for one viewer (keyguard re-acquire racing a rejoin): the live
                // session already owns a capture, so this token is simply unused.
                Log.w(TAG, "duplicate projection grant for $viewerId ignored")
                return
            }
            Log.i(TAG, "closing session before starting one for $viewerId")
            existing.close("superseded")
        }
        activeViewerId = viewerId
        // Promote to the mediaProjection type BEFORE the capturer calls getMediaProjection —
        // that call requires the service to already be a mediaProjection FGS. Switching here
        // (not at onCreate) is what keeps background restarts from crashing. The microphone
        // type rides along when we may record: Android 14+ silences mic/playback capture from
        // a service that did not declare it. Fall back to projection-only if the OS refuses.
        val withAudio = hostAudio.hasPermission
        val sessionText = if (withAudio) "Session active · sharing screen and audio" else "Session active"
        val promoted = withAudio && startForegroundCompat(
            FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION or FOREGROUND_SERVICE_TYPE_MICROPHONE, sessionText,
        )
        if (!promoted) startForegroundCompat(FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION, sessionText)

        // BEFORE capture starts: a sleeping screen means MediaProjection records the
        // Always-On Display and every gesture is rejected for being non-interactive.
        screenWaker.beginSessionAwake()
        val metrics = currentMetrics()
        val callbacks = SessionCallbacks(viewerId)
        val webrtc = WebRtcSession(
            applicationContext, eglBase, factory, callbacks,
            audio = if (withAudio && promoted) hostAudio else null,
        )
        callbacks.owner = webrtc
        session = webrtc
        audioListening = true
        webrtc.start(
            projectionIntent = projectionIntent,
            iceServers = WebRtcSession.parseIceServers(ice),
            screenWidth = metrics.widthPixels,
            screenHeight = metrics.heightPixels,
        )
        clipboard.start()
        imeController.activateForSession()
        updateNotification(sessionText)
        // A call may already be in progress when the viewer connects — pick it up immediately.
        if (withAudio && promoted && isInCall()) startCallAudio()
    }

    /**
     * Callbacks are bound to ONE session ([owner]). A session that was already replaced — the
     * viewer rejoined after a network drop before the old peer noticed — must not run the
     * teardown below when it finally fails, or it would null out the live session, restore the
     * keyboard and demote the foreground service type under a running capture.
     */
    private inner class SessionCallbacks(private val viewerId: String) : WebRtcSession.Callbacks {
        var owner: WebRtcSession? = null

        private val isStale: Boolean get() = owner !== session

        override fun onLocalOffer(sdp: String) {
            if (!isStale) signaling.sendOffer(viewerId, sdp)
        }

        override fun onIceCandidate(candidate: IceCandidate) {
            if (!isStale) signaling.sendIceCandidate(
                viewerId, candidate.sdp, candidate.sdpMid, candidate.sdpMLineIndex,
            )
        }

        override fun onInputMessage(json: JsonObject) {
            if (!isStale) handleInput(json)
        }

        override fun onControlMessage(json: JsonObject) {
            if (!isStale) handleControl(json)
        }

        override fun onClosed(reason: String) {
            if (isStale) {
                Log.i(TAG, "stale session for viewer $viewerId closed: $reason (ignored)")
                return
            }
            Log.i(TAG, "session closed: $reason")
            session = null
            // No viewer → nothing to stream call audio to. Also restores inner-audio mode.
            stopCallAudio()

            // Android 15 STOPS MediaProjection the moment the keyguard engages on a device
            // with a PIN ("Stopped MediaProjection due to keyguard lock"). That is an OS
            // security behaviour, not something we can suppress — so instead of dropping the
            // operator, wake the screen and silently take a fresh capture token. This only
            // works because the Tier A app-op grant means no consent dialog appears.
            if (reason == REASON_PROJECTION_STOPPED && activeViewerId != null) {
                Log.i(TAG, "projection killed by keyguard; waking and re-acquiring")
                clipboard.stop()
                screenWaker.wakeIfOff()
                updateNotification("Reconnecting screen…")
                scope.launch {
                    // Let the wake settle: requesting a token while still Dozing just fails.
                    delay(PROJECTION_RECOVERY_DELAY_MS)
                    activeViewerId?.let { ProjectionRequestActivity.request(applicationContext, it) }
                }
                return
            }

            screenWaker.release()
            clipboard.stop()
            // Restore only on genuine session end — the projection-recovery path above returns
            // before here, so the user's keyboard stays swapped out across a re-acquire.
            imeController.restoreAfterSession()
            // Demote back to specialUse: capture is done, and staying mediaProjection-typed
            // would crash if the service were restarted in the background.
            startForegroundCompat(FOREGROUND_SERVICE_TYPE_SPECIAL_USE, "Online")
            signaling.hostStopped(viewerId)
            activeViewerId = null
        }
    }

    override fun onAnswer(senderId: String, sdp: String) {
        session?.acceptAnswer(sdp)
    }

    override fun onIceCandidate(
        senderId: String,
        candidate: String,
        sdpMid: String?,
        sdpMLineIndex: Int?,
    ) {
        session?.addIceCandidate(candidate, sdpMid, sdpMLineIndex)
    }

    /** Viewer's relay-reroute path: rebuild and re-offer to the sender. */
    override fun onRequestOffer(senderId: String) {
        session?.createOffer()
    }

    override fun onViewerLeft(viewerId: String) {
        // The server reports the OLD viewer connection leaving after the viewer has already
        // rejoined on a new one; that must not end the new session.
        if (viewerId != activeViewerId) {
            Log.i(TAG, "viewer-left for $viewerId ignored (active=$activeViewerId)")
            return
        }
        session?.close("viewer left")
    }

    override fun onSessionExpiring(secondsRemaining: Int) {
        updateNotification("Session ends in ${secondsRemaining}s")
    }

    override fun onSessionExpired(remoteSessionId: String) {
        session?.close("grant expired")
    }

    override fun onDisconnected(reason: String) {
        Log.w(TAG, "signaling disconnected: $reason")
        socketNetwork = null
        updateNotification(if (network.isOnline) "Reconnecting…" else "Waiting for network…")
        scheduleReconnect()
    }

    /**
     * Single reconnect driver. One attempt per job: it (re)registers the device if the access
     * key is missing, opens the socket, then waits [CONNECT_GRACE_MS] for `registered`. Every
     * outcome re-arms it — success cancels it from [onRegistered], a fast failure re-arms it
     * from [onDisconnected], and a hang re-arms it here — so there is never more than one
     * socket in flight (the old loop kept dialling every backoff tick without closing the
     * previous attempt, and the server then closed the duplicates, which looked like flapping).
     *
     * Pacing: while a network is present, 1s → 2s → 4s → 8s → 15s → 30s. Without one the
     * attempt is skipped (it would only fail on DNS) and the [NetworkMonitor] callback restarts
     * from zero the moment connectivity returns; a slow safety tick still fires in case that
     * callback never comes.
     */
    @Synchronized
    private fun scheduleReconnect(delayMs: Long = nextBackoff()) {
        reconnectJob?.cancel()
        reconnectJob = scope.launch {
            delay(delayMs)
            if (!network.isOnline) {
                Log.i(TAG, "reconnect deferred: no network")
                delay(OFFLINE_SAFETY_MS)
                if (!signaling.isRegistered) scheduleReconnect(delayMs = 0)
                return@launch
            }
            if (identity.accessKey == null && !ensureRegistered()) {
                Log.w(TAG, "still unregistered; retrying")
                scheduleReconnect()
                return@launch
            }
            reconnectAttempt++
            Log.i(TAG, "reconnect attempt #$reconnectAttempt")
            signaling.connect()
            delay(CONNECT_GRACE_MS)
            if (!signaling.isRegistered) {
                Log.w(TAG, "attempt #$reconnectAttempt did not register in time")
                scheduleReconnect()
            }
        }
    }

    private fun nextBackoff(): Long = when (reconnectAttempt) {
        0 -> 1_000L
        1 -> 2_000L
        2 -> 4_000L
        3 -> 8_000L
        4 -> 15_000L
        else -> 30_000L
    }

    // --- input -----------------------------------------------------------------------------

    private fun handleInput(msg: JsonObject) = inputRouter.handle(msg)

    private fun handleControl(msg: JsonObject) {
        if (clipboard.handle(msg)) return
        when (msg.type()) {
            "stream-quality" -> session?.applyQuality((msg["mode"] as? JsonPrimitive)?.content)
            // Viewer announces whether it is listening (desktop/web send this on connect and
            // on every speaker toggle). Don't burn bandwidth on audio nobody hears.
            "audio-status-request" -> session?.sendControl(JsonObject(mapOf(
                "type" to JsonPrimitive("audio-status"),
                "message" to JsonPrimitive(CallDaemonClient.state.value),
            )).toString())
            "audio-listen" -> {
                audioListening = (msg["on"] as? JsonPrimitive)?.content != "false"
                session?.setListening(audioListening)
                if (audioListening && isInCall()) startCallAudio() else stopCallAudio()
            }
            // Do NOT re-offer here. A keyframe request must not renegotiate — WebRTC already
            // sends a keyframe in response to the viewer's RTCP PLI. Re-creating the offer on
            // every request tore the connection down and rebuilt it (the CONNECTING/CONNECTED
            // flapping), which is worse than the missing keyframe it was trying to fix.
            "request-keyframe" -> Unit
            // Input also arrives on the control channel from some viewer builds.
            else -> inputRouter.handle(msg)
        }
    }

    private fun JsonObject.type(): String? = (this["type"] as? JsonPrimitive)?.content

    // --- plumbing --------------------------------------------------------------------------

    @Suppress("DEPRECATION")
    private fun currentMetrics(): DisplayMetrics {
        val wm = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        return DisplayMetrics().also { wm.defaultDisplay.getRealMetrics(it) }
    }

    /**
     * Debug-only: lets `adb shell am broadcast -a ai.remote365.host.TEST_TYPE --es text "5+5"`
     * exercise the real production typing path (service -> IME) WITHOUT launching an activity,
     * so the target app keeps input focus. This is the only faithful way to test the IME.
     */
    private fun registerTypeTestReceiver() {
        if (!BuildConfig.DEBUG) return
        val receiver = object : android.content.BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                when (intent.action) {
                    // Drives Self-Pair WITHOUT bringing the app to foreground, so the phone's
                    // "Pair device with pairing code" dialog stays up and its pairing server stays
                    // alive. am start would steal focus and dismiss that dialog.
                    "ai.remote365.host.TEST_PAIR" -> {
                        val code = intent.getStringExtra("code") ?: return
                        val host = intent.getStringExtra("host") ?: "127.0.0.1"
                        val port = intent.getStringExtra("port")?.toIntOrNull() ?: 0
                        Log.i("SelfPair", "TEST_PAIR code=$code host=$host port=$port")
                        SelfPairController.get(applicationContext).submitCode(code, null, host, port)
                    }
                    // Isolated test of pairing-port mDNS discovery: open "Pair device with pairing
                    // code" on the phone, then broadcast this and check the log for the found port.
                    "ai.remote365.host.TEST_DISCOVER" -> {
                        scope.launch {
                            val ep = ai.remote365.host.provisioning.selfpair
                                .PairingPortScanner(applicationContext).discover(10_000)
                            Log.i("SelfPair", "TEST_DISCOVER result=$ep")
                        }
                    }
                    // Isolated test of reading the pairing dialog via accessibility: enable the a11y
                    // service, open the pair dialog, then broadcast this and check the log.
                    "ai.remote365.host.TEST_READPAIR" -> {
                        val a11y = ai.remote365.host.input.HostAccessibilityService.instance
                        val info = a11y?.readPairingInfo()
                        Log.i("SelfPair", "TEST_READPAIR a11yOn=${a11y != null} result=$info")
                    }
                    // Full auto-flow test: open the pair dialog, then broadcast this — the watcher
                    // reads the code via accessibility and pairs + grants with no typing.
                    "ai.remote365.host.TEST_WATCH" -> {
                        Log.i("SelfPair", "TEST_WATCH starting")
                        SelfPairController.get(applicationContext).watchForPairing()
                    }
                    "ai.remote365.host.TEST_TYPE" -> {
                        val text = intent.getStringExtra("text") ?: return
                        val ok = ai.remote365.host.input.HostImeService.instance?.commitText(text)
                        Log.i(TAG, "TEST_TYPE '$text' imeCommitted=$ok")
                    }
                    // Probe whether this APP uid may open the call-audio sources. Diagnostic only —
                    // expected to fail (app can't hold CAPTURE_AUDIO_OUTPUT).
                    "ai.remote365.host.TEST_CALLAUDIO" -> hostAudio.probeCallSources()

                    // Option 2 bootstrap proof. TEST_DAEMON_START launches the persistent daemon
                    // (wireless debugging ON). Then turn wireless debugging OFF and fire
                    // TEST_DAEMON_PING — a "pong" with debugging off proves persistence + the
                    // binder handoff + SELinux all work, before we layer audio on top.
                    "ai.remote365.host.TEST_DAEMON_START" -> scope.launch {
                        intent.getStringExtra("endpoint")?.let { CallDaemonClient.setActivationEndpoint(applicationContext, it) }
                        Log.i(TAG, "TEST_DAEMON_START -> ${callDaemonClient.launchDaemon()}")
                    }
                    "ai.remote365.host.TEST_DAEMON_PING" -> scope.launch {
                        Log.i(TAG, "TEST_DAEMON_PING -> ${callDaemonClient.ping()}")
                    }

                    // Live capture probe over the SHELL channel (the real path): place a call,
                    // then broadcast this. Logs measured loudness of the far side captured as shell
                    // and streamed back over ADB. Tries VOICE_DOWNLINK, falls back to VOICE_CALL.
                    "ai.remote365.host.TEST_CALLAUDIO_LIVE" -> scope.launch {
                        val r3 = callAudioBridge.probe(3, 8)
                        Log.i(TAG, "TEST_CALLAUDIO_LIVE source=3 (VOICE_DOWNLINK) -> $r3")
                        if (!r3.startsWith("AUDIO_PRESENT")) {
                            val r4 = callAudioBridge.probe(4, 8)
                            Log.i(TAG, "TEST_CALLAUDIO_LIVE source=4 (VOICE_CALL) -> $r4")
                        }
                    }
                    // Dispatch a tap/long-press at normalised coords on whatever is foreground,
                    // without stealing focus — so the long-press path (hold 0 -> "+") can be
                    // verified against the real dialer. `ms` is the hold duration.
                    "ai.remote365.host.TEST_TAP" -> {
                        val x = intent.getStringExtra("x")?.toFloatOrNull() ?: 0.5f
                        val y = intent.getStringExtra("y")?.toFloatOrNull() ?: 0.5f
                        val ms = intent.getStringExtra("ms")?.toLongOrNull()
                        val a11y = ai.remote365.host.input.HostAccessibilityService.instance
                        Log.i(TAG, "TEST_TAP x=$x y=$y ms=$ms a11y=${a11y != null}")
                        if (ms != null) a11y?.tap(x, y, ms) else a11y?.tap(x, y)
                    }
                    "ai.remote365.host.TEST_WAKE" -> {
                        screenWaker.beginSessionAwake()
                        Log.i(TAG, "TEST_WAKE -> interactive=${screenWaker.isInteractive}")
                    }
                    "ai.remote365.host.TEST_IME" -> {
                        if (intent.getBooleanExtra("off", false)) {
                            imeController.restoreAfterSession()
                        } else {
                            imeController.activateForSession()
                        }
                        val now = android.provider.Settings.Secure.getString(
                            contentResolver,
                            android.provider.Settings.Secure.DEFAULT_INPUT_METHOD,
                        )
                        Log.i(TAG, "TEST_IME -> defaultIme=$now")
                    }
                    "ai.remote365.host.TEST_CLIP" -> {
                        val ime = ai.remote365.host.input.HostImeService.instance?.readClipboard()
                        val cm = getSystemService(Context.CLIPBOARD_SERVICE)
                            as? android.content.ClipboardManager
                        val direct = runCatching {
                            cm?.primaryClip?.getItemAt(0)?.coerceToText(applicationContext)?.toString()
                        }.getOrElse { "ERR:${it.message}" }
                        val selection = ai.remote365.host.input.HostAccessibilityService
                            .instance?.lastSelectedText
                        Log.i(
                            TAG,
                            "TEST_CLIP imeInstance=${ime != null} imeRead='$ime' " +
                                "directRead='$direct' selection='$selection'",
                        )
                    }
                }
            }
        }
        val filter = android.content.IntentFilter().apply {
            addAction("ai.remote365.host.TEST_PAIR")
            addAction("ai.remote365.host.TEST_DISCOVER")
            addAction("ai.remote365.host.TEST_READPAIR")
            addAction("ai.remote365.host.TEST_WATCH")
            addAction("ai.remote365.host.TEST_TYPE")
            addAction("ai.remote365.host.TEST_CALLAUDIO")
            addAction("ai.remote365.host.TEST_CALLAUDIO_LIVE")
            addAction("ai.remote365.host.TEST_DAEMON_START")
            addAction("ai.remote365.host.TEST_DAEMON_PING")
            addAction("ai.remote365.host.TEST_TAP")
            addAction("ai.remote365.host.TEST_WAKE")
            addAction("ai.remote365.host.TEST_CLIP")
            addAction("ai.remote365.host.TEST_IME")
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(receiver, filter, android.Manifest.permission.DUMP, null, Context.RECEIVER_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            registerReceiver(receiver, filter, android.Manifest.permission.DUMP, null)
        }
    }

    /** startForeground with an explicit type on API 29+, plain otherwise. False if the OS refused. */
    private fun startForegroundCompat(type: Int, text: String): Boolean {
        val notification = buildNotification(text)
        return runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, type)
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        }.onFailure { Log.e(TAG, "startForeground($type) failed", it) }.isSuccess
    }

    private fun buildNotification(text: String): Notification {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID, "Remote365 Host", NotificationManager.IMPORTANCE_LOW,
            )
            (getSystemService(NotificationManager::class.java)).createNotificationChannel(channel)
        }
        return Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("Remote365 Host")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.stat_sys_upload)
            .setOngoing(true)
            .build()
    }

    private fun updateNotification(text: String) {
        (getSystemService(NotificationManager::class.java))
            .notify(NOTIFICATION_ID, buildNotification(text))
    }

    companion object {
        private const val TAG = "HostService"
        private const val CHANNEL_ID = "remote365_host"
        private const val NOTIFICATION_ID = 1001

        private const val REASON_PROJECTION_STOPPED = WebRtcSession.REASON_PROJECTION_STOPPED

        /** Requesting a capture token while the display is still Dozing simply fails. */
        private const val PROJECTION_RECOVERY_DELAY_MS = 900L

        /** How long one socket attempt may take to reach `registered` before it is retried. */
        private const val CONNECT_GRACE_MS = 15_000L
        /** Safety tick while offline, in case the connectivity callback never arrives. */
        private const val OFFLINE_SAFETY_MS = 30_000L
        /** After a network change, how long ICE gets to self-heal before a forced restart. */
        private const val ICE_RESTART_GRACE_MS = 2_500L

        /** VOICE_DOWNLINK — the far party only (strong, clean, no self-echo). 4 = both sides. */
        private const val CALL_AUDIO_SOURCE = 3

        const val ACTION_PROJECTION_GRANTED = "ai.remote365.host.PROJECTION_GRANTED"
        const val ACTION_WAKE = "ai.remote365.host.WAKE"
        const val EXTRA_PROJECTION_INTENT = "projection_intent"
        const val EXTRA_VIEWER_ID = "viewer_id"

        fun start(context: Context) {
            val intent = Intent(context, HostService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }
    }
}
