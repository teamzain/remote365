# Remote365 audio helper

The APK now builds `callaudio.dex` from these Java sources plus `../callaudio-protocol` on every relevant source change. The old manually generated asset under `app/src/main/assets` is not packaged. Protocol version 2 is intentionally incompatible with the original unauthenticated prototype.

Activation uses local ADB to stage a DEX and a mode-0600 temporary credential file. The helper reads and deletes that file, accepts Binder transactions only from the target app UID, and answers a fresh HMAC challenge before the app trusts its Binder. The credential is never carried in the broadcast. App data backup is disabled.

Capture uses 48 kHz mono PCM16, delivered as 10 ms frames. Each frame contains a big-endian sequence number (int64), monotonic timestamp in nanoseconds (int64), payload length (int32), then 960 PCM bytes (little-endian samples). The local pipe is nonblocking on the writing side: a stalled consumer ends capture instead of blocking STOP indefinitely. Capture renewals are due every two seconds and expire after six seconds. STOP includes the capture generation, so delayed requests cannot stop a newer capture.

The shipped call path uses Binder/PFD only. `CallAudioBridge` and `CallAudioServer` remain legacy debug diagnostics and are not a runtime fallback. Successful Self-Pair now attempts helper activation as part of setup. A reachable helper is deliberately not displayed as proof that carrier speech is audible.

The WebRTC 1.3.8 AAR is transformed during the build to remove only `org.webrtc.audio.WebRtcAudioRecord` and its nested classes. The app supplies a PCM adapter with that JNI ABI and feeds eligible playback or helper PCM. All native libraries and other upstream classes remain unchanged. Review the adapter and rerun the device smoke test before upgrading WebRTC. This is a maintained local integration, not a public upstream PCM extension point.

## Verification

Run `gradlew.bat :app:assembleDebug :app:testDebugUnitTest` for the APK, protocol and queue tests. `PcmNativeSmokeTest` in androidTest creates two local WebRTC peers using synthetic silence and checks that the native adapter consumes frames. It does not record real phone audio.

On Windows, if JDK 17 reports `UnixDomainSockets.connect0: Invalid argument`, set both `java.io.tmpdir` and `jdk.net.unixdomain.tmpdir` to a short existing workspace directory for the build process. No global Java or Gradle configuration change is needed.

Manual acceptance still requires audible speech during a carrier call, wireless debugging switched off during that call, another call started afterward, mute, session termination, helper loss, and reboot. Test earpiece and headset routes separately. The top-right Host Access settings icon opens Hear audio both sides (on by default) and Change password. The audio switch selects VOICE_CALL when on and downlink when off, and persists independently of the legacy source preference. Restart listening after changing it. Both sides includes the phone microphone side. Desktop microphone injection is outside this implementation. Rootless process survival and call-source support remain device-dependent.

For an existing configured phone, install the app and test APKs with `adb install -r`, then run `adb shell am instrument -w -r -e class ai.remote365.host.rtc.PcmNativeSmokeTest ai.remote365.host.test/androidx.test.runner.AndroidJUnitRunner`. This avoids the connected-test runner's automatic app cleanup. Do not uninstall the host or clear its data as part of verification.

## Validation recorded on 2026-09-06

- Android debug build: passed.
- Unit tests: 5 passed (bounded sample queue and authentication challenge isolation).
- Samsung SM-A055F / Android 15: native PCM smoke test passed (two local peers, synthetic silence).
- Samsung helper handoff: authenticated PING passed. After bounding the base64 upload and keeping the launching shell alive for one second, in-app activation also returned authenticated readiness using the saved wireless pairing. No new pairing code was required for this activation. A subsequent framework-context initialization fix builds successfully; capture remains unverified.
- Pairing and setup grants were restored after the connected-test runner unintentionally removed the app. The temporary screen timeout override was restored to 30 seconds.
- Desktop TypeScript check: 16 errors; an in-memory comparison with the audio UI edits removed produced the same 16 errors. No new diagnostics from the audio edits.
- Real carrier-call speech and operation after wireless debugging is disabled: still awaiting the owner's call test. The native smoke test does not prove either capability.
- The owner subsequently requested a complete fresh-app reset. The host and instrumentation packages were uninstalled and the running helper stopped; permissions, app-ops, battery exemption and app-specific input setup were removed. Do not resume automatic pairing or helper activation without the owner's next setup instruction.
