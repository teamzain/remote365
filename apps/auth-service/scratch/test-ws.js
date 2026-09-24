const WebSocket = require('ws');
const ws = new WebSocket(process.env.SIGNALING_URL || 'wss://remote365.ai/api/signal');

ws.on('open', () => {
    console.log('CONNECTED');
    ws.close();
    process.exit(0);
});

ws.on('error', (err) => {
    console.error('ERROR:', err.message);
    process.exit(1);
});

setTimeout(() => {
    console.error('TIMEOUT');
    process.exit(1);
}, 5000);
