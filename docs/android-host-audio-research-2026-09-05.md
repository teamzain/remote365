# Android host audio forwarding: feasibility and implementation research

Research date: 5 September 2026. Scope: hear phone playback and calls clearly on the Remote365 desktop while remotely operating the phone. This is research and source inspection, not an implementation or a successful hardware test. Existing code comments describing Samsung A055F results are historical claims, not measurements reproduced here.

**User constraint: no wireless debugging dependency.** The existing ADB helpers below are inspected context, not the recommended solution.

**Recommendation:** retain normal Android playback capture for eligible media. For call audio without wireless debugging, investigate an on-device privileged service provisioned through OEM/system integration or an accepted root/custom-ROM installation. If the phone must remain stock without such privileges, use a qualified hands-free/hardware gateway near the phone. Introduce separate handling for VoIP and optional simultaneous mixing. Do not promise every sound on every stock Android phone.

Removing wireless debugging does not by itself cure distortion. Direct digital PCM transported over a functioning reliable connection does not become inherently lower fidelity merely because ADB is used; stalls can cause dropouts/backlog, while source selection, format mismatch, clipping and pacing can affect clarity independently. These are hypotheses to measure in this implementation, not a diagnosis of the user's observed sound.

## What Android actually permits

| Sound | Ordinary installed app | Practical additional route |
|---|---|---|
| Eligible music, videos, games | Android 10+ playback capture | Existing implementation is the starting point |
| App that disallows capture | Normal playback capture cannot override its policy | Privileged paths must be evaluated; no universal protected-content guarantee |
| Ring, alarm, notification and UI sounds | No blanket coverage from the media filter | Verify each usage and routing policy on the supported firmware |
| Cellular call: other party | Not through the ordinary playback API | Privileged `VOICE_DOWNLINK`, subject to device support |
| Cellular call: both parties | Not through the ordinary playback API | Privileged `VOICE_CALL`, or validated separate uplink/downlink capture |
| WhatsApp, Signal, Teams and other VoIP calls | No general third-party call-capture API | Separate privileged communication-output experiment or supported headset/gateway route |
| Phone microphone/room sound | Permission and concurrent-capture rules apply | A separate explicitly selected source, not a substitute for direct call audio |

