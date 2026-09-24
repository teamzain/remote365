const http = require('http');

async function test() {
  console.log('Testing login...');
  const res = await fetch('http://127.0.0.1:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test12345@example.com', password: 'password123' })
  });
  
  let data = await res.json();
  if (!res.ok && data.error === 'Invalid credentials') {
    console.log('User not found, registering...');
    const regRes = await fetch('http://127.0.0.1:3001/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test12345@example.com', password: 'password123', name: 'test12345' })
    });
    data = await regRes.json();
    console.log('Register Res:', regRes.status, data);
  }

  if (data.token) {
    console.log('Token received. Testing /api/devices/ with token...');
    const devRes = await fetch('http://127.0.0.1:3001/api/devices/', {
      headers: { 'Authorization': `Bearer ${data.token}` }
    });
    const devData = await devRes.text();
    console.log('/api/devices/ Response:', devRes.status, devData);
  } else {
    console.log('No token received');
  }
}

test();
