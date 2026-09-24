package ai.remote365.host.net

import ai.remote365.host.BuildConfig
import android.os.Build
import android.os.SystemClock
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.util.concurrent.TimeUnit

/**
 * Host-role signaling client.
 *
 * Protocol notes that are easy to get wrong:
 *  - No auth in headers or query. The token rides inside the first `register` message.
 *  - The HOST creates the WebRTC offer; the viewer answers. The server actively rejects an
 *    `answer` sent by a host.
 *  - Server pings every 20s and terminates after 3 unanswered. We reply `pong` and also send
 *    our own `heartbeat` every 25s to keep the 90s Redis presence TTL alive.
 *  - `viewer-joined` without `remoteSessionId`/`expiresAt` must be refused with `host-stopped`.
 *
 * Connection-lifecycle rules (learned from the Airplane Mode bug):
 *  - Exactly ONE socket at a time. [connect] tears down whatever is in flight first, so two
 *    sockets can never register the same access key and then flap as the server closes the
 *    older one. Every socket carries a generation number and callbacks from a superseded
 *    generation are ignored — a stale socket dying late must not trigger a reconnect of a
 *    healthy one.
 *  - A dead network does not reliably produce `onFailure`. A silence watchdog treats
 *    [SILENCE_TIMEOUT_MS] without any inbound frame (the server pings every 20s) as a dead
 *    socket and cancels it, which surfaces as a normal disconnect.
 */
