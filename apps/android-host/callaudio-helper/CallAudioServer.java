package ai.remote365.callaudio;

import android.content.Context;
import android.content.ContextWrapper;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.os.Build;
import android.os.Looper;
import android.os.Process;

import java.io.BufferedOutputStream;
import java.io.OutputStream;
import java.lang.reflect.Method;

/**
 * Shell-uid call-audio server. Launched by the host app as uid 2000 (shell) via
 *   CLASSPATH=<dex> app_process / ai.remote365.callaudio.CallAudioServer <source> <rate>
 * over the app's own ADB pairing (libadb Self-Pair). Shell holds CAPTURE_AUDIO_OUTPUT, so —
 * unlike our app uid — it can open the VOICE_* telephony sources.
 *
 * It writes a 16-byte little-endian header then raw PCM16 mono to STDOUT (which the app reads
 * back over the same ADB exec stream). Diagnostics go to STDERR so they never corrupt the audio.
 *
 * Header: magic 'R','3','C','A'(4) | sampleRate(4) | channels(4) | source(4).
 *
 * The FakeContext (com.android.shell / SHELL_UID attribution) is what keeps AudioFlinger from
 * silencing the capture on Android 12+ — the same trick scrcpy uses for shell-side AudioRecord.
 */
public final class CallAudioServer {

    private static final String TAG = "CallAudioServer";
    // AudioSource ints (android.media.MediaRecorder.AudioSource): kept as literals so this file
    // has no dependency on a build against a specific SDK.
    static final int MIC = 1, VOICE_UPLINK = 2, VOICE_DOWNLINK = 3, VOICE_CALL = 4, VOICE_RECOGNITION = 6, VOICE_COMMUNICATION = 7;

    public static void main(String[] args) {
        int source = args.length > 0 ? parseSource(args[0]) : VOICE_DOWNLINK;
        // Two modes:
        //   <source> <rate>                stream PCM to stdout (production, launched by the app)
        //   <source> measure <seconds>     measure loudness and PRINT a verdict (manual USB test)
        boolean measure = args.length > 1 && args[1].equalsIgnoreCase("measure");
        int rate = 48000;
        int seconds = 8;
        if (measure) {
            if (args.length > 2) seconds = Integer.parseInt(args[2]);
        } else if (args.length > 1) {
            rate = Integer.parseInt(args[1]);
        }
        try {
            Looper.prepareMainLooper();
        } catch (Throwable ignored) {
            // Some ROMs already have a looper on the app_process main thread.
        }
        if (measure) measure(source, rate, seconds); else run(source, rate);
    }

    /** Manual test: open [source], read for [seconds], print AUDIO_PRESENT/SILENT + dBFS to stdout. */
    private static void measure(int source, int rate, int seconds) {
        int chMask = AudioFormat.CHANNEL_IN_MONO;
        int fmt = AudioFormat.ENCODING_PCM_16BIT;
        int minBuf = AudioRecord.getMinBufferSize(rate, chMask, fmt);
        if (minBuf <= 0) { System.out.println("RESULT=BAD_MINBUF"); return; }
        AudioRecord record = build(source, rate, chMask, fmt, minBuf);
        if (record == null || record.getState() != AudioRecord.STATE_INITIALIZED) {
            System.out.println("RESULT=NOT_INITIALIZED source=" + source);
            if (record != null) record.release();
            return;
        }
        try { record.startRecording(); } catch (Throwable t) {
            System.out.println("RESULT=START_FAIL " + t); record.release(); return;
        }
        byte[] buf = new byte[minBuf];
        long samples = 0; double sumSq = 0; int peak = 0;
        long end = System.currentTimeMillis() + seconds * 1000L;
        while (System.currentTimeMillis() < end) {
            int n = record.read(buf, 0, buf.length);
            if (n < 0) break;
            for (int i = 0; i + 1 < n; i += 2) {
                int s = (short) ((buf[i] & 0xFF) | (buf[i + 1] << 8));
                sumSq += (double) s * s; samples++;
                int a = Math.abs(s); if (a > peak) peak = a;
            }
        }
        try { record.stop(); } catch (Throwable ignored) {}
        record.release();
        double rms = samples > 0 ? Math.sqrt(sumSq / samples) : 0;
        double dbfs = rms > 0 ? 20 * Math.log10(rms / 32768.0) : -999;
        System.out.println("RESULT=" + (rms > 30 ? "AUDIO_PRESENT" : "SILENT")
                + " source=" + source + " rms=" + String.format("%.1f", rms)
                + " dBFS=" + String.format("%.1f", dbfs) + " peak=" + peak);
    }

