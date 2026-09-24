const WebSocket = require('ws');
const datachannel = require('node-datachannel');

async function startViewer(sessionId) {
    console.log(`Starting WebRTC Viewer for session: ${sessionId}`);

    const ws = new WebSocket('ws://127.0.0.1:3002');
    let peerConnection = null;

    ws.on('open', () => {
        console.log('Connected to signaling server');
        ws.send(JSON.stringify({
            type: 'join',
            sessionId: sessionId
        }));
    });

    ws.on('message', (message) => {
        const data = JSON.parse(message.toString());
        console.log('Received signaling message:', data.type);

        if (data.type === 'offer') {
            console.log('Received Offer. Initializing PeerConnection...');
            
            peerConnection = new datachannel.PeerConnection("Viewer", {
                iceServers: ["stun:stun.l.google.com:19302"]
            });

            peerConnection.onLocalDescription((sdp, type) => {
                console.log('Generated local description (Answer)');
                ws.send(JSON.stringify({ 
                    type: 'answer', 
                    sdp,
                    targetId: data.senderId // Send back to host
                }));
            });

            peerConnection.onLocalCandidate((candidate, mid) => {
                ws.send(JSON.stringify({ 
                    type: 'ice-candidate', 
                    candidate, 
                    mid,
                    targetId: data.senderId // Send back to host
                }));
            });

            peerConnection.onStateChange((state) => {
                console.log('WebRTC Connection State:', state);
            });

            peerConnection.onDataChannel((channel) => {
                console.log('New Data Channel received:', channel.label());
                
                channel.onMessage((msg) => {
                    if (Buffer.isBuffer(msg) && msg.length > 8) {
                        const timestamp = msg.readBigUInt64LE(0);
                        const latency = Date.now() - Number(timestamp);
                        if (Math.random() < 0.05) { // Log occasionally to avoid spam
                            console.log(`[VIDEO CHANNEL] Received chunk: ${msg.length} bytes | Latency: ${latency}ms`);
                        }
                    } else {
                        console.log(`[DATA CHANNEL] Received message: "${msg.toString()}"`);
                    }
                });

                channel.onOpen(() => {
                    console.log('Data channel is open on viewer side');
                });
            });

            // Set remote offer
            peerConnection.setRemoteDescription(data.sdp, 'offer');
        } else if (data.type === 'ice-candidate') {
            if (peerConnection) {
                peerConnection.addRemoteCandidate(data.candidate, data.mid);
            }
        } else if (data.type === 'host-disconnected') {
            console.error('\n[Viewer] Host disconnected. Exiting...');
            process.exit(0);
        }
    });

    ws.on('error', (err) => {
        console.error('WebSocket Error:', err);
    });
}

// Get Session ID from command line - handles both "123 456 789" and 123 456 789
const sessionId = process.argv.slice(2).join('').replace(/\s/g, '');
if (!sessionId) {
    console.error('Usage: node test-webrtc-viewer.js <sessionId>');
    process.exit(1);
}

startViewer(sessionId);

// Keep the process alive
setInterval(() => {}, 1000);
