# Active-tab video

Desktop device tabs keep their connections but only the selected tab in a visible,
non-minimized viewer window receives live media. Switching tabs sends
`stream-activity` over the existing reliable control channel. Playback detaches,
remote receiver tracks are disabled, video health checks and quality tuning pause,
and recording/watermark rendering pause for background tabs. Returning requests a
fresh keyframe and resumes the same quality selection. File transfers remain live.

Updated desktop hosts omit video/audio packets for each paused viewer. Capture and
encoding stop when every viewer is paused; another active viewer on the same host
keeps the shared pipeline running. Resume waits for an IDR to avoid showing delta
frames against an old reference. Android native hosts disable sender encodings;
they preserve the capture session because Android 14 projection consent cannot be
reused after stopping capture. Quality and activity parameter updates are serialized.

Both the desktop viewer and remote host need these changes for sender-side bandwidth
savings. Older hosts ignore the activity message. Idle tabs still retain connection,
application, and file-transfer state, so their CPU/memory/network use is not zero.
Background periods are omitted from recordings.

## Verification

- `node --experimental-strip-types --test apps/desktop/src/shared/viewerMediaPolicy.test.mjs`
- From `apps/desktop`: `node ../../node_modules/vite/bin/vite.js build --mode prod`
- On updated devices, open three sessions with moving content. Only the selected
  tab should show increasing video bytes/frame counters after in-flight data drains.
- Switch rapidly among all three, close the selected tab, then minimize/restore.
  Check fresh sharp frames resume without reconnecting or a black-screen warning.
- Have a second independent viewer watch the same host. Parking one viewer must
  not interrupt the other. Closing the final active viewer must stop capture if
  only parked viewers remain.
- Verify a background file transfer continues. Verify recording pauses while parked
  and resumes when selected. On Android 14+, ensure no new projection prompt appears.

Real-device CPU, memory, network, and visual-quality measurements are required for
performance acceptance; automated policy tests and builds cannot establish savings.
