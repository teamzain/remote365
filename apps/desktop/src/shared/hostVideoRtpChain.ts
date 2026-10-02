// The host's outgoing H.264 handler chain (libdatachannel media handlers).
//
// ORDER MATTERS. An outgoing packet runs through the handlers in the order they
// were added, and PacingHandler does not pass packets on: it takes every RTP
// packet into its own queue and later writes it straight to the transport. A
// handler added AFTER the pacer therefore never sees a packet.
//
// The NACK responder used to be added after the pacer. Its retransmit store
// stayed empty, so every NACK from the viewer went unanswered and a single lost
// packet froze the picture until a complete keyframe happened to get through:
// on a 230 ms path with under 1% loss that was a 3-8 s freeze every few seconds
// (keyframes are the largest bursts, so they are also the frames most likely to
// lose a packet). hostVideoRtpChain.test.mjs drops a packet on the wire and
// checks that it is sent again.

/** Bitrate ceiling the pacer spreads packet trains at, and its tick (ms). */
const PACER_BITS_PER_SECOND = 12_000_000;
const PACER_INTERVAL_MS = 5;
/** Packets kept for retransmission: several seconds of video at the top tier. */
const NACK_STORE_PACKETS = 2048;

export function buildHostVideoRtpChain(datachannel: any, rtpConfig: any) {
  const packetizer = new datachannel.H264RtpPacketizer('StartSequence', rtpConfig);
  packetizer.addToChain(new datachannel.RtcpSrReporter(rtpConfig));
  // A packetizer alone cannot repair UDP loss. Keep already-packetized RTP for
  // at least a long-haul round trip and resend what Chromium asks for via RTCP
  // NACK; losing one FU-A fragment of a large IDR otherwise poisons the decoder
  // reference picture until the next keyframe.
  packetizer.addToChain(new datachannel.RtcpNackResponder(NACK_STORE_PACKETS));
  // H.264 IDRs fragment into hundreds of RTP packets. Sending a whole access
  // unit at once is a microburst that lost 40-93% of its packets on a measured
  // 250-400 ms route, so the packet train is paced at the bitrate ceiling.
  // Last in the chain: see the note above.
  packetizer.addToChain(new datachannel.PacingHandler(PACER_BITS_PER_SECOND, PACER_INTERVAL_MS));
  return packetizer;
}
