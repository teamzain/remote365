package ai.remote365.callaudio;

import android.content.Context;
import android.media.*;
import android.os.Looper;

/** Owner-supervised, bounded capability test. No microphone capture and no speaker fallback. */
public final class CallUplinkProbe {
    public static void main(String[] args) throws Exception {
        if (android.os.Process.myUid() != 2000) return;
        Looper.prepareMainLooper();
        Context context = ShellCapture.systemContext();
        AudioManager manager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        if (manager.getMode() != AudioManager.MODE_IN_CALL) {
            System.out.println("NO_ACTIVE_CARRIER_CALL"); return;
        }
        AudioDeviceInfo destination = null;
        for (AudioDeviceInfo device : manager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {
            if (device.getType() == AudioDeviceInfo.TYPE_TELEPHONY) destination = device;
        }
        if (destination == null) { System.out.println("NO_TELEPHONY_TX"); return; }
        AudioTrack track = null;
        try {
            track = new AudioTrack.Builder()
                .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
                .setAudioFormat(new AudioFormat.Builder().setSampleRate(16000)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO).setEncoding(AudioFormat.ENCODING_PCM_16BIT).build())
                .setBufferSizeInBytes(3200).setTransferMode(AudioTrack.MODE_STREAM).build();
            if (!track.setPreferredDevice(destination)) { System.out.println("ROUTE_REFUSED"); return; }
            track.play();
            short[] frame = new short[320];
            for (int n = 0; n < 15; n++) track.write(frame, 0, frame.length);
            AudioDeviceInfo actual = track.getRoutedDevice();
            if (actual == null || actual.getType() != AudioDeviceInfo.TYPE_TELEPHONY) {
                System.out.println("WRONG_ROUTE:" + (actual == null ? "none" : actual.getType())); return;
            }
            System.out.println("TELEPHONY_TX_CONFIRMED; playing two-second quiet test tone");
            for (int n = 0; n < 100; n++) {
                actual = track.getRoutedDevice();
                if (manager.getMode() != AudioManager.MODE_IN_CALL || actual == null ||
                    actual.getType() != AudioDeviceInfo.TYPE_TELEPHONY) break;
                for (int i = 0; i < frame.length; i++) frame[i] = (short)(2200 * Math.sin(2 * Math.PI * 440 * (n * 320 + i) / 16000));
                track.write(frame, 0, frame.length);
            }
            System.out.println("PROBE_COMPLETE");
        } finally { if (track != null) { track.stop(); track.release(); } }
    }
}
