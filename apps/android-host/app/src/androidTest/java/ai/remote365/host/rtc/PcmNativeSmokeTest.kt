package ai.remote365.host.rtc

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.webrtc.*
import org.webrtc.audio.JavaAudioDeviceModule
import org.webrtc.audio.Remote365AudioInput
import java.nio.ByteBuffer
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

/** Exercises the actual packaged JNI ABI and PCM thread using silence, never phone audio. */
@RunWith(AndroidJUnit4::class)
class PcmNativeSmokeTest {
    @Test fun nativeWebRtcConsumesExplicitPcmWithoutAMicrophone() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        PeerConnectionFactory.initialize(PeerConnectionFactory.InitializationOptions.builder(context).createInitializationOptions())
        val frames = CountDownLatch(20)
        val previous = Remote365AudioInput.source
        Remote365AudioInput.source = object : Remote365AudioInput.Source {
            override fun configure(rate: Int, channels: Int) = rate == 48000 && channels == 1
            override fun start() = true
            override fun read(buffer: ByteBuffer, bytes: Int): Int {
                Thread.sleep(10)
                buffer.clear(); buffer.put(ByteArray(bytes)); frames.countDown(); return bytes
            }
            override fun stop() {}
            override fun release() {}
        }
        val adm = JavaAudioDeviceModule.builder(context).setInputSampleRate(48000)
            .setUseHardwareAcousticEchoCanceler(false).setUseHardwareNoiseSuppressor(false)
            .createAudioDeviceModule()
        val factory = PeerConnectionFactory.builder().setAudioDeviceModule(adm).createPeerConnectionFactory()
        val candidatesA = mutableListOf<IceCandidate>()
        val candidatesB = mutableListOf<IceCandidate>()
        val a = factory.createPeerConnection(PeerConnection.RTCConfiguration(emptyList()),
            Observer { synchronized(candidatesA) { candidatesA.add(it) } })!!
        val b = factory.createPeerConnection(PeerConnection.RTCConfiguration(emptyList()),
            Observer { synchronized(candidatesB) { candidatesB.add(it) } })!!
        val source = factory.createAudioSource(MediaConstraints())
        val track = factory.createAudioTrack("test-silence", source)
        try {
            a.addTrack(track, listOf("test"))
            val offer = sdp { a.createOffer(it, MediaConstraints()) }
            setSdp { a.setLocalDescription(it, offer) }
            setSdp { b.setRemoteDescription(it, offer) }
            val answer = sdp { b.createAnswer(it, MediaConstraints()) }
            setSdp { b.setLocalDescription(it, answer) }
            setSdp { a.setRemoteDescription(it, answer) }
            repeat(100) {
                synchronized(candidatesA) { candidatesA.forEach(b::addIceCandidate); candidatesA.clear() }
                synchronized(candidatesB) { candidatesB.forEach(a::addIceCandidate); candidatesB.clear() }
                if (frames.await(100, TimeUnit.MILLISECONDS)) return@repeat
            }
            assertEquals("Native input must consume 20 complete PCM frames", 0L, frames.count)
        } finally {
            a.close(); b.close(); a.dispose(); b.dispose()
            track.dispose(); source.dispose(); factory.dispose(); adm.release()
            Remote365AudioInput.source = previous
        }
    }
    private fun sdp(action: (SdpObserver) -> Unit): SessionDescription {
        val done = CountDownLatch(1)
        val result = AtomicReference<SessionDescription>()
        val error = AtomicReference<String>()
        action(object : SdpObserver {
            override fun onCreateSuccess(sdp: SessionDescription) { result.set(sdp); done.countDown() }
            override fun onCreateFailure(message: String) { error.set(message); done.countDown() }
            override fun onSetSuccess() {}
            override fun onSetFailure(message: String) {}
        })
        assertTrue("SDP creation timeout", done.await(10, TimeUnit.SECONDS))
        assertNull(error.get()); return result.get()
    }
    private fun setSdp(action: (SdpObserver) -> Unit) {
        val done = CountDownLatch(1); val error = AtomicReference<String>()
        action(object : SdpObserver {
            override fun onCreateSuccess(sdp: SessionDescription) {}
            override fun onCreateFailure(message: String) {}
            override fun onSetSuccess() { done.countDown() }
            override fun onSetFailure(message: String) { error.set(message); done.countDown() }
        })
        assertTrue("SDP setting timeout", done.await(10, TimeUnit.SECONDS)); assertNull(error.get())
    }
    private class Observer(val candidate: (IceCandidate) -> Unit) : PeerConnection.Observer {
        override fun onIceCandidate(value: IceCandidate) = candidate(value)
        override fun onSignalingChange(state: PeerConnection.SignalingState) {}
        override fun onIceConnectionChange(state: PeerConnection.IceConnectionState) {}
        override fun onIceConnectionReceivingChange(receiving: Boolean) {}
        override fun onIceGatheringChange(state: PeerConnection.IceGatheringState) {}
        override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>) {}
        override fun onAddStream(stream: MediaStream) {}
        override fun onRemoveStream(stream: MediaStream) {}
        override fun onDataChannel(channel: DataChannel) {}
        override fun onRenegotiationNeeded() {}
        override fun onAddTrack(receiver: RtpReceiver, streams: Array<out MediaStream>) {}
    }
}
