import { authenticator } from 'otplib';
console.log('Authenticator is defined:', !!authenticator);
if (authenticator) {
  const secret = authenticator.generateSecret();
  console.log('Secret:', secret);
}
