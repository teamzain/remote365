import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import dgram from 'node:dgram';
import dc from 'node-datachannel';
import { buildHostVideoRtpChain } from './hostVideoRtpChain.ts';

after(() => { try { dc.cleanup(); } catch { /* already down */ } });

const parseCandidate = (c) => { const parts = c.replace(/^a=/, '').split(' '); return { ip: parts[4], port: Number(parts[5]), parts }; };
const isIpv4UdpHost = (c) => / UDP /i.test(c) && / typ host/.test(c) && /^\d+\.\d+\.\d+\.\d+$/.test(parseCandidate(c).ip);

// Two peers in this process, joined through a UDP forwarder that drops one RTP
// packet on its way to the receiver and counts every packet the sender puts on
// the wire. The receiver then NACKs the dropped packet.
function dropOnePacketAndNack() {
  return new Promise((resolve, reject) => {
    const towardReceiver = dgram.createSocket('udp4'); // the address the receiver is told the sender has
    const towardSender = dgram.createSocket('udp4');   // the address the sender is told the receiver has
    let senderAddr = null;
    let receiverAddr = null;
    let dropSeq = -1;
    const sentBySender = new Map();
    towardSender.on('message', (msg) => {
      if (!receiverAddr) return;
      const isVideoRtp = msg.length > 12 && (msg[0] >> 6) === 2 && (msg[1] & 0x7f) === 96;
      if (isVideoRtp) {
        const seq = msg.readUInt16BE(2);
        sentBySender.set(seq, (sentBySender.get(seq) || 0) + 1);
        if (seq === dropSeq && sentBySender.get(seq) === 1) return; // lost on the wire
      }
      towardReceiver.send(msg, receiverAddr.port, receiverAddr.ip);
    });
    towardReceiver.on('message', (msg) => { if (senderAddr) towardSender.send(msg, senderAddr.port, senderAddr.ip); });

    towardReceiver.bind(0, () => towardSender.bind(0, () => {
      const sender = new dc.PeerConnection('sender', { iceServers: [] });
      const receiver = new dc.PeerConnection('receiver', { iceServers: [] });
      const finish = (result) => {
        clearTimeout(timeout);
        try { sender.close(); receiver.close(); towardReceiver.close(); towardSender.close(); } catch { /* closing */ }
        resolve(result);
      };
      const timeout = setTimeout(() => reject(new Error(`peers never connected (state ${sender.state()})`)), 20_000);

      sender.onLocalDescription((sdp, type) => receiver.setRemoteDescription(sdp, type));
      receiver.onLocalDescription((sdp, type) => sender.setRemoteDescription(sdp, type));
      const viaForwarder = (c, port) => { const k = parseCandidate(c); k.parts[5] = String(port); return k.parts.join(' '); };
      sender.onLocalCandidate((c, mid) => {
        if (senderAddr || !isIpv4UdpHost(c)) return;
        senderAddr = parseCandidate(c);
        receiver.addRemoteCandidate(viaForwarder(c, towardReceiver.address().port), mid);
      });
      receiver.onLocalCandidate((c, mid) => {
        if (receiverAddr || !isIpv4UdpHost(c)) return;
        receiverAddr = parseCandidate(c);
        sender.addRemoteCandidate(viaForwarder(c, towardSender.address().port), mid);
      });

      const video = new dc.Video('0', 'SendOnly');
      video.addH264Codec(96, 'profile-level-id=42e01f;level-asymmetry-allowed=1;packetization-mode=1');
      const rtpConfig = new dc.RtpPacketizationConfig(1, 'video', 96, 90000);
      const sendTrack = sender.addTrack(video);
      sendTrack.setMediaHandler(buildHostVideoRtpChain(dc, rtpConfig));

      const received = new Set();
      let receiveTrack = null;
      receiver.onTrack((track) => {
        receiveTrack = track;
        track.onMessage((msg) => {
          const buf = Buffer.isBuffer(msg) ? msg : Buffer.from(msg);
          if ((buf[1] & 0x7f) === 96) received.add(buf.readUInt16BE(2));
        });
      });

      // One fake IDR access unit, large enough to fragment into several packets.
      const sendFrame = (index) => {
        const nal = Buffer.alloc(6000, 0x55);
        nal[0] = 0x65;
        rtpConfig.timestamp = index * 3000;
        sendTrack.sendMessageBinary(Buffer.concat([Buffer.from([0, 0, 0, 1]), nal]), rtpConfig);
      };
      let started = false;
      const start = () => {
        if (started || !sendTrack.isOpen() || sender.state() !== 'connected') return;
        started = true;
        sendFrame(0); // establishes the sequence numbering
        setTimeout(() => {
          dropSeq = (Math.max(...sentBySender.keys()) + 4) & 0xffff; // mid-frame, in the next frame
          for (let i = 1; i < 6; i++) sendFrame(i);
          setTimeout(() => {
            const lostBeforeNack = !received.has(dropSeq);
            // RTCP Generic NACK (RFC 4585): PT 205, FMT 1, one FCI entry.
            const nack = Buffer.alloc(16);
            nack[0] = 0x81; nack[1] = 205; nack.writeUInt16BE(3, 2);
            nack.writeUInt32BE(0x0badcafe, 4);
            nack.writeUInt32BE(1, 8);
            nack.writeUInt16BE(dropSeq, 12);
            receiveTrack.sendMessageBinary(nack);
            setTimeout(() => finish({
              lostBeforeNack,
              timesSent: sentBySender.get(dropSeq) || 0,
              receivedAfterNack: received.has(dropSeq),
            }), 1000);
          }, 800);
        }, 500);
      };
      sendTrack.onOpen(() => setTimeout(start, 100));
      sender.onStateChange((state) => { if (state === 'connected') setTimeout(start, 300); });
      sender.setLocalDescription();
    }));
  });
}

test('a video packet lost on the wire is sent again when the viewer NACKs it', async () => {
  const result = await dropOnePacketAndNack();
  assert.equal(result.lostBeforeNack, true, 'the forwarder should have dropped the packet');
  assert.equal(result.timesSent, 2, 'the sender should put the NACKed packet on the wire a second time');
  assert.equal(result.receivedAfterNack, true, 'the receiver should end up with the packet');
});
