package org.webrtc.audio;

import android.content.Context;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Process;
import org.webrtc.Logging;
import java.nio.ByteBuffer;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;

/**
 * Remote365 PCM adapter for stream-webrtc-android 1.3.8's existing JNI ABI.
 * The build removes that AAR's microphone input class (and only that class family).
 * Keep constructors, JNI entry points and module-facing methods compatible when upgrading.
 */
class WebRtcAudioRecord {
    public static final int DEFAULT_AUDIO_SOURCE = 7;
    public static final int DEFAULT_AUDIO_FORMAT = 2;
    private long nativeAudioRecord;
    private ByteBuffer byteBuffer;
    private byte[] silence;
    private Thread worker;
    private volatile boolean running;
    private volatile boolean microphoneMute;
    private Remote365AudioInput.Source input;
    private final JavaAudioDeviceModule.AudioRecordErrorCallback errorCallback;
    private final JavaAudioDeviceModule.AudioRecordStateCallback stateCallback;

    WebRtcAudioRecord(Context context, AudioManager manager) {
        this(context, null, manager, DEFAULT_AUDIO_SOURCE, DEFAULT_AUDIO_FORMAT, null, null, null, false, false);
    }
    public WebRtcAudioRecord(Context context, ScheduledExecutorService executor, AudioManager manager,
        int source, int format, JavaAudioDeviceModule.AudioRecordErrorCallback errors,
        JavaAudioDeviceModule.AudioRecordStateCallback state,
        JavaAudioDeviceModule.SamplesReadyCallback samples, boolean aec, boolean ns) {
        errorCallback = errors; stateCallback = state;
    }
    public void setNativeAudioRecord(long pointer) { nativeAudioRecord = pointer; }
    boolean isAcousticEchoCancelerSupported() { return false; }
    boolean isNoiseSuppressorSupported() { return false; }
    boolean isAudioConfigVerified() { return input != null; }
    boolean isAudioSourceMatchingRecordingSession() { return input != null; }
    private boolean enableBuiltInAEC(boolean enable) { return !enable; }
    private boolean enableBuiltInNS(boolean enable) { return !enable; }
    public boolean setNoiseSuppressorEnabled(boolean enable) { return !enable; }
    void setPreferredDevice(AudioDeviceInfo device) { /* Direct digital input has no mic route. */ }
    public void setMicrophoneMute(boolean mute) { microphoneMute = mute; }
    static ScheduledExecutorService newDefaultScheduler() {
        return Executors.newSingleThreadScheduledExecutor(r -> {
            Thread thread = new Thread(r, "Remote365AudioScheduler"); thread.setDaemon(true); return thread;
        });
    }

    private int initRecording(int rate, int channels) {
        if (worker != null) return -1;
        input = Remote365AudioInput.source;
        if (rate != 48000 || channels != 1 || input == null || !input.configure(rate, channels)) {
            if (errorCallback != null) errorCallback.onWebRtcAudioRecordInitError("PCM source unavailable");
            return -1;
        }
        byteBuffer = ByteBuffer.allocateDirect(rate / 100 * channels * 2);
        silence = new byte[byteBuffer.capacity()];
        nativeCacheDirectBufferAddress(nativeAudioRecord, byteBuffer);
        return rate / 100;
    }
    private boolean startRecording() {
        if (worker != null || input == null || !input.start()) {
            if (errorCallback != null) errorCallback.onWebRtcAudioRecordStartError(
                JavaAudioDeviceModule.AudioRecordStartErrorCode.AUDIO_RECORD_START_EXCEPTION, "PCM input failed to start");
            return false;
        }
        running = true;
        worker = new Thread(() -> {
            Process.setThreadPriority(Process.THREAD_PRIORITY_URGENT_AUDIO);
            if (stateCallback != null) stateCallback.onWebRtcAudioRecordStart();
            try {
                while (running) {
                    byteBuffer.clear();
                    int read = input.read(byteBuffer, byteBuffer.capacity());
                    if (!running) break;
                    if (read != byteBuffer.capacity()) throw new IllegalStateException("Incomplete PCM frame");
                    if (microphoneMute) { byteBuffer.clear(); byteBuffer.put(silence); }
                    nativeDataIsRecorded(nativeAudioRecord, read, System.nanoTime());
                }
            } catch (Exception e) {
                Logging.e("Remote365PcmInput", "PCM input ended", e);
                if (errorCallback != null) errorCallback.onWebRtcAudioRecordError("PCM input ended");
            } finally {
                running = false;
                input.stop();
                if (stateCallback != null) stateCallback.onWebRtcAudioRecordStop();
            }
        }, "Remote365PcmInput");
        worker.start(); return true;
    }
    private boolean stopRecording() {
        running = false;
        if (input != null) input.stop();
        if (worker != null) {
            java.util.concurrent.locks.LockSupport.unpark(worker);
            try { worker.join(2000); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            if (worker.isAlive()) return false;
            worker = null;
        }
        if (input != null) { input.release(); input = null; }
        return true;
    }
    private native void nativeCacheDirectBufferAddress(long pointer, ByteBuffer buffer);
    private native void nativeDataIsRecorded(long pointer, int bytes, long captureTimeNs);
}
