package ai.remote365.callaudio;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/** Shared by the APK and shell DEX. Changing the wire format requires a version bump. */
public final class AudioProtocol {
    public static final int VERSION = 2;
    public static final String DESCRIPTOR = "ai.remote365.callaudio.ICallAudio.v2";
    public static final int PING = 1, START = 2, STOP = 3, RENEW = 4;
    public static final int RATE = 48000, CHANNELS = 1, FRAME_BYTES = 960;
    public static final long LEASE_MS = 6000;
    public static String proof(String secret, String challenge) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.US_ASCII), "HmacSHA256"));
            byte[] bytes = mac.doFinal((VERSION + ":" + challenge).getBytes(StandardCharsets.US_ASCII));
            StringBuilder result = new StringBuilder();
            for (byte b : bytes) result.append(String.format(java.util.Locale.ROOT, "%02x", b & 255));
            return result.toString();
        } catch (Exception e) { throw new IllegalStateException(e); }
    }
    public static boolean equal(String expected, String actual) {
        return actual != null && MessageDigest.isEqual(expected.getBytes(StandardCharsets.US_ASCII),
                actual.getBytes(StandardCharsets.US_ASCII));
    }
    private AudioProtocol() {}
}
