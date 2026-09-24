package ai.remote365.host.rtc

import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.util.Log
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.webrtc.AudioSource
import org.webrtc.AudioTrack
import org.webrtc.DataChannel
import org.webrtc.DefaultVideoDecoderFactory
import org.webrtc.audio.AudioDeviceModule
import org.webrtc.DefaultVideoEncoderFactory
import org.webrtc.EglBase
import org.webrtc.IceCandidate
import org.webrtc.Logging
import org.webrtc.MediaConstraints
import org.webrtc.MediaStreamTrack
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.RtpCapabilities
import org.webrtc.RtpTransceiver
import org.webrtc.SdpObserver
import org.webrtc.SessionDescription
import org.webrtc.SurfaceTextureHelper
import org.webrtc.VideoSource
import org.webrtc.VideoTrack

/**
 * One remote session: screen capture -> H.264 -> viewer, plus the three data channels.
 *
 * CRITICAL (Android 14+): the MediaProjection permission Intent is single-use. Never stop and
 * restart capture inside a session and never toggle `track.enabled` on a screencast track —
 * either kills the token and forces the user to re-consent. Vary bitrate/resolution instead.
 */
class WebRtcSession(
    private val appContext: Context,
    private val eglBase: EglBase,
    private val factory: PeerConnectionFactory,
    private val callbacks: Callbacks,
    /** Phone audio (mic/call + app playback). Null when RECORD_AUDIO is not granted. */
    private val audio: HostAudio? = null,
) {

    interface Callbacks {
        fun onLocalOffer(sdp: String)
        fun onIceCandidate(candidate: IceCandidate)
        fun onInputMessage(json: JsonObject)
        fun onControlMessage(json: JsonObject)
        fun onClosed(reason: String)
    }

    private val json = Json { ignoreUnknownKeys = true }

    private var peer: PeerConnection? = null
    private var capturer: ProjectionCapturer? = null
    private var videoSource: VideoSource? = null
    private var videoTrack: VideoTrack? = null
    private var surfaceHelper: SurfaceTextureHelper? = null
    private var audioSource: AudioSource? = null
    private var audioTrack: AudioTrack? = null

    private var controlChannel: DataChannel? = null
    private var inputChannel: DataChannel? = null
    private var criticalChannel: DataChannel? = null

    var quality: Quality = Quality.BALANCED
        private set

    /** Last observed peer state; lets the service decide whether a network change needs an ICE restart. */
    @Volatile
    var connectionState: PeerConnection.PeerConnectionState = PeerConnection.PeerConnectionState.NEW
        private set

    val isConnected: Boolean
        get() = connectionState == PeerConnection.PeerConnectionState.CONNECTED

    /**
     * @param projectionIntent the single-use result Intent from MediaProjectionManager
     * @param iceServers parsed from the server's `viewer-joined` message
     */
    fun start(
        projectionIntent: Intent,
        iceServers: List<PeerConnection.IceServer>,
        screenWidth: Int,
        screenHeight: Int,
    ) {
        val config = PeerConnection.RTCConfiguration(iceServers).apply {
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
            continualGatheringPolicy = PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY
            bundlePolicy = PeerConnection.BundlePolicy.MAXBUNDLE
            rtcpMuxPolicy = PeerConnection.RtcpMuxPolicy.REQUIRE
        }

        peer = factory.createPeerConnection(config, PeerObserver()) ?: run {
            callbacks.onClosed("failed to create PeerConnection")
            return
        }

        createDataChannels()
        startCapture(projectionIntent, screenWidth, screenHeight)
        // Reserve the audio m-line in this first offer, but attach no track/source yet: the media
        // is swapped in after CONNECTED (see onConnectionChange + activateAudio) so audio never
        // needs a renegotiation, and the audio device module never runs during the DTLS handshake.
        prepareAudioTransceiver()
        preferH264()
        createOffer()
    }

    // --- data channels ------------------------------------------------------------------

    /** All three are created by the HOST. The viewer never creates them. */
    private fun createDataChannels() {
        val pc = peer ?: return

        controlChannel = pc.createDataChannel("control", DataChannel.Init().apply {
            ordered = true
        })?.also { it.registerObserver(channelObserver(it, callbacks::onControlMessage)) }

        // Transient input (mousemove, wheel) — stale positions are worthless, so let them drop.
        inputChannel = pc.createDataChannel("input", DataChannel.Init().apply {
            ordered = false
            maxRetransmitTimeMs = 100
        })?.also { it.registerObserver(channelObserver(it, callbacks::onInputMessage)) }

        // Clicks and keys must never be lost or reordered.
        criticalChannel = pc.createDataChannel("input-critical", DataChannel.Init().apply {
            ordered = true
        })?.also { it.registerObserver(channelObserver(it, callbacks::onInputMessage)) }

        // NOTE: deliberately not sending {"type":"input-capabilities","compactV1":true} —
        // the binary input protocol isn't implemented, so the viewer must stay on JSON.
    }

    private fun channelObserver(channel: DataChannel, onMessage: (JsonObject) -> Unit) =
        object : DataChannel.Observer {
            override fun onBufferedAmountChange(previousAmount: Long) = Unit
            override fun onStateChange() {
                Log.d(TAG, "channel ${channel.label()} -> ${channel.state()}")
            }

            override fun onMessage(buffer: DataChannel.Buffer) {
                if (buffer.binary) return // binary frames are file-transfer chunks (M3)
                val bytes = ByteArray(buffer.data.remaining()).also { buffer.data.get(it) }
                val parsed = runCatching {
                    json.parseToJsonElement(String(bytes)) as JsonObject
                }.getOrNull() ?: return
                onMessage(parsed)
            }
        }

    fun sendControl(payload: String) {
        val buffer = DataChannel.Buffer(java.nio.ByteBuffer.wrap(payload.toByteArray()), false)
        controlChannel?.send(buffer)
    }

    // --- capture -----------------------------------------------------------------------

    private fun startCapture(projectionIntent: Intent, width: Int, height: Int) {
        val callback = object : android.media.projection.MediaProjection.Callback() {
            override fun onStop() {
                // Fires when the user revokes consent, and — on Android 15 with a PIN set —
                // every time the keyguard engages. The host treats this reason specially and
                // re-acquires rather than ending the session.
                Log.w(TAG, "MediaProjection stopped by system")
                callbacks.onClosed(REASON_PROJECTION_STOPPED)
            }
        }

        val screenCapturer = ProjectionCapturer(projectionIntent, callback)
        capturer = screenCapturer

        val helper = SurfaceTextureHelper.create("CaptureThread", eglBase.eglBaseContext)
        surfaceHelper = helper
        videoSource = factory.createVideoSource(true).also { source ->
            screenCapturer.initialize(helper, appContext, source.capturerObserver)
        }

        val (w, h) = scaleToLongEdge(width, height, quality.maxLongEdge)
        screenCapturer.startCapture(w, h, quality.fps)

        videoTrack = factory.createVideoTrack("screen", videoSource)
        peer?.addTrack(videoTrack, listOf("remote365-stream"))
    }

    /** Android hardware H.264 encoders are typically Level 3.1 (~0.9 Mpx) — scale, don't force. */
    private fun scaleToLongEdge(width: Int, height: Int, maxLongEdge: Int): Pair<Int, Int> {
        val longEdge = maxOf(width, height)
        if (longEdge <= maxLongEdge) return width to height
        val ratio = maxLongEdge.toDouble() / longEdge
        // Keep both dimensions even; odd sizes break some hardware encoders.
        fun even(v: Double) = (v.toInt() / 2) * 2
        return even(width * ratio) to even(height * ratio)
    }

    // --- codec -------------------------------------------------------------------------

    /**
     * H.264 first as a *preference*, not a restriction — VP8/VP9 stay behind it so a viewer
     * that can't do H.264 still connects.
     */
    private fun preferH264() {
        val transceiver = peer?.transceivers?.firstOrNull {
            it.mediaType == MediaStreamTrack.MediaType.MEDIA_TYPE_VIDEO
        } ?: return

        val capabilities: RtpCapabilities =
            factory.getRtpSenderCapabilities(MediaStreamTrack.MediaType.MEDIA_TYPE_VIDEO)
        val (h264, rest) = capabilities.codecs.partition {
            it.name.equals("H264", ignoreCase = true)
        }
        if (h264.isEmpty()) {
            Log.w(TAG, "no H264 codec advertised; leaving default preferences")
            return
        }
        runCatching { transceiver.setCodecPreferences(h264 + rest) }
            .onFailure { Log.w(TAG, "setCodecPreferences failed", it) }
    }

    // --- offer / answer ------------------------------------------------------------------

    /** The HOST always creates the offer. The server rejects an `answer` sent by a host. */
    fun createOffer() {
        val pc = peer ?: return
        pc.createOffer(object : SimpleSdpObserver() {
            override fun onCreateSuccess(description: SessionDescription) {
                val tuned = SdpTuning.seedBitrate(description.description, quality)
                val local = SessionDescription(description.type, tuned)
                pc.setLocalDescription(object : SimpleSdpObserver() {
                    override fun onSetSuccess() = callbacks.onLocalOffer(tuned)
                }, local)
            }
        }, MediaConstraints())
    }

    /**
     * Network came back (or changed) under a live session: regather on the new interface and
     * re-offer. The viewer already handles a mid-session offer (it is the same path its own
     * relay-reroute `request-offer` uses), so this is a renegotiation, not a teardown.
     * A no-op without a peer.
     */
    fun restartIce() {
        val pc = peer ?: return
        Log.i(TAG, "ICE restart (peer state ${connectionState})")
        runCatching { pc.restartIce() }
            .onFailure { Log.w(TAG, "restartIce failed", it) }
        createOffer()
    }

    /**
     * Viewers re-send the answer while they wait for the connection to come up, so duplicates
     * are normal. Applying one in STABLE throws "Called in wrong state" and, on some builds,
     * tears down the transceivers — so only accept an answer we actually have an offer for.
     */
    fun acceptAnswer(sdp: String) {
        val pc = peer ?: return
        if (pc.signalingState() != PeerConnection.SignalingState.HAVE_LOCAL_OFFER) {
            Log.d(TAG, "ignoring duplicate answer in state ${pc.signalingState()}")
            return
        }
        pc.setRemoteDescription(
            SimpleSdpObserver(),
            SessionDescription(SessionDescription.Type.ANSWER, sdp),
        )
    }

    fun addIceCandidate(candidate: String, sdpMid: String?, sdpMLineIndex: Int?) {
        peer?.addIceCandidate(IceCandidate(sdpMid.orEmpty(), sdpMLineIndex ?: 0, candidate))
    }

    fun applyQuality(mode: String?) {
        val next = Quality.fromMode(mode)
        if (next == quality) return
        quality = next
        // Re-negotiate bitrate via sender parameters rather than restarting the capturer —
        // restarting would invalidate the one-shot projection token.
        peer?.senders
            ?.firstOrNull { it.track()?.kind() == MediaStreamTrack.VIDEO_TRACK_KIND }
            ?.let { sender ->
                val params = sender.parameters
                params.encodings.forEach { it.maxBitrateBps = next.bitrateKbps * 1000 }
                sender.parameters = params
            }
    }

    fun close(reason: String) {
        audio?.endSession()
        runCatching { capturer?.stopCapture() }
        capturer?.dispose()
        videoTrack?.dispose()
        videoSource?.dispose()
        audioTrack?.dispose()
        audioSource?.dispose()
        surfaceHelper?.dispose()
        peer?.close()
        peer = null
        capturer = null
        audioTrack = null
        audioSource = null
        callbacks.onClosed(reason)
    }

    // --- audio -------------------------------------------------------------------------

    /**
     * Put the send-only audio m-line into the FIRST offer, but with NO track and NO audio source
     * yet. The m-line rides the initial negotiation so audio never needs a later renegotiation —
     * renegotiating to add audio restarts the DTLS handshake on this host/viewer pair, and that
     * second handshake never completes (video keeps its first-handshake SRTP keys; audio would
     * get none). The real track is attached later in [activateAudio], after the transport is up.
     */
    private fun prepareAudioTransceiver() {
        val audio = audio ?: return
        if (!audio.hasPermission) {
            Log.w(TAG, "RECORD_AUDIO not granted; session has no audio track")
            return
        }
        audioTransceiver = peer?.addTransceiver(
            MediaStreamTrack.MediaType.MEDIA_TYPE_AUDIO,
            RtpTransceiver.RtpTransceiverInit(
                RtpTransceiver.RtpTransceiverDirection.SEND_ONLY,
                listOf("remote365-stream"),
            ),
        )
    }

    /**
     * Attach the real phone-audio track to the pre-negotiated sender via replaceTrack (setTrack) —
     * no renegotiation, so the live DTLS/SRTP transport is never disturbed. Creating the audio
     * source HERE (not before the offer) also keeps the audio device module from starting up during
     * the initial DTLS handshake. Called once, after the video transport reaches CONNECTED.
     */
    private fun activateAudio() {
        val audio = audio ?: return
        // getTransceivers() refreshes Java wrappers and disposes the previous ones. Codec
        // selection may have done that since prepareAudioTransceiver(), so reacquire here.
        val sender = peer?.transceivers?.firstOrNull {
            it.mediaType == MediaStreamTrack.MediaType.MEDIA_TYPE_AUDIO
        }?.sender ?: run {
            Log.w(TAG, "no audio sender to attach to; audio skipped")
            return
        }
        // Runs on the main thread (posted from onConnectionChange). Audio failing must never take
        // the live video session down, so every failure here is caught and logged with its cause.
        runCatching {
            audio.beginSession(capturer?.mediaProjection)
            val constraints = MediaConstraints().apply {
                // Raw feed: processing tuned for a duplex call only damages music and far-end speech.
                mandatory.add(MediaConstraints.KeyValuePair("googEchoCancellation", "false"))
                mandatory.add(MediaConstraints.KeyValuePair("googAutoGainControl", "false"))
                mandatory.add(MediaConstraints.KeyValuePair("googNoiseSuppression", "false"))
                mandatory.add(MediaConstraints.KeyValuePair("googHighpassFilter", "false"))
            }
            val source = factory.createAudioSource(constraints)
            audioSource = source
            val track = factory.createAudioTrack("phone-audio", source)
            audioTrack = track
            // Initial activation starts our explicit PCM adapter. It emits digital audio or silence;
            // there is no microphone fallback while the source becomes ready.
            audio.onInstalled = { ok ->
                audioInstalled = ok
                audioResolved = true
                if (!ok) Log.w(TAG, "inner-audio source not installed; muting track (no mic leak)")
                updateAudioEnabled()
            }
            // setTrack on an already-negotiated sender swaps the media with no SDP exchange.
            if (sender.setTrack(track, false)) {
                Log.i(TAG, "audio track attached via replaceTrack (no renegotiation)")
            } else {
                Log.w(TAG, "sender.setTrack returned false; audio not attached")
            }
        }.onFailure { Log.e(TAG, "audio activation failed (video unaffected)", it) }
    }

    private var audioListening = true
    private var audioInstalled = false
    private var audioResolved = false
    private var audioTransceiver: RtpTransceiver? = null
    /** Guards the one-time audio-track attach on the first CONNECTED (see onConnectionChange). */
    @Volatile private var audioStarted = false
    /**
     * Observer callbacks arrive as native->Java JNI calls on WebRTC's signaling thread. Any WebRTC
     * work — or any Java exception — done synchronously inside one leaves a pending JNI exception
     * and native aborts the process (RTC_CHECK !env->ExceptionCheck()). Hop to the main thread.
     */
    private val mainHandler = Handler(Looper.getMainLooper())
    private fun updateAudioEnabled() {
        // Enable startup of the PCM input, then respect readiness and the listening control.
        val on = audioListening && (!audioResolved || audioInstalled)
        audioTrack?.setEnabled(on)
    }

    /** Viewer's `audio-listen` toggle: stop sending when nobody is listening. */
    fun setListening(on: Boolean) {
        audioListening = on
        updateAudioEnabled()
    }

    // --- observers ------------------------------------------------------------------------

    private inner class PeerObserver : PeerConnection.Observer {
        override fun onIceCandidate(candidate: IceCandidate) = callbacks.onIceCandidate(candidate)
        override fun onConnectionChange(newState: PeerConnection.PeerConnectionState) {
            Log.d(TAG, "peer state $newState")
            connectionState = newState
            if (newState == PeerConnection.PeerConnectionState.FAILED) {
                callbacks.onClosed("ice failed")
            }
            // Video transport is up (DTLS complete). Now — and only once — add the audio track and
            // renegotiate. Doing it here instead of in the first offer keeps audio from stalling the
            // initial DTLS handshake. A later reconnect re-enters CONNECTED but the track persists.
            if (newState == PeerConnection.PeerConnectionState.CONNECTED &&
                audio != null && !audioStarted
            ) {
                audioStarted = true
                Log.i(TAG, "video connected; attaching audio to pre-negotiated m-line")
                // Never run this inside the JNI callback (see mainHandler): it aborted the process.
                mainHandler.post { activateAudio() }
            }
        }

        override fun onSignalingChange(state: PeerConnection.SignalingState) = Unit
        override fun onIceConnectionChange(state: PeerConnection.IceConnectionState) {
            Log.i(TAG, "ICE connection state $state")
        }
        override fun onIceConnectionReceivingChange(receiving: Boolean) = Unit
        override fun onIceGatheringChange(state: PeerConnection.IceGatheringState) {
            Log.i(TAG, "ICE gathering state $state")
        }
        override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>) = Unit
        override fun onAddStream(stream: org.webrtc.MediaStream) = Unit
        override fun onRemoveStream(stream: org.webrtc.MediaStream) = Unit
        override fun onDataChannel(channel: DataChannel) = Unit
        override fun onRenegotiationNeeded() = Unit
    }

    private open class SimpleSdpObserver : SdpObserver {
        override fun onCreateSuccess(description: SessionDescription) = Unit
        override fun onSetSuccess() = Unit
        override fun onCreateFailure(error: String?) {
            Log.w(TAG, "sdp create failed: $error")
        }

        override fun onSetFailure(error: String?) {
            Log.w(TAG, "sdp set failed: $error")
        }
    }

    companion object {
        private const val TAG = "WebRtcSession"

        /** Recoverable: the OS pulled the capture token, the peer itself is still fine. */
        const val REASON_PROJECTION_STOPPED = "projection stopped"

        /** Server sends the ICE list in `viewer-joined`; the host never fetches its own. */
        fun parseIceServers(raw: JsonArray?): List<PeerConnection.IceServer> {
            if (raw.isNullOrEmpty()) {
                return listOf(
                    PeerConnection.IceServer.builder("stun:stun.l.google.com:19302")
                        .createIceServer(),
                )
            }
            return raw.mapNotNull { element ->
                val obj = element as? JsonObject ?: return@mapNotNull null
                val urls = when (val u = obj["urls"]) {
                    is JsonPrimitive -> listOf(u.content)
                    is JsonArray -> u.mapNotNull { (it as? JsonPrimitive)?.content }
                    else -> return@mapNotNull null
                }
                PeerConnection.IceServer.builder(urls)
                    .setUsername((obj["username"] as? JsonPrimitive)?.content.orEmpty())
                    .setPassword((obj["credential"] as? JsonPrimitive)?.content.orEmpty())
                    .createIceServer()
            }
        }

        fun createFactory(
            context: Context,
            eglBase: EglBase,
            audioDeviceModule: AudioDeviceModule? = null,
        ): PeerConnectionFactory {
            PeerConnectionFactory.initialize(
                PeerConnectionFactory.InitializationOptions.builder(context)
                    .createInitializationOptions(),
            )
            // DIAG: surface native ICE/DTLS transport logs to logcat (org.webrtc.Logging) so a
            // handshake that stalls after ICE connects is visible. Default build hides them.
            // Must run AFTER initialize(): that call loads the native library this binds to.
            Logging.enableLogToDebugOutput(Logging.Severity.LS_INFO)
            return PeerConnectionFactory.builder()
                .apply { audioDeviceModule?.let { setAudioDeviceModule(it) } }
                .setVideoEncoderFactory(
                    // enableH264HighProfile = false: budget encoders (this A05s) choke on High
                    // profile and back up their queue, dropping every frame. Baseline drains
                    // reliably. enableIntelVp8Encoder stays on as a non-H264 fallback.
                    DefaultVideoEncoderFactory(eglBase.eglBaseContext, true, false),
                )
                .setVideoDecoderFactory(DefaultVideoDecoderFactory(eglBase.eglBaseContext))
                .createPeerConnectionFactory()
        }
    }
}
