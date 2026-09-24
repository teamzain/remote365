const { bundleCommand, startCommand } = require('@react-native/community-cli-plugin');

// Keep CLI project detection anchored at this app inside the monorepo —
// mirrors apps/mobile-native-host/react-native.config.js.
module.exports = {
  commands: [bundleCommand, startCommand],
  project: {
    android: {
      sourceDir: './android',
      packageName: 'com.remote365.mobile',
    },
  },
};
