const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Anchor Metro at this app (not the monorepo root) so `expo export:embed`
// resolves ./index.js during Gradle release bundling; the workspace root is
// watched so hoisted node_modules keep resolving. Same fix as
// apps/mobile-native-host/metro.config.js.
const config = getDefaultConfig(__dirname);
const workspaceRoot = path.resolve(__dirname, '../..');

config.watchFolders = Array.from(new Set([workspaceRoot, ...(config.watchFolders || [])]));

module.exports = config;
