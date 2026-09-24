const { generateToken, verifyToken } = require('./packages/shared/dist/jwt.js');
const jwt = require('jsonwebtoken');

console.log('Testing JWT locally...');

const token = generateToken({ userId: '123', role: 'USER' });
console.log('Generated token length:', token.length);

const decodedLocal = verifyToken(token);
console.log('Verify local:', decodedLocal);

const rawDecoded = jwt.decode(token, { complete: true });
console.log('Raw payload:', rawDecoded);
