package ai.remote365.host.rtc

/** Bounded PCM16 queue; overflow discards oldest complete samples, underrun supplies silence. */
internal class PcmQueue(private val capacity: Int) {
    init { require(capacity > 0 && capacity % 2 == 0) }
    private val bytes = ByteArray(capacity)
    private var head = 0
    private var count = 0
    @Synchronized fun clear() { head = 0; count = 0 }
    @Synchronized fun write(data: ByteArray, length: Int) {
        require(length in 0..data.size && length % 2 == 0)
        for (i in 0 until length) {
            bytes[head] = data[i]
            head = (head + 1) % capacity
        }
        count = minOf(capacity, count + length)
    }
    @Synchronized fun read(output: ByteArray): Int {
        require(output.size % 2 == 0)
        output.fill(0)
        val n = minOf(output.size, count)
        var tail = (head - count + capacity) % capacity
        for (i in 0 until n) { output[i] = bytes[tail]; tail = (tail + 1) % capacity }
        count -= n
        return n
    }
}