Android playback capture requires `RECORD_AUDIO`, a MediaProjection grant and the same user profile. Eligible players use MEDIA, GAME or UNKNOWN and permit capture; the most restrictive policy wins. Adding more matching usages does not override these conditions. Correctly classified ringtones and notifications are therefore not covered by the current filter. [Android playback capture](https://developer.android.com/media/platform/av-capture).

`VOICE_CALL` represents uplink plus downlink; `VOICE_DOWNLINK` is the received side and `VOICE_UPLINK` the transmitted side. They require system-reserved `CAPTURE_AUDIO_OUTPUT`. `VOICE_COMMUNICATION` is a microphone preset, not a tap into another app's conversation. `REMOTE_SUBMIX` redirects eligible output and explicitly excludes some streams, including ringing, alarms and notifications. It is not an unconditional “everything” API. [Android audio-source reference](https://developer.android.com/reference/android/media/MediaRecorder.AudioSource).

An accessibility service's ability to share microphone input is distinct from permission to capture the call itself. Foreground services, becoming the dialer, device-owner provisioning or changing the host's manifest do not by themselves establish the privileged call-capture capability. Android prioritizes the active call and can supply silence to competing capture clients. [Android concurrent input rules](https://developer.android.com/media/platform/sharing-audio-input).

## What is already in this repository

Paths below identify the inspected implementation; links use this workspace's absolute paths.

| Component | Observed behavior |
|---|---|
| [HostAudio.kt](D:/Work/RemoteLink-Desktop/apps/android-host/app/src/main/java/ai/remote365/host/rtc/HostAudio.kt) | Playback capture for MEDIA/GAME/UNKNOWN, excludes host UID, mono ADM input, reflection swaps private WebRTC AudioRecord; call PCM ring replaces media source |
| [WebRtcSession.kt](D:/Work/RemoteLink-Desktop/apps/android-host/app/src/main/java/ai/remote365/host/rtc/WebRtcSession.kt:309) | Adds `phone-audio` to the video session; requests disabling echo cancellation, AGC, noise suppression and high-pass filtering |
| [HostService.kt](D:/Work/RemoteLink-Desktop/apps/android-host/app/src/main/java/ai/remote365/host/service/HostService.kt:122) | Detects IN_CALL and IN_COMMUNICATION; prefers daemon, falls back to ADB helper; source constant is 3, downlink only |
| [CallAudioBridge.kt](D:/Work/RemoteLink-Desktop/apps/android-host/app/src/main/java/ai/remote365/host/rtc/CallAudioBridge.kt) | Uses self-paired wireless ADB, launches `app_process`, reads a format header followed by raw PCM |
| [CallDaemonClient.kt](D:/Work/RemoteLink-Desktop/apps/android-host/app/src/main/java/ai/remote365/host/rtc/CallDaemonClient.kt) | Starts detached helper, obtains Binder, receives audio through a pipe |
| [CallAudioDaemon.java](D:/Work/RemoteLink-Desktop/apps/android-host/callaudio-helper/CallAudioDaemon.java) | Shell-side START/STOP capture and Binder delivery |
| [ShellCapture.java](D:/Work/RemoteLink-Desktop/apps/android-host/callaudio-helper/ShellCapture.java) | Shell-attributed AudioRecord using hidden API reflection |
| [VideoPlayer.tsx](D:/Work/RemoteLink-Desktop/apps/desktop/src/renderer/components/VideoPlayer.tsx:510) | Auto-enables incoming audio unless the viewer explicitly muted it |
| [App.tsx](D:/Work/RemoteLink-Desktop/apps/desktop/src/renderer/App.tsx:3797) | Merges late audio tracks into the existing remote video stream |

The host declares min SDK 26, target SDK 36 and `io.getstream:stream-webrtc-android:1.3.8`. Installation support is broader than audio-feature support: playback requires API 29, and automatic mode-change watching is registered only on API 31+.

## Feasible approaches

### 1. Existing ADB/shell path: excluded by the user

This explains the existing host but does not satisfy the user's constraint. scrcpy exposes separate output, playback, call, uplink and downlink sources. Its audio-forwarding support begins at Android 11, with extra startup constraints on that version. These options prove an implementation pattern exists; they do not prove a given phone returns both sides of every kind of call. [scrcpy audio documentation](https://github.com/Genymobile/scrcpy/blob/master/doc/audio.md).

A directly relevant reference is ShizuCallRecorder: its own project describes a shell/Shizuku implementation based on scrcpy-server and focuses on carrier calls. Its troubleshooting guide explicitly reports device variation, one-sided/silent audio, and VoIP/Wi-Fi-calling difficulties. This strengthens the case for a per-device qualification step instead of discarding the current helper or declaring it universally successful. [Project](https://github.com/kitsumed/ShizuCallRecorder), [troubleshooting](https://github.com/kitsumed/ShizuCallRecorder/blob/main/docs/troubleshooting.md).

For context, ADB is local to the existing phone/bootstrap path; network session audio uses WebRTC. Switching to USB ADB or a detached daemon still retains a debugging dependency and is not the recommendation under the user's constraint.

The detached daemon may survive an ADB connection closing, but `nohup` and `setsid` do not guarantee survival of OEM process killing, debugging changes, or reboot. Model it as restartable. Shizuku documents reboot startup requirements and vendor-specific interruptions. [Shizuku setup guide](https://shizuku.rikka.app/guide/setup/).

### 2. Privileged system/OEM integration for a controlled fleet

This offers a stronger product foundation when device models and firmware are controlled. Obtain the relevant system permissions and vendor-supported audio routes, then validate the HAL behavior. Ordinary APK installation is insufficient. Root/custom-ROM deployment can make system integration possible but still does not establish compatibility across all audio hardware and call routes.

Privileged deployment requires integration into the system image and the applicable permission allowlist; it is not a permission dialog we can add to the existing installer. No verified public Knox API granting arbitrary live call PCM was established in this research. Treat OEM integration as a vendor agreement/firmware feasibility path, not a confirmed SDK checkbox. [AOSP privileged permission allowlisting](https://source.android.com/docs/core/permissions/perms-allowlist).

Proposed path: authorized system audio service -> authenticated local Binder/pipe -> PCM format conversion and clocked delivery -> custom WebRTC ADM -> Opus -> desktop. Start and recover the service through its system/root lifecycle, without ADB bootstrap. Keep access limited to the active authorized remote session. Qualify telephony downlink and both-sides sources before implementing broad UI claims.

BCR is a useful implementation reference for privileged carrier-call capture: it documents system permission requirements and uses the VOICE_CALL source. It is a recorder, not a drop-in live streaming service for Remote365. [BCR implementation explanation](https://github.com/chenxiaolong/BCR#how-it-works).

### 3. Bluetooth hands-free routing

For a nearby phone, receiving the call as a hands-free endpoint can avoid trying to extract protected PCM inside the ordinary Android app. Microsoft's Phone Link uses Bluetooth for PC calling. Windows exposes `PhoneLineTransportDevice` and access APIs requiring `phoneLineTransportManagement`; a Remote365 integration needs a separate native Windows feasibility prototype for permissions, routing and actual audio access. Phone Link's existence is not evidence that Electron can directly obtain its call stream. [Phone Link calling](https://support.microsoft.com/en-us/windows/apps/make-and-receive-phone-calls-from-your-pc), [Windows transport API](https://learn.microsoft.com/en-us/uwp/api/windows.applicationmodel.calls.phonelinetransportdevice), [access requirements](https://learn.microsoft.com/en-us/uwp/api/windows.applicationmodel.calls.phonelinetransportdevice.requestaccessasync).

Bluetooth is local-range connectivity. If the phone is elsewhere, a gateway near it must receive the headset audio and relay it over the network. Media and call profiles require distinct handling. Test VoIP apps and headset codec quality individually.

### 4. Phone-side hardware gateway or owned call stack

An engineering fallback is a headset-compatible audio interface at the phone, with a small computer forwarding received audio over WebRTC. Verify USB/headset routing, duplex support, charging and phone compatibility before choosing hardware. This adds equipment but can move the boundary from Android capture permissions to a supported physical audio endpoint.

If calls can be made through a VoIP stack you own, forward decoded audio there directly. That changes where calls take place; it does not unlock an existing SIM or WhatsApp call. Speakerphone plus microphone pickup is a poor fit for “clean audio” because it adds room acoustics and can encounter input-sharing restrictions.

## Changes required in the current implementation

These are source-inspection findings and implementation recommendations, not confirmed production incidents.

1. **Separate carrier calls from communication mode.** IN_COMMUNICATION is not proof that VOICE_DOWNLINK contains the wanted app audio. Use telephony state plus audio-mode/routing observations, and validate a separate VoIP backend. Avoid classifying the host's own WebRTC activity as another application's call.
2. **Support the intended call direction.** The current constant is downlink only. Offer remote-party listening and both-sides listening where independently tested. A source successfully opening is not proof of real audio; nonzero RMS alone cannot identify which party is present.
3. **Handle media and calls simultaneously if required.** `enterCallMode()` replaces playback. Concurrent capture must be proved first; then mix distinct PCM sources with headroom or expose separate tracks. Prevent duplicate audio if a backend already contains the same material. Do not promise media continues when the phone itself pauses it for a call.
4. **Replace private-field recorder swapping.** Build a supported PCM injection/custom ADM integration against the pinned WebRTC version. The current method starts with a microphone recorder and swaps later; its “mic never active” comment is stronger than the implementation establishes. Upstream starts AudioRecord before launching the callback thread. Failure muting is useful, but it is not proof the microphone was never opened. [WebRTC recorder source](https://webrtc.googlesource.com/src/+/refs/heads/main/sdk/android/src/java/org/webrtc/audio/WebRtcAudioRecord.java).
5. **Negotiate and enforce PCM format.** Helpers send 48 kHz mono PCM16. The virtual recorder derives its rate from the ADM; the ADB ready callback ignores channels and does not establish resampling. A mismatch risks pitch/speed errors. Validate header bounds, preserve sample alignment and resample explicitly.
6. **Use a clocked, bounded queue.** The 48,000-byte ring holds 500 ms at 48 kHz mono PCM16. Capacity does not automatically add 500 ms, but accumulated occupancy can. The custom read loop has no unconditional real-time pacing when data is queued, and waits up to the requested duration plus 20 ms on underflow. Add timestamps, steady 10 ms delivery, drift correction, occupancy metrics and controlled stale-frame dropping.
7. **Make start/stop/error recovery explicit.** `CallAudioBridge` does not reset `streaming` in its reader's `finally`; EOF is not surfaced as a terminal state to the session. Daemon/client readers similarly need completion signaling and deterministic recorder release. Serialize transitions and use generation IDs so late start callbacks cannot re-enter call mode after call end. Join/cancel old capture workers before reusing shared flags.
8. **Authenticate helper IPC.** The exported receiver currently accepts an incoming Binder without authenticating it, and daemon transactions enforce only an interface descriptor, not caller identity. Implement authenticated bootstrap, expected app UID checks, restricted source/rate inputs and session-scoped authorization. Stop capture on session end or lost client.
9. **Report real capability to the viewer.** An audio track can contain silence. Distinguish media available, call supported, setup required, source blocked, source lost and user muted. Add capture and receive health metrics without storing conversation content.
10. **Make helper builds reproducible.** The DEX asset is present. No generation linkage was found in the inspected Gradle/scripts search. Establish a build task and source/asset version check before relying on Java edits reaching the installed application.

## Clean-audio design targets

Proposed starting values, to be tuned by measurement:

| Item | Starting point |
|---|---|
| Local PCM | 48 kHz PCM16; mono speech, stereo media where supported |
| WebRTC delivery | Clocked 10 ms PCM blocks |
| Opus packetization | 20 ms initially |
| Speech encoding | 32–64 kbit/s mono |
| Music encoding | 96–128 kbit/s stereo |
| Host software queue | Aim for 20–40 ms; cap stale backlog |
| End-to-end audio delay | Initial LAN target below 150 ms; measure WAN separately |
| Processing | No microphone-style suppression on digital media; limiter only where mixing needs it |

Opus supports negotiated bitrate, packetization, stereo and in-band loss-recovery parameters. Verify actual SDP/encoder behavior; constraints are not measurements. [Opus RTP specification](https://www.rfc-editor.org/rfc/rfc7587.html).

48 kHz mono PCM16 is 768 kbit/s before overhead, so raw PCM is reasonable for local IPC, while Opus is appropriate for the network. Resampling a narrow-band call to 48 kHz cannot restore frequencies absent from the carrier audio. Measure clipping, dropouts, queue occupancy, packet loss, concealment and audio/video skew before adjusting gain or buffers.

## Qualification plan and decision gates

First isolate source capture from WebRTC. On each supported phone/build, use a consented test call where the local and remote participants speak separately. Verify downlink, uplink and both-sides sources by listening and measuring; run probes one at a time, without a competing recorder. The existing TEST_CALLAUDIO and TEST_CALLAUDIO_LIVE hooks can help but need bounded I/O timeouts. No calls were placed or captured during this research.

Then test:

- Incoming/outgoing SIM calls, available SIM slots, VoLTE and Wi-Fi calling separately.
- Earpiece, speaker, wired/USB headset and Bluetooth routes; route changes mid-call.
- Each required VoIP app separately, including video-call mode.
- Music/video/game audio, notification, ringtone and alarm; media before, during and after calls.
- Session started before a call and during a call; hold/resume; rapid successive calls.
- Desktop mute/unmute, disconnect/reconnect, network loss and TURN relay.
- Host process restart, helper death, debugging off, Wi-Fi loss, reboot and firmware update.
- Long-duration calls for drift, stale backlog, clipping, battery and thermal behavior.

Record model, OS build, transport, source, actual sample format, identified call directions, routing, latency percentiles and failure reason. Start with the actual fleet; the Samsung A055F mentioned in source comments is a candidate, not assumed to be the only device.

**Gate 1:** clean required audio exists at the source. If absent, changing WebRTC will not fix it. Move that configuration to a privileged/OEM or gateway option.

**Gate 2:** source survives required routes and lifecycle transitions. If not, expose the limitation and recovery requirement.

**Gate 3:** desktop delivery meets measured clarity and latency targets. Only then enable the feature for the qualified device/build combinations.

The recommended first milestone under the no-wireless-debugging constraint is a decision on permitted deployment: OEM/system/root integration versus an external audio endpoint. Then prove clean call PCM on the actual phone through that chosen route. Follow with reliable media playback, both-sides capture, concurrent mixing and separately qualified VoIP support. The desktop WebRTC playback remains reusable; the shell/bootstrap dependency must be replaced.

