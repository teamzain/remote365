# Google Play submission — Remote365 Mobile (viewer)

Package `com.remote365.mobile` · versionCode 1 · versionName 1.0.0

Scope: the **viewer/client** app only. The unattended Host (`ai.remote365.mobilehost`)
stays on the sideload channel at `remote365.ai/downloads/mobile` — a Play build of the
Host cannot start capture unattended, which is the point of that app.

## Blocking prerequisite

Play Console access. A personal developer account needs identity verification to clear
before the console unlocks, and **12 testers opted into a closed test for 14 continuous
days** before production access can even be requested. Start recruiting testers now; that
is the long pole, not the build.

## Signing

The AAB is signed with the existing `REMOTE365_RELEASE_*` keystore, which becomes the
**upload key**. Google re-signs with its own app signing key on the way out.

Consequence to expect: a Play install and the sideload APK on `remote365.ai/downloads`
are different signing identities and cannot update each other. A user moving from the
sideload viewer to the Play viewer must uninstall first.

Upload key currently signing the AAB:

    Owner   CN=zain, OU=Remote365, O=Remote365, L=Sargodha, ST=Punjab, C=PK
    SHA-256 89:93:1F:8B:0C:C1:1C:7B:4E:34:C6:28:11:04:7F:E4:25:A7:35:BE:26:9E:E1:D2:54:BE:F0:CF:2F:08:EB:91
    Expires 2053-12-13, SHA256withRSA

**Back up this keystore.** Losing the upload key means a support request to Google to
reset it; losing it before Play App Signing is enrolled would mean never updating the app.

## Build status

`app-release.aab` built and signed — 72 MB, 1105 entries. Verified clean:

- **No `expo-dev-client` / dev-launcher / dev-menu classes.** Expo strips them from
  release variants even though the package sits in `dependencies` for the iOS dev build.
- Size is native libraries for four ABIs (`arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64`),
  dominated by react-native-webrtc. Play serves per-ABI splits from the bundle, so the
  real download is roughly 15–20 MB. No action needed — do not be alarmed by 72 MB.

## App content declarations

| Section | Answer |
|---|---|
| Privacy policy | `https://remote365.ai/privacy` |
| App access | **Restricted** — all functionality requires sign-in. Supply a working demo account; a reviewer who cannot sign in rejects the build. |
| Ads | No ads |
| Content rating | Productivity / business tool; no user-generated public content |
| Target audience | 18+ |
| Data safety | See below |
| Government apps | No |
| Financial features | No |

### Permission justifications

| Permission | Justification |
|---|---|
| `CAMERA`, `RECORD_AUDIO` | Video meetings — user-initiated, camera/mic only during a meeting |
| `FOREGROUND_SERVICE_MEDIA_PROJECTION` | User-initiated screen share inside a meeting |
| `SYSTEM_ALERT_WINDOW` | Session controls overlaid during an active remote session |
| `READ_EXTERNAL_STORAGE` (maxSdk 32) | Attaching an image in chat on Android 12 and below; 13+ uses the system photo picker |
| `BLUETOOTH` | Audio routing to Bluetooth headsets during meetings |

`WRITE_EXTERNAL_STORAGE` was removed — it is ungrantable at targetSdk 36 and a declared
unused permission is its own rejection reason.

## Data safety form

Collected and linked to identity:

- **Personal info** — name, email address. Account creation and sign-in.
- **App activity** — session history. App functionality.
- **Device or other IDs** — device identity for pairing. App functionality.
- **Photos** — only images the user explicitly attaches in chat. App functionality.
- **Audio / video** — meeting camera and microphone streams. App functionality. Not
  stored: transmitted peer-to-peer for the duration of the call.

Answer yes to: data encrypted in transit; users can request deletion.
Do **not** claim data is never collected — sign-in alone makes that false.

## Store listing

**Short description (max 80 chars)**

    Secure remote access and support for your devices, from your phone.

**Full description (max 4000 chars)** — draft, edit before pasting:

    Remote365 puts your devices within reach from anywhere.

    Connect to a computer you own or support, see its screen in real time, and take
    control with touch gestures built for a phone. Start a video meeting, share your
    screen, and chat with your team without leaving the app.

    FEATURES
    • Remote control — view and control your devices with low-latency streaming
    • Device list — see what is online at a glance, grouped the way your team works
    • Meetings — video calls with screen sharing
    • Chat — message your team, with image attachments
    • Security — two-factor authentication and biometric unlock
    • Trusted devices — review and revoke access at any time

    Remote365 requires an account. Sign in with your existing Remote365 credentials.

**Graphics required**

- App icon 512×512 PNG (32-bit, alpha)
- Feature graphic 1024×500 PNG or JPEG (no alpha)
- Phone screenshots: minimum 2, 16:9 or 9:16, each 320–3840 px on the shorter side
- Recommended: 7-inch and 10-inch tablet screenshots (`supportsTablet` is on)

## Release sequence

1. Create the app in Play Console — package `com.remote365.mobile`.
2. Complete **App content** in full. It gates every release track.
3. Upload the AAB to **Closed testing**, add 12+ testers, start the 14-day clock.
4. After 14 continuous days, apply for production access.
5. Promote to **Production** once granted.

Build command:

    cd apps/remote-365-mobile/android
    .\gradlew.bat bundleRelease

Output: `apps/remote-365-mobile/android/app/build/outputs/bundle/release/app-release.aab`