    private static void run(int source, int rate) {
        int chMask = AudioFormat.CHANNEL_IN_MONO;
        int fmt = AudioFormat.ENCODING_PCM_16BIT;
        int minBuf = AudioRecord.getMinBufferSize(rate, chMask, fmt);
        if (minBuf <= 0) { err("BAD_MINBUF " + minBuf); return; }

        AudioRecord record = build(source, rate, chMask, fmt, minBuf);
        if (record == null) { err("RESULT=CTOR_FAIL source=" + source); return; }
        if (record.getState() != AudioRecord.STATE_INITIALIZED) {
            err("RESULT=NOT_INITIALIZED source=" + source);
            record.release();
            return;
        }
        try {
            record.startRecording();
        } catch (Throwable t) {
            err("RESULT=START_FAIL " + t);
            record.release();
            return;
        }
        // NOTHING to stderr on the success path: some adb `exec:` transports merge stderr into the
        // stdout pipe, which would corrupt the header/PCM the app reads. Diagnostics only on failure
        // (before any stdout is written), where a truncated/absent stream is the signal anyway.

        OutputStream stdout = new BufferedOutputStream(System.out, 64 * 1024);
        try {
            writeHeader(stdout, rate, 1, source);
            byte[] buf = new byte[minBuf];
            // A "keepalive" so the app can distinguish a wedged source from a silent line: we
            // always forward whatever read() returns, silence included, at real-time cadence.
            while (true) {
                int n = record.read(buf, 0, buf.length);
                if (n < 0) { err("read=" + n); break; }
                if (n > 0) { stdout.write(buf, 0, n); stdout.flush(); }
            }
        } catch (Throwable t) {
            err("WRITE_FAIL " + t); // broken pipe = app closed the stream = normal stop
        } finally {
            try { record.stop(); } catch (Throwable ignored) {}
            record.release();
        }
    }

    /**
     * scrcpy-style: build the recorder with a shell-attributed Context so AudioFlinger opens the
     * source for real instead of feeding silence. On Android 12+ an AudioRecord with no valid
     * app-ops attribution is silently zero-filled — which is exactly what "peak=0" was — so the
     * FakeContext (com.android.shell / SHELL_UID via getAttributionSource) is mandatory, not
     * optional. If setContext cannot be applied we return null rather than a silent recorder.
     */
    private static AudioRecord build(int source, int rate, int chMask, int fmt, int minBuf) {
        int bufBytes = Math.max(minBuf * 8, rate); // 8x min: latency headroom without overrun
        if (Build.VERSION.SDK_INT >= 31) {
            try {
                AudioFormat format = new AudioFormat.Builder()
                        .setEncoding(fmt).setSampleRate(rate).setChannelMask(chMask).build();
                AudioRecord.Builder b = new AudioRecord.Builder()
                        .setAudioSource(source).setAudioFormat(format).setBufferSizeInBytes(bufBytes);
                Context ctx = fakeShellContext();
                if (ctx == null) { err("no shell context; capture would be silenced"); return null; }
                // setContext(Context) is @hide; shell app_process is exempt from hidden-API limits.
                Method setContext = AudioRecord.Builder.class.getDeclaredMethod("setContext", Context.class);
                setContext.setAccessible(true);
                setContext.invoke(b, ctx);
                return b.build();
            } catch (Throwable t) {
                err("attributed builder failed: " + t);
                return null;
            }
        }
        try {
            return new AudioRecord(source, rate, chMask, fmt, bufBytes);
        } catch (Throwable t) {
            err("plain ctor failed: " + t);
            return null;
        }
    }

    // --- shell attribution (com.android.shell / SHELL_UID) ---------------------------------

    private static Context fakeShellContext() {
        try {
            Context system = systemContext();
            if (system == null) return null;
            return new ContextWrapper(system) {
                @Override public String getPackageName() { return "com.android.shell"; }
                @Override public String getOpPackageName() { return "com.android.shell"; }
                @Override public android.content.AttributionSource getAttributionSource() {
                    // AudioFlinger validates (uid=2000, pkg="com.android.shell") as a genuine
                    // system component and opens VOICE_* / MIC for real. This is the line that
                    // turns "peak=0 silence" into actual audio.
                    return new android.content.AttributionSource.Builder(Process.SHELL_UID)
                            .setPackageName("com.android.shell")
                            .build();
                }
            };
        } catch (Throwable t) {
            err("fakeShellContext failed: " + t);
            return null;
        }
    }

    private static Context systemContext() {
        try {
            Class<?> at = Class.forName("android.app.ActivityThread");
            Method systemMain = at.getMethod("systemMain");
            Object thread = systemMain.invoke(null);
            Method getSystemContext = at.getMethod("getSystemContext");
            return (Context) getSystemContext.invoke(thread);
        } catch (Throwable t) {
            err("systemContext failed: " + t);
            return null;
        }
    }

    // --- io helpers ------------------------------------------------------------------------

    private static void writeHeader(OutputStream o, int rate, int channels, int source) throws Exception {
        byte[] h = new byte[16];
        h[0] = 'R'; h[1] = '3'; h[2] = 'C'; h[3] = 'A';
        putInt(h, 4, rate); putInt(h, 8, channels); putInt(h, 12, source);
        o.write(h); o.flush();
    }

    private static void putInt(byte[] b, int o, int v) {
        b[o] = (byte) v; b[o + 1] = (byte) (v >> 8); b[o + 2] = (byte) (v >> 16); b[o + 3] = (byte) (v >> 24);
    }

    private static int parseSource(String s) {
        try { return Integer.parseInt(s); } catch (NumberFormatException e) { return VOICE_DOWNLINK; }
    }

    private static void err(String s) { System.err.println(TAG + ": " + s); }

    private CallAudioServer() {}
}
