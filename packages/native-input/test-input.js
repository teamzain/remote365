const input = require('./index');

async function runTest() {
  console.log('--- STARTING INPUT INJECTION TEST ---');
  
  // 1. Move to center
  console.log('Moving mouse to center (0.5, 0.5)...');
  input.injectMouseMove(0.5, 0.5);
  
  await new Promise(r => setTimeout(r, 1000));
  
  // 2. Click left
  console.log('Clicking left mouse button...');
  input.injectMouseAction('left', 'down');
  input.injectMouseAction('left', 'up');
  
  await new Promise(r => setTimeout(r, 1000));
  
  // 3. Type 'A' (VK_A = 0x41)
  console.log('Typing letter "A"...');
  input.injectKeyAction(0x41, 'down');
  input.injectKeyAction(0x41, 'up');
  
  console.log('--- TEST COMPLETE ---');
}

runTest().catch(console.error);