class SignalingClient(
    private val scope: CoroutineScope,
    private val identity: HostIdentity,
    private val listener: Listener,
) {

    interface Listener {
        fun onRegistered(sessionId: String, connectionId: String)
        fun onRegistrationError(error: String)
        /** Approval path: reply with [approve] / [deny] within 30s or the server auto-denies. */
        fun onViewerRequest(viewerId: String, viewerName: String?, viewerDeviceId: String?)
        fun onViewerRequestCancelled(viewerId: String)
        /** Cleared to start capture and send an offer. [iceServers] comes from the server. */
        fun onViewerJoined(viewerId: String, iceServers: JsonObject?, remoteSessionId: String, expiresAt: String)
        fun onAnswer(senderId: String, sdp: String)
        fun onIceCandidate(senderId: String, candidate: String, sdpMid: String?, sdpMLineIndex: Int?)
        fun onRequestOffer(senderId: String)
        fun onViewerLeft(viewerId: String)
        fun onSessionExpiring(secondsRemaining: Int)
        fun onSessionExpired(remoteSessionId: String)
        fun onDisconnected(reason: String)
    }

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val http = OkHttpClient.Builder()
        // Bound the handshake so a half-up network fails fast instead of hanging an attempt.
        .connectTimeout(CONNECT_TIMEOUT_MS, TimeUnit.MILLISECONDS)
        .pingInterval(0, TimeUnit.SECONDS) // we manage keepalive at the app layer
        .retryOnConnectionFailure(true)
        .build()

    private val lock = Any()
    private var socket: WebSocket? = null
    @Volatile private var generation = 0
    private var heartbeatJob: Job? = null
    private var watchdogJob: Job? = null
    private var connectionId: String? = null

    /** Last time any frame arrived on the CURRENT socket (elapsedRealtime). */
    @Volatile private var lastInboundAt = 0L

    /** True between `registered` and the socket going away. */
    @Volatile
    var isRegistered = false
        private set

    /** Optional user JWT. A valid hostSecret alone is enough for an owned ANDROID device. */
    var userToken: String? = null

    /**
     * Open a fresh socket, replacing any existing or in-flight one. Safe to call at any time;
     * the caller (HostService) owns retry pacing.
     */
    fun connect() {
        val gen: Int
        synchronized(lock) {
            // Retire the previous socket silently: its callbacks are now stale by generation.
            socket?.cancel()
            socket = null
            gen = ++generation
            isRegistered = false
            stopHeartbeat()
            stopWatchdog()
            lastInboundAt = SystemClock.elapsedRealtime()
        }
        Log.i(TAG, "connecting to ${BuildConfig.SIGNALING_URL} (gen $gen)")
        val request = Request.Builder().url(BuildConfig.SIGNALING_URL).build()
        val ws = http.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                if (!isCurrent(gen)) { webSocket.cancel(); return }
                Log.i(TAG, "socket open (HTTP ${response.code}, gen $gen)")
                lastInboundAt = SystemClock.elapsedRealtime()
                register()
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                if (!isCurrent(gen)) return
                lastInboundAt = SystemClock.elapsedRealtime()
                Log.d(TAG, "recv ${text.take(300)}")
                handle(text)
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                // Complete the close handshake so the TCP connection is released promptly.
                runCatching { webSocket.close(code, reason) }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                if (!isCurrent(gen)) {
                    Log.d(TAG, "stale socket (gen $gen) failed: ${t.message}")
                    return
                }
                Log.e(TAG, "socket failure (HTTP ${response?.code}, gen $gen): ${t.message}")
                markDown(gen)
                listener.onDisconnected(t.message ?: "socket failure")
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                if (!isCurrent(gen)) return
                Log.w(TAG, "socket closed $code $reason (gen $gen)")
                markDown(gen)
                listener.onDisconnected(reason.ifEmpty { "closed ($code)" })
            }
        })
        synchronized(lock) {
            if (gen == generation) {
                socket = ws
                startWatchdog(gen)
            } else {
                ws.cancel()
            }
        }
    }

    fun disconnect() {
        synchronized(lock) {
            stopHeartbeat()
            stopWatchdog()
            send(buildJsonObject { put("type", "unregister") })
            socket?.close(1000, "client disconnect")
            socket = null
            generation++ // orphan any late callbacks
            isRegistered = false
        }
    }

    private fun isCurrent(gen: Int) = gen == generation

    /** Socket [gen] is gone: drop timers and state, but only if it is still the current one. */
    private fun markDown(gen: Int) {
        synchronized(lock) {
            if (gen != generation) return
            isRegistered = false
            connectionId = null
            stopHeartbeat()
            stopWatchdog()
            socket = null
        }
    }

    private fun register() {
        val accessKey = identity.accessKey ?: run {
            listener.onRegistrationError("no access key — self-register first")
            return
        }
        send(buildJsonObject {
            put("type", "register")
            put("role", "host")
            put("accessKey", accessKey)
            put("hostSecret", identity.hostSecret())
            userToken?.let { put("token", it) }
            put("clientKind", "android-host")
            put("appVersion", BuildConfig.VERSION_NAME)
            put("platform", "android")
            put("model", "${Build.MANUFACTURER} ${Build.MODEL}")
        })
    }

    private fun handle(text: String) {
        val msg = runCatching { json.parseToJsonElement(text) as JsonObject }.getOrNull() ?: return
        val sender = msg.str("senderId")

        when (msg.str("type")) {
            "registered" -> {
                connectionId = msg.str("connectionId")
                isRegistered = true
                startHeartbeat()
                listener.onRegistered(msg.str("sessionId").orEmpty(), connectionId.orEmpty())
            }
            "registration-error" -> listener.onRegistrationError(msg.str("error").orEmpty())

            // Server liveness. 3 missed pongs and we get terminated.
            "ping" -> send(buildJsonObject { put("type", "pong") })

            "viewer-request" -> listener.onViewerRequest(
                msg.str("viewerId").orEmpty(), msg.str("viewerName"), msg.str("viewerDeviceId"),
            )
            "viewer-request-cancelled" ->
                listener.onViewerRequestCancelled(msg.str("viewerId").orEmpty())

            "viewer-joined" -> {
                val viewerId = msg.str("viewerId").orEmpty()
                val remoteSessionId = msg.str("remoteSessionId")
                val expiresAt = msg.str("expiresAt")
                // A grant-less join is not a valid session — refuse it.
                if (remoteSessionId.isNullOrBlank() || expiresAt.isNullOrBlank()) {
                    Log.w(TAG, "viewer-joined missing grant fields; refusing")
                    hostStopped(viewerId)
                    return
                }
                listener.onViewerJoined(
                    viewerId, msg["iceServers"] as? JsonObject, remoteSessionId, expiresAt,
                )
            }

            "answer" -> listener.onAnswer(sender.orEmpty(), msg.str("sdp").orEmpty())
            "ice-candidate" -> listener.onIceCandidate(
                sender.orEmpty(),
                msg.str("candidate").orEmpty(),
                msg.str("sdpMid"),
                (msg["sdpMLineIndex"] as? kotlinx.serialization.json.JsonPrimitive)?.int,
            )
            "request-offer" -> listener.onRequestOffer(sender.orEmpty())
            "viewer-left" -> listener.onViewerLeft(msg.str("viewerId").orEmpty())
            "remote-session-expiring" -> listener.onSessionExpiring(
                (msg["secondsRemaining"] as? kotlinx.serialization.json.JsonPrimitive)?.int ?: 0,
            )
            "remote-session-expired" ->
                listener.onSessionExpired(msg.str("remoteSessionId").orEmpty())
        }
    }

    // --- outbound -----------------------------------------------------------------------

    fun approve(viewerId: String, trustDevice: Boolean) = send(buildJsonObject {
        put("type", "join-approve"); put("viewerId", viewerId); put("trustDevice", trustDevice)
    })

    fun deny(viewerId: String) = send(buildJsonObject {
        put("type", "join-deny"); put("viewerId", viewerId)
    })

    fun sendOffer(targetId: String, sdp: String) = send(buildJsonObject {
        put("type", "offer"); put("targetId", targetId); put("sdp", sdp)
        put("hostType", "android")
    })

    fun sendIceCandidate(targetId: String, candidate: String, sdpMid: String?, sdpMLineIndex: Int?) =
        send(buildJsonObject {
            put("type", "ice-candidate"); put("targetId", targetId); put("candidate", candidate)
            sdpMid?.let { put("sdpMid", it) }
            sdpMLineIndex?.let { put("sdpMLineIndex", it) }
        })

    fun hostStopped(targetId: String) = send(buildJsonObject {
        put("type", "host-stopped"); put("targetId", targetId)
    })

    private fun send(obj: JsonObject) {
        socket?.send(json.encodeToString(JsonObject.serializer(), obj))
    }

    // --- keepalive ----------------------------------------------------------------------

    private fun startHeartbeat() {
        stopHeartbeat()
        heartbeatJob = scope.launch {
            while (isActive) {
                delay(HEARTBEAT_MS)
                send(buildJsonObject {
                    put("type", "heartbeat")
                    put("appVersion", BuildConfig.VERSION_NAME)
                    put("platform", "android")
                })
            }
        }
    }

    private fun stopHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = null
    }

    /**
     * Silence watchdog for socket [gen]. The server pings every 20s, so a socket that has
     * received nothing for [SILENCE_TIMEOUT_MS] is dead even if the OS never told us — typical
     * after Airplane Mode, Doze, or a Wi-Fi handover where the old route just goes black.
     * Cancelling the socket surfaces as `onFailure`, i.e. a normal disconnect for the service.
     */
    private fun startWatchdog(gen: Int) {
        stopWatchdog()
        watchdogJob = scope.launch {
            while (isActive) {
                delay(SILENCE_CHECK_MS)
                if (!isCurrent(gen)) return@launch
                val silentFor = SystemClock.elapsedRealtime() - lastInboundAt
                if (silentFor < SILENCE_TIMEOUT_MS) continue
                Log.w(TAG, "no frames for ${silentFor / 1000}s; declaring socket dead (gen $gen)")
                val dead = synchronized(lock) { if (gen == generation) socket else null }
                if (dead != null) {
                    dead.cancel() // -> onFailure -> listener.onDisconnected
                } else {
                    markDown(gen)
                    listener.onDisconnected("silence timeout")
                }
                return@launch
            }
        }
    }

    private fun stopWatchdog() {
        watchdogJob?.cancel()
        watchdogJob = null
    }

    private fun JsonObject.str(key: String): String? =
        (this[key] as? kotlinx.serialization.json.JsonPrimitive)?.jsonPrimitive?.contentOrNull()

    private fun kotlinx.serialization.json.JsonPrimitive.contentOrNull(): String? =
        if (this is kotlinx.serialization.json.JsonNull) null else content

    companion object {
        private const val TAG = "SignalingClient"
        /** Server TTL is 90s; the RN host uses 25s. Stay well inside it. */
        private const val HEARTBEAT_MS = 25_000L
        private const val CONNECT_TIMEOUT_MS = 12_000L
        /** Server pings every 20s; three missed pings is how it judges us, so mirror that. */
        private const val SILENCE_TIMEOUT_MS = 60_000L
        private const val SILENCE_CHECK_MS = 10_000L
    }
}
