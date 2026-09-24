package ai.remote365.host.rtc

import ai.remote365.callaudio.AudioProtocol
import org.junit.Assert.*
import org.junit.Test

class AudioProtocolTest {
    @Test fun previousProofCannotAuthenticateANewChallenge() {
        val old = AudioProtocol.proof("a".repeat(64), "1".repeat(64))
        assertFalse(AudioProtocol.equal(AudioProtocol.proof("a".repeat(64), "2".repeat(64)), old))
        assertFalse(AudioProtocol.equal(AudioProtocol.proof("b".repeat(64), "1".repeat(64)), old))
        assertFalse(AudioProtocol.equal(old, null))
    }
}
