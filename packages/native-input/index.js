try {
  module.exports = require('./build/Release/input_injection.node');
} catch (e) {
  try {
    module.exports = require('./build/Debug/input_injection.node');
  } catch (err) {
    throw new Error('Failed to load @remotelink/native-input binary. Please run "npm run rebuild:native" in the project root.');
  }
}
