package ai.remote365.host.rtc

import org.junit.Assert.*
import org.junit.Test

class PcmQueueTest {
    @Test fun overflowKeepsLatestCompleteSamples() {
        val q = PcmQueue(4)
        q.write(byteArrayOf(1, 2, 3, 4, 5, 6), 6)
        val out = ByteArray(6)
        assertEquals(4, q.read(out))
        assertArrayEquals(byteArrayOf(3, 4, 5, 6, 0, 0), out)
    }
    @Test fun wrappingAndPartialReadsPreserveOrder() {
        val q = PcmQueue(6)
        q.write(byteArrayOf(1, 2, 3, 4), 4)
        q.read(ByteArray(2))
        q.write(byteArrayOf(5, 6, 7, 8), 4)
        val out = ByteArray(6)
        assertEquals(6, q.read(out))
        assertArrayEquals(byteArrayOf(3, 4, 5, 6, 7, 8), out)
    }
    @Test fun resetCannotReplayPreviousCall() {
        val q = PcmQueue(4)
        q.write(byteArrayOf(1, 2), 2); q.clear()
        val out = byteArrayOf(9, 9)
        assertEquals(0, q.read(out)); assertArrayEquals(byteArrayOf(0, 0), out)
    }
    @Test(expected = IllegalArgumentException::class)
    fun rejectsHalfSamples() { PcmQueue(4).write(byteArrayOf(1), 1) }
}
