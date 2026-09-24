# Remote365 Android Audio Helper: proposed design

Date: 2026-09-06. Status: architecture proposal, based on repository inspection and Android documentation; not validated on a physical phone. This updates the earlier research's assumption that wireless debugging is entirely prohibited: temporary activation is now acceptable.

## Outcome and feasibility boundary

Bundle an on-device helper with Remote365. Wireless debugging launches it with Android shell privileges. After activation, the helper sends audio locally to the host over Binder and a file-descriptor pipe. The host sends it through the existing WebRTC connection to the desktop. ADB is not the audio transport.

This can remove the ongoing transport dependency on wireless debugging. It cannot guarantee that Android will leave the helper alive when debugging is disabled, or that a particular phone exposes carrier-call audio to a shell process. Those are two independent device qualification gates. A helper that answers a ping has not demonstrated working call capture.

There is no established universal stock-Android implementation satisfying all of: existing carrier-call audio, every phone, no root or nearby hardware, and permanent operation after one activation. An ordinary add-on APK or a Docker service does not grant the phone's restricted audio permissions.

## Components

```text
Temporary setup:
Phone pairing UI -> authenticated local ADB -> launch shell helper

During an authorized remote session:
Permitted media -> MediaProjection capture -------------------+
                                                            |
Supported call source -> shell helper -> private local pipe --+-> source coordinator
                                                                  |
                                                            PCM audio input
                                                                  |
                                                           WebRTC / Opus
                                                                  |
                                                    existing network transport
                                                                  |
                                                            desktop player
```

Use an internal helper module first: the repository already has one. A separate installed add-on would add installation and update complexity without adding privileges. Shizuku can be an optional activation provider later; it is not a universal call-capture library and has its own restart and OEM restrictions. No new Docker service is required to capture audio. Existing signaling and any required TURN relay remain network infrastructure.

## Activation and device qualification

1. The owner opens an Audio Setup screen and enables wireless debugging for activation. Pair if necessary; retained pairing is distinct from a running helper.
2. Stage a versioned, reproducibly built helper and start it detached from the ADB connection. Authenticate the helper and establish the local channel; close the bootstrap connection.
3. With an explicitly initiated test call, check source initialization, frame format, frame delivery, and audible remote speech. If both sides are required, test each participant separately. Successful initialization or nonzero samples alone cannot establish correct content.
4. Switch wireless debugging off while the call is active. Verify that audio continues. End it and start a new call with debugging still off, verifying capture can start again.
5. Test separately with USB debugging retained and with it disabled. Do not conflate USB debugging, wireless debugging, Developer options, and unplugging a cable. Record exactly which settings the successful configuration requires.
6. Save capability results against phone model, Android build, helper version, call type and route. Requalify after relevant updates. Mark unknown combinations as untested rather than supported.

If either survival or source access fails, report that limitation. Do not silently enable an alternative debugging listener, keep wireless debugging enabled against the owner's choice, or substitute microphone/speakerphone capture.

## Runtime state and recovery

One serialized coordinator owns source switching and capture lifecycle. Track helper availability, source availability and network connectivity independently.

| State | Behavior |
| --- | --- |
| Needs activation | Explain that the helper needs launching on the phone. Ordinary supported media can remain available. |
| Checking | Validate protocol, actual source readiness and the selected device profile. |
| Ready | Helper is reachable; capture is idle until an authorized session requests listening. |
| Streaming | Deliver timestamped frames from the selected, verified source. |
| Recovering | Reconnect to a living helper or repair the WebRTC connection with bounded retries. |
| Reactivation required | The privileged process died and cannot be restarted through the available authorized bootstrap path. |
| Unsupported source | The requested call type or route cannot be captured on this configuration. |

Assign a generation ID to every capture attempt. Ignore late callbacks from older attempts. Treat pipe EOF, Binder death, recorder failure and session termination as explicit lifecycle events. Stop and join the old capture worker before starting a replacement. Release recorders and file descriptors deterministically.

A host restart can reconnect if the helper remains alive and authentication succeeds. A network interruption does not itself mean the helper died. A phone reboot requires renewed non-root activation; loss of the shell process can require it too. A watchdog can detect failure but cannot restore privileges that an ordinary app does not possess.

## Capture selection

- Ordinary media: use the existing MediaProjection capture path for permitted playback. Android playback-capture policies still apply; this is not a promise to capture every app, notification or protected stream.
- Carrier calls: probe explicit call sources only during the test or requested session. Downlink means the remote participant; VOICE_CALL nominally includes both directions but requires restricted permissions and device support. Save only verified profiles.
- Other apps' VoIP calls: maintain separate compatibility results. Do not infer support from carrier calls or from MODE_IN_COMMUNICATION. Remote365's own WebRTC session can affect audio mode, so audio-mode changes alone are insufficient call classification.
- If no reliable classification is available, expose a clear source selection instead of guessing. Do not route blocked capture to the microphone. End call capture and restore the media source when the call ends.

