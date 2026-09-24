package ai.remote365.callaudio;

import android.content.Context;
import android.content.ContextWrapper;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.os.Build;
import android.os.Process;
import android.util.Log;

import java.lang.reflect.Method;

/**
 * Shared shell-uid AudioRecord factory (used by the persistent daemon and the standalone helper).
 *
 * The attribution is load-bearing: on Android 12+ an AudioRecord with no valid app-ops attribution
 * is fed pure silence. Building it via AudioRecord.Builder.setContext(a FakeContext attributed to
 * com.android.shell / SHELL_UID) is what makes AudioFlinger open the source for real — the same
 * trick scrcpy uses. Runs only in a shell app_process (hidden-API-exempt), so the reflection works.
 */
public final class ShellCapture {

    private static final String TAG = "ShellCapture";
    private static Context cachedSystemContext;

    /** Prepare framework context on the main looper before Binder capture requests arrive. */
    public static void initialize() { systemContext(); }

    /** Open + start a mono PCM16 recorder on [source] at [rate], or null if it can't. */
    public static AudioRecord open(int source, int rate) {
        int chMask = AudioFormat.CHANNEL_IN_MONO;
        int fmt = AudioFormat.ENCODING_PCM_16BIT;
        int minBuf = AudioRecord.getMinBufferSize(rate, chMask, fmt);
        if (minBuf <= 0) { Log.e(TAG, "bad minBuf " + minBuf); return null; }
        int bufBytes = Math.max(minBuf * 8, rate);

        AudioRecord record = null;
        if (Build.VERSION.SDK_INT >= 31) {
            try {
                AudioFormat format = new AudioFormat.Builder()
                        .setEncoding(fmt).setSampleRate(rate).setChannelMask(chMask).build();
                AudioRecord.Builder b = new AudioRecord.Builder()
                        .setAudioSource(source).setAudioFormat(format).setBufferSizeInBytes(bufBytes);
                Context ctx = fakeShellContext();
                if (ctx == null) { Log.e(TAG, "no shell context; capture would be silenced"); return null; }
                Method setContext = AudioRecord.Builder.class.getDeclaredMethod("setContext", Context.class);
                setContext.setAccessible(true);
                setContext.invoke(b, ctx);
                record = b.build();
            } catch (Throwable t) {
                Log.e(TAG, "attributed builder failed: " + t);
                return null;
            }
        }
        if (record == null) {
            try { record = new AudioRecord(source, rate, chMask, fmt, bufBytes); }
            catch (Throwable t) { Log.e(TAG, "plain ctor failed: " + t); return null; }
        }
        if (record.getState() != AudioRecord.STATE_INITIALIZED) {
            Log.e(TAG, "not initialized source=" + source);
            record.release();
            return null;
        }
        try { record.startRecording(); }
        catch (Throwable t) { Log.e(TAG, "startRecording failed: " + t); record.release(); return null; }
        return record;
    }

    private static Context fakeShellContext() {
        try {
            Context system = systemContext();
            if (system == null) return null;
            return new ContextWrapper(system) {
                @Override public String getPackageName() { return "com.android.shell"; }
                @Override public String getOpPackageName() { return "com.android.shell"; }
                @Override public android.content.AttributionSource getAttributionSource() {
                    return new android.content.AttributionSource.Builder(Process.SHELL_UID)
                            .setPackageName("com.android.shell").build();
                }
            };
        } catch (Throwable t) {
            Log.e(TAG, "fakeShellContext failed: " + t);
            return null;
        }
    }

    static synchronized Context systemContext() {
        if (cachedSystemContext != null) return cachedSystemContext;
        try {
            Class<?> at = Class.forName("android.app.ActivityThread");
            Object thread = at.getMethod("systemMain").invoke(null);
            cachedSystemContext = (Context) at.getMethod("getSystemContext").invoke(thread);
            return cachedSystemContext;
        } catch (Throwable t) {
            Log.e(TAG, "systemContext failed: " + t);
            return null;
        }
    }

    private ShellCapture() {}
}
