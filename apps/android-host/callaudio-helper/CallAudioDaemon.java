package ai.remote365.callaudio;
import android.content.Intent;
import android.media.AudioRecord;
import android.os.*;
import android.util.Log;
import java.io.*;
import java.lang.reflect.Method;

/** Detached shell helper. Survival after disabling debugging is device-dependent. */
public final class CallAudioDaemon {
    private static final String TAG = "CallAudioDaemon";
    private static final String ACTION_BINDER = "ai.remote365.host.CALLAUDIO_BINDER";
    private static final String EXTRA_BINDER = "binder";
    private static android.net.LocalServerSocket singletonLock;
    private static int targetUser;
    public static void main(String[] args) throws Exception {
        if (args.length != 3 || android.os.Process.myUid() != 2000) return;
        String appPackage = args[0];
        int clientUid = Integer.parseInt(args[1]);
        targetUser = clientUid / 100000;
        File secretFile = new File(args[2]);
        String secret;
        try (BufferedReader reader = new BufferedReader(new FileReader(secretFile))) {
            secret = reader.readLine();
        } finally { secretFile.delete(); }
        if (secret == null || !secret.matches("[a-f0-9]{64}")) return;
        try { singletonLock = new android.net.LocalServerSocket("remote365.callaudio.v2." + clientUid); }
        catch (IOException e) { return; }
        Looper.prepareMainLooper();
        ShellCapture.initialize();
        Stub binder = new Stub(clientUid, secret);
        deliverBinder(appPackage, binder);
        new Thread(() -> {
            while (true) {
                try { Thread.sleep(1000); } catch (InterruptedException e) { return; }
                binder.expireLease();
            }
        }, "CaptureLease").start();
        new Thread(() -> {
            while (true) {
                try { Thread.sleep(5000); } catch (InterruptedException e) { return; }
                deliverBinder(appPackage, binder);
            }
        }, "BinderReannounce").start();
        Looper.loop();
    }
    private static final class Stub extends Binder {
        private final int clientUid;
        private final String secret;
        private Capture capture;
        Stub(int uid, String secret) { this.clientUid = uid; this.secret = secret; }
        @Override protected synchronized boolean onTransact(int code, Parcel data, Parcel reply, int flags)
                throws RemoteException {
            if (Binder.getCallingUid() != clientUid) throw new SecurityException("Unexpected caller");
            data.enforceInterface(AudioProtocol.DESCRIPTOR);
            if (code == AudioProtocol.PING) {
                String challenge = data.readString();
                if (challenge == null || challenge.length() != 64) throw new SecurityException("Invalid challenge");
                reply.writeNoException(); reply.writeInt(AudioProtocol.VERSION);
                reply.writeString(AudioProtocol.proof(secret, challenge)); return true;
            }
            if (!AudioProtocol.equal(secret, data.readString())) throw new SecurityException("Invalid credential");
            long generation = data.readLong();
            long callerIdentity = Binder.clearCallingIdentity();
            try { switch (code) {
                case AudioProtocol.START: {
                    int source = data.readInt(), rate = data.readInt();
                    ParcelFileDescriptor out = ParcelFileDescriptor.CREATOR.createFromParcel(data);
                    boolean ok = false;
                    if ((source == 2 || source == 3 || source == 4) && rate == AudioProtocol.RATE && stopCapture()) {
                        long identity = Binder.clearCallingIdentity();
                        try {
                            AudioRecord record = ShellCapture.open(source, rate);
                            if (record != null && record.getSampleRate() == rate && record.getChannelCount() == 1) {
                                try {
                                    // A stalled reader must not block lease expiry or STOP indefinitely.
                                    android.system.Os.fcntlInt(out.getFileDescriptor(),
                                        android.system.OsConstants.F_SETFL, android.system.OsConstants.O_NONBLOCK);
                                    capture = new Capture(generation, record, out);
                                    capture.worker.start(); ok = true;
                                } catch (Exception e) { record.stop(); record.release(); }
                            } else if (record != null) { record.stop(); record.release(); }
                        } finally { Binder.restoreCallingIdentity(identity); }
                    }
                    if (!ok) { try { out.close(); } catch (IOException ignored) {} }
                    reply.writeNoException(); reply.writeInt(ok ? 1 : 0);
                    reply.writeInt(AudioProtocol.RATE); reply.writeInt(AudioProtocol.CHANNELS); return true;
                }
                case AudioProtocol.STOP:
                    if (capture != null && capture.generation == generation) stopCapture();
                    reply.writeNoException(); return true;
                case AudioProtocol.RENEW:
                    boolean alive = capture != null && capture.generation == generation && capture.worker.isAlive();
                    if (alive) capture.deadline = SystemClock.elapsedRealtime() + AudioProtocol.LEASE_MS;
                    reply.writeNoException(); reply.writeInt(alive ? 1 : 0); return true;
                default: return false;
            } } finally { Binder.restoreCallingIdentity(callerIdentity); }
        }
        synchronized void expireLease() {
            if (capture != null && SystemClock.elapsedRealtime() >= capture.deadline) stopCapture();
        }
        private boolean stopCapture() {
            Capture old = capture;
            if (old == null) return true;
            old.running = false;
            try { old.descriptor.close(); } catch (Exception ignored) {}
            try { old.record.stop(); } catch (Exception ignored) {}
            try { old.worker.join(1500); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            if (old.worker.isAlive()) return false;
            capture = null; return true;
        }
    }
    private static final class Capture {
        final long generation;
        final AudioRecord record;
        final DataOutputStream output;
        final ParcelFileDescriptor descriptor;
        final Thread worker;
        volatile boolean running = true;
        volatile long deadline = SystemClock.elapsedRealtime() + AudioProtocol.LEASE_MS;
        Capture(long id, AudioRecord record, ParcelFileDescriptor out) {
            generation = id; this.record = record;
            descriptor = out;
            output = new DataOutputStream(new ParcelFileDescriptor.AutoCloseOutputStream(out));
            worker = new Thread(this::pump, "DaemonCapture");
        }
        void pump() {
            byte[] frame = new byte[AudioProtocol.FRAME_BYTES];
            long sequence = 0;
            try {
                while (running) {
                    int filled = 0;
                    while (running && filled < frame.length) {
                        int n = record.read(frame, filled, frame.length - filled);
                        if (n <= 0) throw new IOException("Recorder stopped: " + n);
                        filled += n;
                    }
                    if (!running) break;
                    output.writeLong(sequence++); output.writeLong(SystemClock.elapsedRealtimeNanos());
                    output.writeInt(frame.length); output.write(frame);
                }
            } catch (Exception e) { Log.i(TAG, "Capture ended: " + e.getClass().getSimpleName()); }
            finally {
                running = false;
                try { record.stop(); } catch (Exception ignored) {}
                record.release();
                try { output.close(); } catch (IOException ignored) {}
            }
        }
    }