This design is for listening. Injecting desktop microphone audio into an existing carrier call is a separate, unproven capability and is not implied by capture support.

## Audio quality and transport

Replace the current reflection-based replacement of WebRTC's private AudioRecord with a supported custom PCM audio-device module, or a maintained minimal fork of the pinned WebRTC implementation. Select the source before recording starts, so playback listening does not briefly open the microphone.

Negotiate sample rate, channel count and PCM encoding; do not interpret all incoming bytes as 48 kHz mono by assumption. Normalize once to the encoder format, with correct resampling and channel handling. Feed WebRTC at its expected cadence, commonly 10 ms blocks, using monotonic timestamps. Handle clock drift rather than letting latency accumulate.

Start with a 30–60 ms local queue target and a bounded 100–150 ms maximum; these are tuning targets, not measured results. Drop complete old frames on overflow and supply properly timed silence on underflow. Maintain separate network jitter handling in WebRTC. Evaluate mono Opus around 32–64 kbps with network adaptation. Avoid aggressive noise suppression, automatic gain or acoustic echo cancellation on already processed digital call audio unless measurements justify them.

Measure frame cadence, queue age, underflows, clipping and RTP loss/jitter. Silence is legitimate; it is not by itself evidence of failure. Good encoding preserves captured audio but cannot reconstruct frequencies absent from a narrowband carrier call. Removing ADB from transport alone does not prove improved clarity.

## Access and lifecycle controls

Bootstrap through the owner's approved pairing. Authenticate both endpoints using a per-launch secret established through that bootstrap, plus expected UID/package-signature checks where applicable. Do not trust an exported broadcast merely because it contains a Binder or the right interface descriptor. Bind identity checks to the actual calling UID and account for package replacement and Android user profiles.

Version the protocol. Include session/generation ID, sample format, timestamps and terminal error codes. Restrict start/stop to the authenticated host. Capture only while the authorized remote session has listening enabled. Use a renewable short lease so session loss, client death or mute ends capture even if a stop message is lost. Keep the phone's listening indication visible. Diagnostics should contain timing and errors, not raw conversation audio.

## Repository work required

| Area | Required change |
| --- | --- |
| CallDaemonClient / CallDaemonReceiver | Authenticate handoff, version negotiation, generation-safe death handling and explicit EOF notification. Replace unconditional survival claims with verified capability state. |
| CallAudioDaemon / ShellCapture | Authorize Binder callers, serialize start/stop, join workers, release resources, implement capture lease and format/error reporting. |
| CallAudioBridge | Keep ADB streaming out of the debugging-off operating mode. Correct terminal-state handling if retained for diagnostics. |
| HostService | Introduce one coordinator; distinguish call types and own WebRTC mode; stop capture when listening is disabled; enter call mode only after source readiness. |
| HostAudio / WebRtcSession | Replace private-field swapping, implement paced PCM injection, correct resampling and bounded queues. |
| Helper build | Generate bundled DEX from source in the build; verify version/hash so APK assets cannot silently drift from reviewed source. |
| Desktop player | Show media/call availability, reconnecting and reactivation states alongside the existing listening control. |

## Implementation order and acceptance

First prove both qualification gates on a real target phone using the existing prototype. Next harden the helper protocol and lifecycle. Then implement the PCM input and source coordinator, followed by setup/status UI and broader device testing. Do not invest in a polished universal setup flow before the target configuration passes actual call tests.

Acceptance includes: remote and local speech tested separately; wireless debugging disabled mid-call; a new call afterward; screen off and extended idle; supported earpiece/headset routes without forced speakerphone; host restart; helper death; phone reboot; network loss/reconnect; mute/session end stopping capture; repeated call cycles; wrong/stale Binder rejection; mismatched format and frame under/overflow. Report tested phone/build combinations and measured latency instead of claiming every-phone support.

## Evidence

- [Android audio source reference](https://developer.android.com/reference/android/media/MediaRecorder.AudioSource): call sources and restricted CAPTURE_AUDIO_OUTPUT permission.
- [Android playback capture](https://developer.android.com/media/platform/av-capture): eligible playback and capture-policy restrictions.
- [Android sharing audio input](https://developer.android.com/media/platform/sharing-audio-input): capture priorities and voice-call restrictions.
- [Shizuku setup guide](https://shizuku.rikka.app/guide/setup/): pairing versus startup, non-root restart after reboot, OEM caveats and USB-debugging guidance. This is supporting precedent, not proof of our daemon's survival.
- [Shizuku API](https://github.com/RikkaApps/Shizuku-API): optional privileged-process integration.
- [scrcpy audio documentation](https://github.com/Genymobile/scrcpy/blob/master/doc/audio.md): audio-source implementation precedent; not universal device qualification.
- [Opus RTP specification](https://www.rfc-editor.org/rfc/rfc7587.html): network audio format and encoding considerations.

All queue sizes, protocol choices and implementation phases above are proposed engineering decisions. No physical-device audio or debugging-off survival test was performed for this document.
