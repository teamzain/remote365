package ai.remote365.host.rtc

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioPlaybackCaptureConfiguration
import android.media.AudioRecord
import android.media.MediaRecorder
import android.media.projection.MediaProjection
import android.os.Build
import android.os.Process
import android.util.Log
import org.webrtc.audio.AudioDeviceModule
import org.webrtc.audio.JavaAudioDeviceModule
import org.webrtc.audio.Remote365AudioInput
import java.nio.ByteBuffer
import java.util.concurrent.locks.LockSupport

/** Explicit digital PCM input. No microphone recorder or private-field replacement. */
class HostAudio(private val context: Context) : Remote365AudioInput.Source {
    val hasPermission get() = context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
    private val lock = Any()
    private var projection: MediaProjection? = null
    @Volatile private var capture: AudioRecord? = null
    @Volatile private var callMode = false
    @Volatile private var running = false
    @Volatile var installedOk = false
        private set
    @Volatile var onInstalled: ((Boolean) -> Unit)? = null
    @Volatile var onInputStateChanged: ((Boolean) -> Unit)? = null
    private val callQueue = PcmQueue(9_600)
    private var nextRead = 0L
    private val frame = ByteArray(960)

    fun createAudioDeviceModule(): AudioDeviceModule {
        Remote365AudioInput.source = this
        return JavaAudioDeviceModule.builder(context)
            .setInputSampleRate(48_000).setUseStereoInput(false)
            .setUseHardwareAcousticEchoCanceler(false).setUseHardwareNoiseSuppressor(false)
            .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
            .createAudioDeviceModule()
    }
    fun beginSession(mediaProjection: MediaProjection?) { synchronized(lock) { projection = mediaProjection } }
    fun endSession() {
        synchronized(lock) { projection = null; callMode = false; callQueue.clear() }
        stop()
        onInstalled = null
    }
    override fun configure(sampleRate: Int, channels: Int): Boolean = synchronized(lock) {
        if (sampleRate != 48_000 || channels != 1 || !hasPermission) return false
        capture?.release()
        capture = buildPlaybackRecorder(sampleRate, channels)
        // The PCM input can emit silence or call frames even when ordinary playback is blocked.
        true
    }
    override fun start(): Boolean = synchronized(lock) {
        nextRead = 0
        running = true
        if (!callMode) runCatching { capture?.startRecording() }
            .onFailure { Log.w(TAG, "Playback capture unavailable: ${it.javaClass.simpleName}") }
        installedOk = true
        onInstalled?.invoke(true)
        onInputStateChanged?.invoke(true)
        true
    }
    override fun stop() = synchronized(lock) {
        running = false; installedOk = false
        runCatching { capture?.stop() }
        onInputStateChanged?.invoke(false)
        Unit
    }
    override fun release() = synchronized(lock) {
        runCatching { capture?.release() }; capture = null
        callQueue.clear()
    }
    override fun read(buffer: ByteBuffer, bytes: Int): Int {
        if (bytes != frame.size) return -1
        val now = System.nanoTime()
        if (nextRead < now - 10_000_000L) nextRead = now
        nextRead += 10_000_000L
        while (running) {
            val remaining = nextRead - System.nanoTime()
            if (remaining <= 0) break
            LockSupport.parkNanos(remaining)
        }
        frame.fill(0)
        if (running && callMode) callQueue.read(frame)
        else if (running) {
            val n = runCatching { capture?.read(frame, 0, bytes, AudioRecord.READ_NON_BLOCKING) ?: 0 }.getOrDefault(0)
            if (n < bytes) java.util.Arrays.fill(frame, n.coerceAtLeast(0), bytes, 0.toByte())
        }
        buffer.clear(); buffer.put(frame)
        return bytes
    }
    fun writeCallAudio(bytes: ByteArray, count: Int) { if (callMode) callQueue.write(bytes, count) }
    fun enterCallMode(): Boolean = synchronized(lock) {
        if (!running) return false
        if (!callMode) {
            callQueue.clear()
            runCatching { capture?.stop() }
            callMode = true
        }
        true
    }
    fun exitCallMode() = synchronized(lock) {
        if (callMode) {
            callMode = false; callQueue.clear()
            if (running) runCatching { capture?.startRecording() }
        }
        Unit
    }

    private fun buildPlaybackRecorder(sampleRate: Int, channelCount: Int): AudioRecord? {
        val proj = synchronized(lock) { projection } ?: return null
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || !hasPermission) return null
        val config = AudioPlaybackCaptureConfiguration.Builder(proj)
            .addMatchingUsage(AudioAttributes.USAGE_MEDIA)
            .addMatchingUsage(AudioAttributes.USAGE_GAME)
            .addMatchingUsage(AudioAttributes.USAGE_UNKNOWN)
            .excludeUid(Process.myUid())
            .build()
        val channelMask =
            if (channelCount == 2) AudioFormat.CHANNEL_IN_STEREO else AudioFormat.CHANNEL_IN_MONO
        val format = AudioFormat.Builder()
            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
            .setSampleRate(sampleRate)
            .setChannelMask(channelMask)
            .build()
        val minBuf = AudioRecord.getMinBufferSize(sampleRate, channelMask, AudioFormat.ENCODING_PCM_16BIT)
        val record = runCatching {
            AudioRecord.Builder()
                .setAudioPlaybackCaptureConfig(config)
                .setAudioFormat(format)
                .setBufferSizeInBytes(maxOf(minBuf * 2, sampleRate * 2 * channelCount / 5))
                .build()
        }.onFailure { Log.e(TAG, "playback capture unavailable: ${it.message}") }.getOrNull()
            ?: return null
        if (record.state != AudioRecord.STATE_INITIALIZED) {
            Log.e(TAG, "playback AudioRecord failed to initialise")
            record.release()
            return null
        }
        return record
    }

    /**
     * One-off capability probe: can this app open the call-audio sources at all? Diagnostic only,
     * fired by the debug `TEST_CALLAUDIO` broadcast. Result on the A055F (MediaTek, Android 15):
     * VOICE_CALL/VOICE_DOWNLINK/VOICE_UPLINK all init=false, so hearing the far party without
     * speakerphone is impossible for a non-privileged app on this device.
     */
    fun probeCallSources() {
        val ch = AudioFormat.CHANNEL_IN_MONO
        val fmt = AudioFormat.ENCODING_PCM_16BIT
        val rate = 16_000
        val minBuf = AudioRecord.getMinBufferSize(rate, ch, fmt).coerceAtLeast(4096)
        listOf(
            "VOICE_CALL" to 4,
            "VOICE_DOWNLINK" to 3,
            "VOICE_UPLINK" to 2,
            "VOICE_COMMUNICATION" to MediaRecorder.AudioSource.VOICE_COMMUNICATION,
        ).forEach { (name, source) ->
            val result = runCatching {
                @Suppress("MissingPermission")
                val ar = AudioRecord(source, rate, ch, fmt, minBuf)
                val state = ar.state
                val started = runCatching { ar.startRecording(); ar.recordingState }.getOrNull()
                ar.release()
                "init=${state == AudioRecord.STATE_INITIALIZED} recState=$started"
            }.getOrElse { "DENIED (${it.javaClass.simpleName}: ${it.message})" }
            Log.i(TAG, "call-source probe [$name] -> $result")
        }
    }


    private companion object { const val TAG = "HostAudio" }
}
