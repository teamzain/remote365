import { TOTP, NobleCryptoPlugin, ScureBase32Plugin } from 'otplib';

const totp = new TOTP({
  crypto: new NobleCryptoPlugin(),
  base32: new ScureBase32Plugin()
});

async function test() {
  const secret = totp.generateSecret();
  console.log('Generated Secret:', secret);

  const uri = totp.toURI({
    label: 'user@example.com',
    issuer: 'RemoteLink',
    secret: secret
  });
  console.log('Generated URI:', uri);

  const token = await totp.generate({ secret });
  console.log('Token:', token);

  const result = await totp.verify(token, { secret });
  console.log('Is Valid:', result.valid);
}

test().catch(console.error);
