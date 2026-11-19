// Prints an AsyncStorage manifest.json that starts the screenshot build signed in to
// the demo account served by mock-api.mjs, with the devices tour already seen.
// Written into <app data>/Library/Application Support/ai.remote365.mobile/RCTAsyncLocalStorage_V1/
// before the app's first launch (values up to 1024 chars are stored inline there).

const session = {
  accessToken: 'demo-access-token',
  refreshToken: 'demo-refresh-token',
  user: { id: '6f0f4c2a-6a8e-4c39-9d6b-2f5d8f0a1b11', email: 'alex@northwind.example', name: 'Alex Morgan' },
};

const manifest = {
  remote365_mobile_auth: JSON.stringify(session),
  remote365_mobile_remember_me: 'true',
  remote365_devices_tour_seen_v1: '1',
  remote365_recent_connections: JSON.stringify(['d-finance-laptop', 'd-helpdesk-01', 'd-file-server', 'd-reception-pc']),
};

for (const [key, value] of Object.entries(manifest)) {
  if (value.length > 1024) throw new Error(`${key} is too long to store inline`);
}
process.stdout.write(JSON.stringify(manifest));
