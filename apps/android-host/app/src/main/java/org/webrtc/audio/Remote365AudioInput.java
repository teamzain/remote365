package org.webrtc.audio;

import java.nio.ByteBuffer;

/** Explicit PCM input for Remote365's pinned WebRTC Java adapter. Never falls back to a mic. */
public final class Remote365AudioInput {
    public interface Source {
        boolean configure(int sampleRate, int channels);
        boolean start();
        int read(ByteBuffer buffer, int bytes);
        void stop();
        void release();
    }
    public static volatile Source source;
    private Remote365AudioInput() {}
}