    /**
     * Deliver our Binder to the app via a broadcast carrying the live IBinder in the extras Bundle.
     * `am broadcast` cannot carry a live binder, so we call IActivityManager.broadcastIntent through
     * reflection (shell is allowed to broadcast). The signature differs across API levels, so try
     * the known shapes newest-first. This is the version-fragile part Shizuku's starter also handles.
     */
    private static boolean deliverBinder(String appPackage, IBinder binder) {
        try {
            Intent intent = new Intent(ACTION_BINDER).setPackage(appPackage);
            intent.addFlags(Intent.FLAG_RECEIVER_FOREGROUND);
            Bundle extras = new Bundle();
            extras.putBinder(EXTRA_BINDER, binder);
            intent.putExtras(extras);

            Object am = activityManager();
            if (am == null) { Log.e(TAG, "no IActivityManager"); return false; }
            // This shell process has no ActivityManager-registered application thread.
            Object caller = null;

            for (Method m : am.getClass().getMethods()) {
                if (!m.getName().equals("broadcastIntentWithFeature") && !m.getName().equals("broadcastIntent")) continue;
                Class<?>[] p = m.getParameterTypes();
                Object[] a = new Object[p.length];
                // Fill by type: our intent, our caller, ints=-1/0, everything else null/false.
                boolean callerSet = false, intentSet = false;
                for (int i = 0; i < p.length; i++) {
                    if (p[i] == Intent.class && !intentSet) { a[i] = intent; intentSet = true; }
                    else if (p[i].getName().equals("android.app.IApplicationThread") && !callerSet) { a[i] = caller; callerSet = true; }
                    else if (p[i] == int.class) a[i] = (i == p.length - 1) ? targetUser : -1;
                    else if (p[i] == boolean.class) a[i] = false;
                    else a[i] = null;
                }
                if (!intentSet) continue;
                try {
                    m.invoke(am, a);
                    Log.i(TAG, "broadcast via " + m.getName() + "(" + p.length + " args)");
                    return true;
                } catch (Throwable t) {
                    Log.w(TAG, "broadcast overload " + m.getName() + "(" + p.length + ") failed: " + t);
                }
            }
            Log.e(TAG, "no broadcastIntent overload succeeded");
            return false;
        } catch (Throwable t) {
            Log.e(TAG, "deliverBinder failed", t);
            return false;
        }
    }

    private static Object activityManager() {
        try {
            Method getService = Class.forName("android.app.ActivityManager").getMethod("getService");
            Object s = getService.invoke(null);
            if (s != null) return s;
        } catch (Throwable ignored) {}
        try {
            Class<?> amn = Class.forName("android.app.ActivityManagerNative");
            return amn.getMethod("getDefault").invoke(null);
        } catch (Throwable t) {
            Log.e(TAG, "activityManager() failed", t);
            return null;
        }
    }

    private CallAudioDaemon() {}
}
