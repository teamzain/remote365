/* eslint-disable */
/**
 * Expo config plugin: iOS screen sharing for react-native-webrtc.
 *
 * WHY THIS EXISTS
 * iOS cannot capture the screen from inside the app process. It requires a Broadcast
 * Upload Extension (ReplayKit) running separately, piping frames to the app over a unix
 * socket in a shared App Group container. react-native-webrtc ships the APP side of that
 * socket (ScreenCaptureController/ScreenCapturer) but nothing that creates the extension,
 * and `@config-plugins/react-native-webrtc` does not either — it only handles
 * permissions, bitcode and pod wiring.
 *
 * Without this plugin `mediaDevices.getDisplayMedia()` still RESOLVES on iOS and returns a
 * video track; `ScreenCaptureController.startCapture` then finds no `RTCAppGroupIdentifier`
 * and returns immediately, so the track never produces a frame. Screen share appears to do
 * nothing, with no error anywhere — which is exactly the reported symptom.
 *
 * WHAT IT DOES
 *  1. Adds the App Group entitlement to the app and to the extension.
 *  2. Publishes `RTCAppGroupIdentifier` in the app's Info.plist (the key the library reads).
 *  3. Copies the extension sources from ./ios-screen-share into ios/<extensionName>/.
 *  4. Creates the Broadcast Upload Extension target and embeds it in the app.
 *
 * The App Group must exist on the Apple Developer account. EAS registers missing
 * capabilities automatically when it manages credentials.
 */
const {
  withEntitlementsPlist,
  withInfoPlist,
  withXcodeProject,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const EXTENSION_SOURCES = [
  'SampleHandler.swift',
  'SampleUploader.swift',
  'SocketConnection.swift',
  'Atomic.swift',
  'DarwinNotificationCenter.swift',
];

/** Extension Info.plist. NSExtensionPrincipalClass must be <Target>.SampleHandler. */
function extensionInfoPlist(extensionName, appGroup) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>$(DEVELOPMENT_LANGUAGE)</string>
  <key>CFBundleDisplayName</key>
  <string>Remote 365 Screen</string>
  <key>CFBundleExecutable</key>
  <string>$(EXECUTABLE_NAME)</string>
  <key>CFBundleIdentifier</key>
  <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>$(PRODUCT_NAME)</string>
  <key>CFBundlePackageType</key>
  <string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <!-- Read by SampleHandler to locate the shared socket; must match the app's value. -->
  <key>RTCAppGroupIdentifier</key>
  <string>${appGroup}</string>
  <key>NSExtension</key>
  <dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.broadcast-services-upload</string>
    <key>NSExtensionPrincipalClass</key>
    <string>$(PRODUCT_MODULE_NAME).SampleHandler</string>
    <key>RPBroadcastProcessMode</key>
    <string>RPBroadcastProcessModeSampleBuffer</string>
  </dict>
</dict>
</plist>
`;
}

function extensionEntitlements(appGroup) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.application-groups</key>
  <array>
    <string>${appGroup}</string>
  </array>
</dict>
</plist>
`;
}

/** 1 + 2: app-side entitlement and the two Info.plist keys the library reads. */
const withAppGroupAndInfoPlist = (config, { appGroup, extensionName }) => {
  config = withEntitlementsPlist(config, (cfg) => {
    const key = 'com.apple.security.application-groups';
    const existing = cfg.modResults[key] || [];
    if (!existing.includes(appGroup)) {
      cfg.modResults[key] = [...existing, appGroup];
    }
    return cfg;
  });

  return withInfoPlist(config, (cfg) => {
    // Both keys are read by name from the main bundle:
    //   ScreenCaptureController.m:8        -> RTCAppGroupIdentifier (socket location)
    //   ScreenCapturePickerViewManager.m:8 -> RTCScreenSharingExtension (which extension
    //                                        the system picker should offer)
    // Omitting the second leaves the picker with no preferred extension, so the user is
    // shown an empty list and can never start the broadcast.
    cfg.modResults.RTCAppGroupIdentifier = appGroup;
    cfg.modResults.RTCScreenSharingExtension = `${cfg.ios?.bundleIdentifier}.${extensionName}`;
    return cfg;
  });
};

