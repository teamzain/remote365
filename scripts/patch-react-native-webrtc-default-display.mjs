import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const webrtcJava = join(
  process.cwd(),
  'node_modules',
  'react-native-webrtc',
  'android',
  'src',
  'main',
  'java',
  'com',
  'oney',
  'WebRTCModule',
);

// --- 1. Capture the DEFAULT display, not an app-picker selection (Android 14+) -------------
function patchDefaultDisplay() {
  const target = join(webrtcJava, 'GetUserMediaImpl.java');
  if (!existsSync(target)) return;

  let source = readFileSync(target, 'utf8');

  if (!source.includes('import android.media.projection.MediaProjectionConfig;')) {
    source = source.replace(
      'import android.media.projection.MediaProjectionManager;\n',
      'import android.media.projection.MediaProjectionManager;\nimport android.media.projection.MediaProjectionConfig;\nimport android.os.Build;\n',
    );
  }

  const original = `                    currentActivity.startActivityForResult(
                            mediaProjectionManager.createScreenCaptureIntent(), PERMISSION_REQUEST_CODE);
`;

  const patched = `                    Intent screenCaptureIntent = mediaProjectionManager.createScreenCaptureIntent();
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                        screenCaptureIntent = mediaProjectionManager.createScreenCaptureIntent(
                                MediaProjectionConfig.createConfigForDefaultDisplay());
                    }
                    currentActivity.startActivityForResult(screenCaptureIntent, PERMISSION_REQUEST_CODE);
`;

  if (source.includes(original)) {
    source = source.replace(original, patched);
    writeFileSync(target, source);
    console.log('Patched react-native-webrtc Android MediaProjection to prefer default display capture.');
  }
}

// --- 2. Never flag the capture display as a PRESENTATION display ---------------------------
//
// This is what made a LOCKED phone stream a bare system clock instead of its real lock screen.
// While the keyguard is up, SystemUI's KeyguardDisplayManager walks the secondary displays and
// draws a KeyguardPresentation — a plain clock — on each one it considers "showable". The mirror
// of the real screen is still underneath; the clock just covers it. Confirmed on a Samsung A05
// (Android 15): `dumpsys window windows` showed the WebRTC_ScreenCapture display holding exactly
// one full-screen com.android.systemui window with isClone=false, while display 0 simultaneously
// held the genuine NotificationShade + ImageWallpaper lock screen.
//
// The gate is FLAG_PRIVATE, NOT FLAG_PRESENTATION — isKeyguardShowable() skips private displays.
// Dropping only VIRTUAL_DISPLAY_FLAG_PRESENTATION was tried first and did NOT work: the display
// stayed PUBLIC, so the clock came back within seconds of the real lock screen appearing. Clearing
// VIRTUAL_DISPLAY_FLAG_PUBLIC is what makes the platform mark it FLAG_PRIVATE and leave it alone.
//
// MediaProjection mirrors the default display regardless of these flags — PUBLIC only controls
// whether OTHER apps may enumerate and target this display, which we never want anyway, so making
// it private is strictly better here.
function patchPresentationFlag() {
  const target = join(webrtcJava, 'OrientationAwareScreenCapturer.java');
  if (!existsSync(target)) return;

  let source = readFileSync(target, 'utf8');

  // Match both the upstream value and the earlier (insufficient) PRESENTATION-only patch.
  const variants = [
    'DisplayManager.VIRTUAL_DISPLAY_FLAG_PUBLIC | DisplayManager.VIRTUAL_DISPLAY_FLAG_PRESENTATION;',
    'DisplayManager.VIRTUAL_DISPLAY_FLAG_PUBLIC;',
  ];
  // 0 = private, mirrors the default display, invisible to other apps, ignored by the keyguard.
  const patched = '0;';

  for (const original of variants) {
    if (source.includes(original)) {
      source = source.replace(original, patched);
      writeFileSync(target, source);
      console.log('Patched react-native-webrtc capture display to a PRIVATE virtual display (keyguard no longer overlays a clock).');
      return;
    }
  }
}

patchDefaultDisplay();
patchPresentationFlag();