/** 3: materialise the extension sources into the prebuilt ios/ directory. */
const withExtensionFiles = (config, { extensionName, appGroup }) =>
  withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const iosRoot = cfg.modRequest.platformProjectRoot;
      const targetDir = path.join(iosRoot, extensionName);
      const sourceDir = path.join(projectRoot, 'plugins', 'ios-screen-share');

      fs.mkdirSync(targetDir, { recursive: true });

      for (const file of EXTENSION_SOURCES) {
        const from = path.join(sourceDir, file);
        if (!fs.existsSync(from)) {
          throw new Error(`[withIosScreenShare] missing extension source: ${from}`);
        }
        fs.copyFileSync(from, path.join(targetDir, file));
      }

      fs.writeFileSync(path.join(targetDir, 'Info.plist'), extensionInfoPlist(extensionName, appGroup));
      fs.writeFileSync(
        path.join(targetDir, `${extensionName}.entitlements`),
        extensionEntitlements(appGroup),
      );

      return cfg;
    },
  ]);

/** 4: create the target and embed it. */
const withExtensionTarget = (config, { extensionName, appleTeamId, deploymentTarget }) =>
  withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;

    // Idempotent: `expo prebuild` may run repeatedly, and adding the target twice
    // produces a project that fails to open.
    if (project.pbxTargetByName(extensionName)) {
      return cfg;
    }

    const appBundleId = cfg.ios?.bundleIdentifier;
    if (!appBundleId) throw new Error('[withIosScreenShare] ios.bundleIdentifier is required');
    const extensionBundleId = `${appBundleId}.${extensionName}`;

    const target = project.addTarget(extensionName, 'app_extension', extensionName, extensionBundleId);

    project.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', target.uuid);
    project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
    project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);

    const group = project.addPbxGroup(
      [...EXTENSION_SOURCES, 'Info.plist', `${extensionName}.entitlements`],
      extensionName,
      extensionName,
    );

    // Hang the new group off the project root group.
    const groups = project.hash.project.objects.PBXGroup;
    Object.keys(groups).forEach((key) => {
      if (groups[key].name === undefined && groups[key].path === undefined) {
        project.addToPbxGroup(group.uuid, key);
      }
    });

    for (const file of EXTENSION_SOURCES) {
      project.addSourceFile(file, { target: target.uuid }, group.uuid);
    }

    const configurations = project.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configurations)) {
      const buildSettings = configurations[key].buildSettings;
      if (!buildSettings || buildSettings.PRODUCT_NAME !== `"${extensionName}"`) continue;

      buildSettings.CODE_SIGN_ENTITLEMENTS = `"${extensionName}/${extensionName}.entitlements"`;
      buildSettings.INFOPLIST_FILE = `"${extensionName}/Info.plist"`;
      buildSettings.PRODUCT_BUNDLE_IDENTIFIER = `"${extensionBundleId}"`;
      buildSettings.IPHONEOS_DEPLOYMENT_TARGET = `"${deploymentTarget}"`;
      buildSettings.SWIFT_VERSION = '"5.0"';
      buildSettings.TARGETED_DEVICE_FAMILY = '"1,2"';
      buildSettings.CODE_SIGN_STYLE = '"Automatic"';
      if (appleTeamId) buildSettings.DEVELOPMENT_TEAM = `"${appleTeamId}"`;
      // Extensions must not embed Swift runtime copies of their own.
      buildSettings.ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = '"NO"';
    }

    return cfg;
  });

module.exports = function withIosScreenShare(config, options = {}) {
  const extensionName = options.extensionName || 'BroadcastExtension';
  const appGroup = options.appGroup || `group.${config.ios?.bundleIdentifier}.broadcast`;
  const appleTeamId = options.appleTeamId;
  const deploymentTarget = options.deploymentTarget || '15.1';

  config = withAppGroupAndInfoPlist(config, { appGroup, extensionName });
  config = withExtensionFiles(config, { extensionName, appGroup });
  config = withExtensionTarget(config, { extensionName, appleTeamId, deploymentTarget });
  return config;
};
