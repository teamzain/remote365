# Remote365 Mobile — responsiveness audit

291 de-duplicated findings (from 294 confirmed, 25 refuted by adversarial verifiers).



## CRITICAL

### App.tsx:1658
**Issue.** Confirmed: App.tsx does not parse. Metro/Babel aborts at 1658 and the app never renders on any device. Fix: swap the two closing tags (</ScrollView> at 1658, </View> at 1663).

```
1644: <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.launchContent}>
1658:      </View>
1660:      <View style={styles.signInFooter}>
1663:      </ScrollView>
```

**Impact.** Every device, every screen size: Metro/Babel aborts with "Expected corresponding JSX closing tag for <ScrollView>. (1658:6)" (reproduced by running @babel/parser over the file). The app shows the red bundling error screen and never renders. git shows HEAD had `<View style={styles.launchContent}>` here; the working-copy edit that converted it to a ScrollView (to make the launch screen scrollable on short phones) replaced the wrong closing tag.

**Fix.** Line 1658 `</View>` → `</ScrollView>`, and line 1663 `</ScrollView>` → `</View>`. The footer block (1660-1662) uses `signInFooter` which is `position: 'absolute', bottom: 16` (App.tsx:5402-5406), so it must stay a sibling of the ScrollView inside the SafeAreaView, not a child of the scroll content.

### App.tsx:1658
**Issue.** Confirmed exactly as stated. Uncommitted edit at App.tsx:1644/1658/1663 leaves App.tsx unparseable; no Metro bundle, no release build.

```
1644: `<ScrollView style={{ flex: 1 }} contentContainerStyle={styles.launchContent}>` … 1658: `</View>` … 1660: `<View style={styles.signInFooter}>` … 1663: `</ScrollView>`  — TypeScript parse output: `1658:9 Expected corresponding JSX closing tag for 'ScrollView'.` and `1663:9 Expected corresponding JSX closing tag for 'View'.`
```

**Impact.** Every device, every screen size, every font setting: Metro/Babel cannot parse App.tsx, so there is no bundle — the app shows the red syntax-error screen in dev and fails the release build. `git show HEAD:apps/remote-365-mobile/App.tsx` parses with 0 diagnostics, so this is an uncommitted working-copy edit that swapped LaunchingScreen's outer `<View style={styles.launchContent}>` for a scrollable container (a sensible short-screen fix) but moved the wrong closing tag. Nothing else in this audit can be observed on a device until this is fixed.

**Fix.** Line 1658: `</View>` → `</ScrollView>` (closes the ScrollView opened at 1644). Line 1663: `</ScrollView>` → `</View>` (closes the footer View opened at 1660).

### App.tsx:1658
**Issue.** Working-copy-only parse error: in LaunchingScreen the ScrollView opened at 1644 is closed by </View> at 1658 and the signInFooter View opened at 1660 is closed by </ScrollView> at 1663. Metro/Babel abort on the whole module, so nothing renders. Fix: close the ScrollView at 1658 and move </View> to 1663 (or make the footer a sibling of the ScrollView, which is what the layout wants — see missed finding on launchContent paddingBottom).

```
1644  <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.launchContent}>
...
1658      </View>
1660      <View style={styles.signInFooter}>
1663      </ScrollView>
```

**Impact.** Every device, every screen size. `npx babel` / Metro aborts with `Expected corresponding JSX closing tag for <ScrollView>. (1658:6)` (I ran @babel/parser on the file to confirm). Nothing in the app renders at all until this is fixed, which makes any on-device responsiveness testing impossible. The damage is localised to the launch screen's own scroll refactor — the styles it references (launchContent 5428, signInFooter 5402) are the responsive-overlay ones from this slice.

**Fix.** Close the tags in the right order: change line 1658 to `</ScrollView>`, move the signInFooter View outside it as a sibling of the ScrollView, and change 1663 to `</View>` — i.e. `<ScrollView>…</ScrollView>` wrapping launchMain + launchButton, then `<View style={styles.signInFooter}>…</View>` as the next child of SafeAreaView.

### src/meetings/MeetingRoom.tsx:2602
**Issue.** stage (MeetingRoom.tsx:2602) is a plain column View with no flexWrap and no ScrollView; each tile (2623) is flex:1/minHeight:120 and RN's flexShrink default of 0 means tiles never shrink. On a 360x780dp phone only 4 tiles fit the ~573dp stage, so from the 5th participant onward tiles render past the bottom of the stage, under the floating control pill and off-screen, with no way to scroll to them. On a short window (split-screen, foldable cover display, 320x568-class) the break starts at 3 participants.

```
stage: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    flex: 1,
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 8,
  },
  ...
  tile: {
    flex: 1,
    minHeight: 120,

// render (1144-1149), the DEFAULT path when nobody is pinned or sharing:
) : (
  <>
    {localTile(false)}
    {participants.map((participant) => remoteTile(participant, false))}
  </>
)}
```

**Impact.** On a standard 360x780dp phone (Galaxy S23 / Pixel 8) the stage's inner height is ~573dp (780 - 79 header - 104 control pill - 8 marginTop - 16 padding). With gap 8 and minHeight 120, only 4 tiles fit (128*N <= 581). A 5-person meeting therefore renders a 5th tile that hangs below the stage, behind/under the floating white control pill and off the bottom edge — you cannot see or tap that participant, and there is no scroll. On a short viewport (Android split-screen, a foldable cover display, a 320x568-class phone) the break happens at 3–4 people. `primaryId` is null by default (line 976: `const primaryId = ... : focusedId`, and focusedId starts null), so this is the ordinary path, not an edge case. Separately, on a tablet or unfolded foldable the same column gives every participant one full-width strip ~2.4:1 or wider, and RTCView `objectFit:'cover'` crops a 9:16 camera feed to that strip — you see a horizontal band of each face while the whole horizontal axis goes unused.

**Fix.** Compute a grid instead of a column. Add `const { width, height } = useWindowDimensions();` in MeetingRoom, derive `const cols = width >= 600 ? Math.ceil(Math.sqrt(n)) : n <= 2 ? 1 : 2;` and give `stage` `flexDirection:'row'`, `flexWrap:'wrap'`, `alignContent:'center'`, then style each tile with `width: `${100/cols}%`` (minus gap) and `aspectRatio: 3/4` (or `height: (stageH - gap*(rows-1)) / rows`) instead of `flex:1 / minHeight:120`. Wrap the stage in a ScrollView (or cap the visible tiles at rows*cols and page the rest) so no tile can ever land outside the stage box, and add `overflow:'hidden'` to `stage` so an overflow is visibly contained rather than drawn over the control pill.

### android/app/src/main/AndroidManifest.xml:30
**Issue.** MainActivity's android:configChanges omits smallestScreenSize, density and fontScale, so Android destroys and recreates the Activity on foldable fold/unfold, split-screen entry/resize, and on Display-size or Font-size accessibility changes.

```
android:configChanges="keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode"
```

**Impact.** Foldables (Galaxy Z Fold/Flip, Pixel Fold): unfolding mid-session tears the whole app down and it reappears at the splash screen, dropping the live WebRTC remote-control session, the meeting, and any half-typed chat message. Tablets and large phones: dragging the split-screen divider does the same. Any device: a user who changes Settings > Display > Display size (density) or Font size while the app is running — the exact accessibility settings this audit is about — gets a full app restart. `orientation|screenSize` are present, so plain rotation survives; it is specifically the fold/resize/density/fontScale axes that are fatal. The native host at apps/android-host declares no configChanges at all, but its Compose activities are trivial and stateless, whereas here the destroyed Activity takes an entire RN JS tree and a peer connection with it.

**Fix.** Extend the attribute to android:configChanges="keyboard|keyboardHidden|orientation|screenSize|screenLayout|smallestScreenSize|density|fontScale|locale|layoutDirection|uiMode". `smallestScreenSize` is the load-bearing one for foldables and split-screen; `density` and `fontScale` stop the accessibility-settings restart (RN already re-emits didUpdateDimensions from ReactActivityDelegate.onConfigurationChanged, and useResponsive() at src/lib/useResponsive.ts:6 already reads fontScale from useWindowDimensions, so the JS layer will re-lay-out correctly without the restart).

### App.tsx:3744
**Issue.** A `<Text>` style pins its own `height` to exactly its `lineHeight`, so the label clips the moment the OS font scale exceeds 1.0.

```
deviceGroupTitle: {
    color: '#111315',
    fontSize: 10,
    fontWeight: '400',
    height: 14,
    lineHeight: 14,
  },
```

**Impact.** Every Android device with Settings > Display > Font size above the default (the 'Large' step is only 1.15x). The 'Managed devices' and 'Groups' section labels on the Devices tab (rendered at App.tsx:664 and App.tsx:676) are vertically cropped: at 1.15x the 10sp text needs a ~16dp line box inside a 14dp Text, so descenders in 'Managed' and 'Groups' are sliced off; at 1.3x roughly the bottom third of every glyph is gone. This is the single lowest-slack text style in the app — zero pixels of headroom by construction.

**Fix.** Delete the `height: 14` line entirely and let the Text size itself; if a minimum is wanted use `minHeight: 14`. Also raise `fontSize` from 10 to at least 12 (Android's readability floor).

### src/meetings/MeetingHome.tsx:75
**Issue.** The Meetings screen both hard-disables font scaling on every text node (15 `allowFontScaling={false}` props) and multiplies every type size by a width-derived factor capped at 1, so on small phones the type shrinks below the design size and the OS accessibility font setting is ignored outright.

```
const k = Math.min(1, width / FIGMA_WIDTH);   // FIGMA_WIDTH = 360 (line 48)
  const styles = useMemo(() => makeStyles(k), [k]);
...
  const s = (value: number) => Math.round(value * k * 100) / 100;   // line 337
    bodyText: { color: '#000000', fontSize: s(14), ... lineHeight: s(20) },   // line 343-348
```

**Impact.** 320-360dp-wide phones (Galaxy A0x/A1x, Redmi 9A, iPhone SE 1st gen at 320pt) plus anyone using a large system font. On a 320dp phone k = 0.889, so body copy renders at 12.4px, the Quick-join label at 12.4px and `errorText` at 10.7px — and because every one of those nodes carries `allowFontScaling={false}` (lines 212, 214, 216, 225, 226, 231, 237, 239, 242, 259, 269, 274, 282, 297, 298), turning the system font size up to Largest changes nothing on this screen. A low-vision user literally cannot enlarge the meeting code, the join field or the error text.

**Fix.** Remove all 15 `allowFontScaling={false}` props from this file, and stop applying `k` to font sizes and line heights (keep `s()` for spacing/box dimensions only) so type stays at the design size and honours `fontScale`.

### App.tsx:1658
**Issue.** App.tsx does not parse: LaunchingScreen opens a <ScrollView> and closes it with </View>, swallowing the footer. Every finding in this file (the auditor's and mine) is against a file that cannot currently be bundled.

```
1644 <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.launchContent}> ... 1657 </Pressable> 1658 </View> 1660 <View style={styles.signInFooter}> ... 1663 </ScrollView>  — @babel/parser: "Expected corresponding JSX closing tag for <ScrollView>. (1658:6)"
```

**Impact.** No device runs this build at all — Metro/Babel fails on App.tsx, so the app will not bundle or start on any phone, tablet or foldable. It is an uncommitted working-copy regression: git HEAD has <View style={styles.launchContent}> at 1605 closed by </View> at 1619, with the footer View as a sibling; the edit that swapped that View for a ScrollView (itself a responsiveness fix) left the old </View> in place and moved </ScrollView> past the footer.

**Fix.** In LaunchingScreen, close the ScrollView correctly: make line 1658 </ScrollView>, keep the signInFooter <View> as a sibling of the ScrollView inside SafeAreaView, and delete the stray </ScrollView> at 1663. Re-run `node -e "require('@babel/parser').parse(...)"` or tsc --noEmit before any further edits to this file.


## HIGH

### App.tsx:1568
**Issue.** NoConnectScreen autofocuses a number-pad TextInput but has no KeyboardAvoidingView, so on iOS the keyboard covers the only 'Connect' button and the number pad has no return key to submit with

```
App.tsx:1522  <SafeAreaView style={styles.noConnectScreen} edges={['left', 'right']}>
App.tsx:1533-1543  <TextInput ... keyboardType="number-pad" autoFocus returnKeyType="go" onSubmitEditing={submit} />
App.tsx:1568  <View style={[styles.noConnectButtons, { paddingBottom: insets.bottom + 12 }]}>  // pinned bottom bar, outside the ScrollView, no KeyboardAvoidingView anywhere in the component (the file uses KeyboardAvoidingView only at App.tsx:1996 and 3322)
```

**Impact.** Every iPhone. The screen mounts with autoFocus, so the keyboard is already up; the Cancel/Connect bar is a flex sibling pinned below the ScrollView and is drawn behind the keyboard. iOS 'number-pad' renders a 10-key pad with no return key, so onSubmitEditing/returnKeyType="go" can never fire, and there is no tap-outside-to-dismiss (the ScrollView above uses keyboardShouldPersistTaps="handled", not a dismiss handler). The user types a support ID and has no way to start the session - the app's core flow dead-ends. Android is unaffected because edge-to-edge + adjustResize shrinks the window and its numeric IME carries an enter key.

**Fix.** Wrap the body in <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex:1}}> as AuthScreen already does at App.tsx:1996, and add keyboardDismissMode="on-drag" plus a 'Done' accessory (or keyboardType="numeric") so the pad can be dismissed.

### App.tsx:3796
**Issue.** managedHeaderTitle (3796) / monitorHeaderTitle (4668) are non-shrinkable rows in a space-between header, so a long group name (title prop, 963) or fontScale >= 1.6 with the default title pushes the entire refresh + settings + search cluster off the right edge of the screen, making them untappable. Fix: flexShrink:1 + minWidth:0 (or flex:1) on the title Pressable.

```
managedHeaderTitle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
```

**Impact.** 320-360dp-wide phones (and any width at fontScale ≥ 1.3) on the Managed Devices screen, whose header title is a user-supplied group name (line 963, `title` prop). "Riyadh Retail Branch Terminals" at 16dp ≈ 240dp + 20dp arrow + 12dp gap + 32dp horizontal padding = 304dp, leaving 56dp of a 360dp screen for a 74dp action cluster: the Settings gear (972) is clipped and the Refresh button (969) is partly off-screen — both become untappable, so the user cannot refresh or reach settings from that screen. `managedTitle` does set `flexShrink: 1` (3806) but that is inert because its parent cannot shrink. Same shape in `chatHeaderTitleRow` (3959) and `monitorHeaderTitle` (4668), which break at fontScale ≥ 1.3 with their static titles.

**Fix.** Add `flex: 1, minWidth: 0` to `managedHeaderTitle`, `chatHeaderTitleRow` and `monitorHeaderTitle`, and `flexShrink: 0` to `managedActions`/`chatActions`/`monitorActions` — the exact treatment already applied to `topBrand` at 3614 (`flexShrink: 1, minWidth: 0`).

### src/auth/AuthScreen.tsx:132
**Issue.** On Android the screen uses KeyboardAvoidingView behavior="height", which applies a hard pixel height plus flex:0 computed from RN's `_initialFrameHeight` — a value captured on the very first layout and never recomputed — so any window resize that does not recreate the activity leaves the form sized to the old window.

```
<KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
```

**Impact.** Foldables (Pixel Fold, Galaxy Z Fold) and Android split-screen / DeX / desktop windowing. RN 0.81 KeyboardAvoidingView.js:130-133 does `if (!this._initialFrameHeight) { this._initialFrameHeight = this._frame.height; }` and line 244-247 renders `height: this._initialFrameHeight - bottomHeight, flex: 0`. The manifest declares android:configChanges="keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode", so dragging the split-screen divider (changes screenSize but not smallestScreenWidthDp) resizes the window WITHOUT recreating the activity and the stale value survives. Concretely on a Pixel Fold: start folded (~840dp tall window, _initialFrameHeight ~740dp), unfold to the inner screen (~625dp tall, KAV should be ~525dp), tap Password — the KAV is pinned to 740 - imeHeight (~490dp) with flex:0 inside a 275dp visible area, so ~215dp of the card including the Sign In button is drawn behind the keyboard and the ScrollView will not scroll it up because its own viewport believes the content already fits. The same happens after dragging the split-screen divider taller: the form freezes at the old smaller height leaving a blank white band under it. iOS is unaffected because 'padding' never reads _initialFrameHeight.

**Fix.** Use `behavior="padding"` on both platforms — `behavior={'padding'}` — since the 'padding' branch (KeyboardAvoidingView.js:275-284) only adds paddingBottom and never touches `_initialFrameHeight`, and the offset math is already exact for this tree. If 'height' must stay on Android, force a remount on window resize: `const { width, height } = useWindowDimensions();` then `<KeyboardAvoidingView key={`${width}x${height}`} ... >`. Note the repo is already inconsistent here — src/devices/DeviceManagement.tsx:462 and src/remote/RemoteControl.tsx:1321 use `behavior={Platform.OS === 'ios' ? 'padding' : undefined}`.

### src/settings/AccountScreen.tsx:150
**Issue.** The Delete-account confirmation dialog is a fixed, unscrollable, vertically-centred box with no height cap and no safe-area awareness, so at large font scale on a short phone its Cancel/Delete buttons are pushed outside the viewport and become untappable.

```
dialogBackdrop: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', flex: 1, justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: '#FFFFFF', borderRadius: 16, elevation: 12, maxWidth: 360, padding: 20, width: '100%' },
  ...
  dialogButtons: { flexDirection: 'row', gap: 10, marginTop: 20 },
```

**Impact.** Small/short phones (5", ~320x568dp, e.g. Galaxy A0x class or a folded Galaxy Fold at 280dp) with Android Settings > Accessibility > Font size at Large/Largest (fontScale 1.3-2.0), or iPhone SE with Larger Accessibility Sizes. Stacking the pieces at fontScale 2.0: 24dp backdrop pad + 20 pad + 44 icon + 12 margin + ~46 title + 6 + the 95-character body at 28sp wrapping to ~7 lines of 40dp (~280dp) + 20 margin + ~64dp buttons + 20 pad = ~512dp of content against ~520dp of usable height — and the optional deleteError line (line 113) adds another ~40dp. Because the child is a plain View inside a justifyContent:'center' backdrop with no ScrollView, the overflow splits top and bottom: the title scrolls off the top and the Cancel/Delete row is clipped below the screen edge. The user can neither confirm nor cancel with a button (only a backdrop tap dismisses). The same 24dp backdrop padding is the only thing standing between the dialog and a display cutout, since nothing here reads useSafeAreaInsets. Note the codebase already exports modalMaxHeight (src/lib/responsive.ts:14) and stackActions (src/lib/responsive.ts:10) for exactly this case and AccountScreen imports neither.

**Fix.** Wrap the dialog body in a ScrollView and bound its height: import { useResponsive } from '../lib/useResponsive' and render <View style={[styles.dialog, { maxHeight: modalMaxHeight - insets.top - insets.bottom }]}><ScrollView ...>. Also use the existing stackActions flag to switch dialogButtons to flexDirection: 'column' when stackActions is true, so 'Cancelar'/'Abmelden'-length labels at fontScale 2.0 stop wrapping inside 111dp-wide side-by-side buttons.

### src/settings/SettingsScreen.tsx:166
**Issue.** The root Settings list is the only settings page that does not use the SettingsPage scaffold — it rebuilds the SafeAreaView/ScrollView by hand with a hardcoded 16dp gutter and no maxWidth/alignSelf, so it never calls useResponsive() and gets none of the width adaptation every child page gets.

```
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
...
  content: {
    gap: 16,
    paddingBottom: 36,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
```

**Impact.** Compare with SettingsScaffold.tsx:240-249, which has `maxWidth: 720, alignSelf: 'center'` plus `paddingHorizontal: gutter`. Two visible breaks. (1) Wide screens: ios.supportsTablet is true (app.json:16) and android:screenOrientation="portrait" is ignored on Android 12L+ large screens, so on an iPad (820-1024pt) or an unfolded Pixel Fold (841dp) the root Settings list runs the full window width with a 16dp gutter — an 800dp-wide row with 'Trusted devices' pinned far left and its chevron pinned far right, ~40cm of dead space between them — and then tapping it pushes Chat/Control/Streaming, which snap to a centred 720dp column. The layout visibly jumps width on every navigation. (2) Narrow screens: on a folded Galaxy Fold (280dp) or a 320dp device, getResponsiveLayout drops the gutter to 12dp (src/lib/responsive.ts:5) for every sub-page, but this screen stays at 16dp, losing 8dp of the already-scarce row width and truncating the Language/Presence detail values sooner than on the pages beneath it.

**Fix.** Delete the bespoke SafeAreaView/ScrollView/StatusBar (lines 81-85, 159-160) and render the whole body inside <SettingsPage title={t('Settings')} onBack={onBack}> like every other screen in this folder; drop the local `content` style. If the bespoke shell must stay, at minimum add `const { gutter } = useResponsive()` and set `contentContainerStyle={[styles.content, { paddingHorizontal: gutter, maxWidth: 720, alignSelf: 'center', width: '100%' }]}`.

### src/settings/SettingsScreen.tsx:257
**Issue.** The Log out and Sign in pill buttons use a fixed `height: 44` instead of `minHeight`, so their labels are clipped once the text no longer fits 44dp — which happens with translated strings at large font scale.

```
  logoutButton: {
    ...
    flexDirection: 'row',
    gap: 10,
    height: 44,
    justifyContent: 'center',
...
  signInButton: {
    ...
    borderRadius: 4,
    height: 44,
```

**Impact.** The label is translated (line 152: t('Log out')), and src/lib/i18n.tsx:34 maps it to Spanish 'Cerrar sesión' (13 chars). On a 320-360dp phone at Android font size Largest (fontScale 1.3) the row is a 16px icon + 10dp gap + 'Cerrar sesión' at 18.2sp (~118dp) — still one line. At fontScale 2.0 (Accessibility > Font size max on Pixel, or Display size Large stacked on Font size Large) the text is 28sp with a 40dp line box: a single line already leaves 2dp of padding inside the 44dp box, and once it wraps to two lines (52-80dp) the second line renders outside the bordered pill, overlapping the ScrollView's 36dp bottom padding and colliding with the safe-area edge. The 'Sign in' orange button (line 201) has the identical bug and, because it has a solid background, the overflow reads as text spilling out of the button. Every other row in this file and in SettingsScaffold correctly uses minHeight — these two are the outliers.

**Fix.** Replace `height: 44` with `minHeight: 44, paddingVertical: 12` on both `logoutButton` (line 257) and `signInButton` (line 201). The Pressables already center their content, so nothing else changes at default font scale.

### src/chat/ChatThread.tsx:336
**Issue.** Same as claimed. Confirmed on all device classes; the proportion of the thread lost scales with keyboard-height/window-height, so it is worst on 640dp-tall budget phones and in split-screen.

```
  useEffect(() => {
    // Scroll to the newest message whenever the list grows.
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(timer);
  }, [messages.length]);        // <- only dependency
```

**Impact.** Tapping the composer on any device shrinks the ScrollView by the keyboard height (~260-320dp on a phone, ~45% of the window on a short 640dp device) while `contentOffset` is preserved, so the newest messages slide below the fold and the user is left staring at older history with the reply box on top of it. The shorter the screen (640dp budget Androids, split-screen, unfolded-foldable landscape) the more messages are lost. The repo already solves this elsewhere: `src/meetings/MeetingHome.tsx:97-103` uses `Keyboard.addListener('keyboardDidShow', ...)` with `endCoordinates.height`, and `MeetingRoom.tsx:855` / `RemoteControl.tsx:359` do the same.

**Fix.** Add the same listener next to the existing effect: `useEffect(() => { const s = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => scrollRef.current?.scrollToEnd({ animated: true })); return () => s.remove(); }, []);` and, on iOS, set `automaticallyAdjustKeyboardInsets` on the ScrollView.

### src/meetings/MeetingHome.tsx:212
**Issue.** MeetingHome.tsx pins allowFontScaling={false} on all 15 Text nodes and the code TextInput (e.g. line 212), and makeStyles never reads fontScale, so the Meetings tab is the only tab in the app that does not respond to Settings > Display > Font size. On Android 14+ at 200% font scale every other screen grows and Meetings stays at 14sp body / 12sp meeting codes, so the meeting code a low-vision user must read and re-type stays at its smallest size.

```
<Text allowFontScaling={false} style={styles.timeText}>{formattedTime}</Text>
...
<TextInput
  allowFontScaling={false}
  autoCapitalize="characters"
```

**Impact.** 15 occurrences in MeetingHome.tsx vs. 1 in the whole of MeetingRoom.tsx — the two files behave in opposite ways. A user on Android with Settings > Display > Font size = Largest (fontScale 1.3), or on iOS with Larger Accessibility Sizes (up to ~3.1), sees the Meetings tab render at exactly 14sp body / 12sp meeting codes / 18sp headings — no larger than default — while every other tab in the app grows. The meeting code line (`meetingCode`, fontSize s(12), monospace) is the smallest text on the screen and is precisely the thing a low-vision user needs to read and type.

**Fix.** Delete `allowFontScaling={false}` from all 15 Text nodes and the TextInput, and make the containers tolerate the growth: replace the fixed `height: s(40)` on `input`, `joinButton`, `primaryButton` and `emptyRecent` with `minHeight` + `paddingVertical`, and give `meetingRow` `minHeight` (it already has it) rather than a fixed height. If a hard cap is wanted, use `maxFontSizeMultiplier={1.5}` instead of switching scaling off entirely.

### src/meetings/MeetingHome.tsx:75
**Issue.** MeetingHome derives one scale factor k = Math.min(1, width/360) (line 75) and multiplies every font, gap, height and touch target by it (s(), line 338), so narrow viewports shrink the UI instead of reflowing it. copyButton and refreshButton (lines 357-362, 499-504) are s(32) with no hitSlop — already under the 48dp Android minimum at k=1 on every phone, and 28.4dp on a 320dp device, where the Join button also drops to 35.5dp and body text to 12.4sp. Because fontScale is never read here and every Text sets allowFontScaling={false}, a user who maxes out both Display size and Font size gets Meetings text ~11% smaller than default.

```
const { width } = useWindowDimensions();
  const k = Math.min(1, width / FIGMA_WIDTH);
  const styles = useMemo(() => makeStyles(k), [k]);
// ...
const s = (value: number) => Math.round(value * k * 100) / 100;
```

**Impact.** Android's Settings > Display > Display size raises density and lowers the effective dp width — a Pixel 8 goes from 411dp to roughly 320–360dp at the largest setting. At 320dp, k = 0.889, so body text becomes 12.4sp, meeting codes 10.7sp, the Join button 35.5dp tall and the copy/share/refresh buttons 28.4dp square (`copyButton`/`refreshButton`, lines 357-362 and 499-504) — well under Android's 48dp and iOS's 44pt minimum touch target, on a screen where three of those buttons sit side by side in a 52dp row. Combined with the previous finding, a low-vision user who turns BOTH "Display size = Largest" and "Font size = Largest" all the way up gets Meetings text that is ~11% *smaller* than default — the exact opposite of what they asked the OS for. The same k also applies on a foldable cover display (Z Flip outer ~ 320–350dp).

**Fix.** Stop scaling type and hit targets by width. Keep `k` only for decorative spacing if you want, but clamp it at the bottom (`Math.min(1, Math.max(0.92, width / FIGMA_WIDTH))`) and, better, floor the interactive metrics: `height: Math.max(44, s(40))` on `input`/`joinButton`/`primaryButton`, and `Math.max(44, s(32))` on `copyButton`/`refreshButton`, with font sizes left unscaled so the OS fontScale governs them.

### src/meetings/MeetingRoom.tsx:903
**Issue.** The chat/People/Settings card has no minimum height: on a short window the keyboard lift can drive the card smaller than its own fixed header + composer, and overflow:'hidden' then clips away the text input the user is typing into.

```
const controlBarSpace = 68 + Math.max(insets.bottom + 12, 28);
  const chatCardBottom = keyboardHeight > 0
    ? Math.max(0, keyboardHeight - controlBarSpace + insets.bottom + 8)
    : 0;
// card is absolute inside `middle` (flex:1) with top:8 and bottom:chatCardBottom — line 1815 chatCard { overflow: 'hidden', top: 8 }
// its fixed chrome: chatHeader (2033) paddingTop 18 + title lineHeight 23 + paddingBottom 16 + 1px border = 58; composer (2111) paddingVertical 8*2 + sendButton height 42 = 58
```

**Impact.** On an unfolded Pixel Fold / Galaxy Z Fold, a tablet, or any device in Android split-screen or iPad Slide Over — all reachable because MainActivity declares configChanges orientation|screenSize|screenLayout with no resizeableActivity=false, and Android 12L+ ignores the portrait lock on large screens — a roughly 800x360dp window leaves `middle` at about 183dp (360 minus ~63 header minus 104 control block). With a ~200dp landscape keyboard, chatCardBottom = 200-96+8 = 112, so the card is 183-8-112 = 63dp tall while its own header (58) plus composer (58) need 116dp. chatList has minHeight:0 so it collapses to zero, and the remaining 53dp of chrome is clipped by overflow:'hidden' — the composer and send button disappear while the keyboard is open, so the user cannot see what they are typing or reach Send.

**Fix.** Clamp the lift against the container height (e.g. compute the card height and cap chatCardBottom so the card never drops below chatHeader + composer + a minimum list height), and give chatList a small minHeight rather than 0, or fall back to a full-screen chat sheet when useWindowDimensions().height is below a threshold.

### src/meetings/MeetingRoom.tsx:2090
**Issue.** MeetingRoom leaves font scaling ON (only 1 allowFontScaling={false} in 2731 lines, on the composer input) but hardcodes every lineHeight in dp, so at large OS font sizes the text grows past its own line boxes while the input stays fixed.

```
chatMessage: {
    fontSize: 12,
    lineHeight: 17,
  },
// same pattern: chatHeaderTitle (2291) fontSize 16 / lineHeight 23; tileName (2652) fontSize 12 / lineHeight 17; headerMeta (2199) fontSize 12 / lineHeight 17; headerTitle (2214) fontSize 14 / lineHeight 20
// the one exception, line 1205 (composer TextInput): allowFontScaling={false}
```

**Impact.** React Native multiplies fontSize by fontScale but never scales a lineHeight given in style. On Android 14+ with Accessibility > Font size at 200% (fontScale 2.0) the chat message text becomes 24sp inside a 17dp line box, the chat card title 32sp inside 23dp, and the participant name overlay 24sp inside 17dp — lines overlap each other and are cropped top and bottom on every phone, no screen size required. It is worse in the composer: chatInput is the file's single allowFontScaling={false}, so the message you type stays at 14sp while the messages above it double, which reads as a rendering fault. This is the exact mirror of the MeetingHome defect: Home refuses to scale at all, Room scales without a layout that can absorb it.

**Fix.** Drop the fixed lineHeight values (or multiply them by useWindowDimensions().fontScale), replace fixed-height text containers with minHeight, and remove allowFontScaling={false} from the composer so the whole screen scales consistently.

### src/remote/RemoteControl.tsx:1580
**Issue.** toolbarRow (line 1580-1587) has paddingHorizontal 22 and six non-shrinking children — five 40dp toolButtons (line 1588, rendered at lines 1387-1401) plus toolbarEndGroup = endButton 64 + gap 12 + hideButton 24 (lines 1601-1610). Intrinsic width is exactly 44+200+100 = 344dp with flexShrink 0 everywhere, so any viewport below 344dp overflows: at 320dp the 24dp chevron Hide button is entirely off-screen (the toolbar can never be re-collapsed), and at Android 'Largest' display size on a 360dp phone (~277dp) the Hide button and most of the 64dp End button are off the right edge. At the default 360dp it fits with only ~16dp of slack spread over 5 gaps, so the icon buttons sit ~3dp apart.

```
toolbarRow: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
...
  toolButton: { height: 40, width: 40, alignItems: 'center', justifyContent: 'center' },
...
  toolbarEndGroup: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  endButton: { height: 44, width: 64, ... },
  hideButton: { height: 40, width: 24, ... }
```

**Impact.** Required width = 22*2 padding + 5 x 40dp tool buttons + (64 + 12 + 24) end group = 344dp, and React Native's flexShrink defaults to 0 so nothing compresses. On a 320dp-wide phone (iPhone SE 1st gen, budget Androids, a Galaxy Z Fold cover screen) the row overflows by 24dp: the chevron-down Hide button sits entirely off-screen and cannot be pressed, so the user can never re-hide the toolbar. The far more common case is Android Settings > Display > Display size: on a standard 360dp phone, 'Larger' yields ~327dp and 'Largest' ~277dp of usable width, at which point the Hide button and most of the red End button are off the edge — the user cannot end the session from the bar. Even at exactly 360dp there are only 16dp of slack spread over 5 gaps (~3.2dp each), so the five 40dp icon buttons sit edge-to-edge and Gestures/Keyboard/Shortcuts mis-taps are near certain.

**Fix.** Make the row shrink instead of overflow: give each Pressable `flex: 1` with `minWidth: 44` and drop the fixed 40dp widths, reduce `paddingHorizontal` to a responsive value (e.g. `Math.min(22, windowDims.width * 0.04)`), and shrink the end group (`endButton` 64 -> 48, `hideButton` 24 -> 44 with `flexShrink: 1`). Alternatively wrap the row in a horizontal ScrollView when `windowDims.width < 360`. Verify the sum stays under `windowDims.width - insets.left - insets.right` at 277dp.

### src/remote/RemoteControl.tsx:1440
**Issue.** sheetStyles.sheet has maxHeight: 520 (line 140) and the sheet body is a ScrollView with a hardcoded maxHeight: 440 (line 1440), neither derived from windowDims. actionItems has 10 rows (lines 1134-1149); each SheetRow is paddingVertical 12+12 plus a ~19dp 14pt label (sheetStyles.row lines 151-159) = ~43dp, so content is ~430dp, which is UNDER the 440 cap — the inner ScrollView therefore never scrolls. Sheet total = 16 grabber + 430 + 8 + insets.bottom = ~454-478dp. sheetStyles.overlay is absoluteFillObject with justifyContent 'flex-end' (lines 129-133) and RN's default flexShrink is 0, so in landscape (412dp tall on a 412x915 device, 360dp on a 360x740) the sheet's top lands at roughly -42 to -118dp and the first one to three rows ('Chat with remote user', 'Refresh stream') are drawn above the display and are unreachable.

```
<ScrollView style={{ maxHeight: 440 }}>   // line 1440
  sheet: { ... paddingBottom: 8, maxHeight: 520 },   // line 140
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', zIndex: 150 },   // line 129-133
```

**Impact.** actionItems has 10 rows (lines 1134-1149); each SheetRow is paddingVertical 12*2 + a ~19dp 14pt label = ~43dp, so content is ~430dp. Total sheet height = 16 (grabber) + 430 + 8 + insets.bottom(~24) = ~478dp. The overlay is absoluteFill with justifyContent 'flex-end', so on a phone rotated to landscape (viewport height 412dp on a 412x915 device, 360dp on a 360x740 device) the sheet's top starts at y = -66dp to -118dp. Because the inner ScrollView's content (430) fits inside its own 440 cap it does not scroll at all, so 'Chat with remote user', 'Refresh stream' and, on smaller phones, 'Ctrl + Alt + Del' are drawn off the top of the display and are permanently unreachable. Raising the Android font size makes it strictly worse (rows grow, the 440 cap does not). The chat panel right below it was already fixed for exactly this (line 1325-1327 comment: 'a fixed 400 was taller than the whole screen in landscape') but the sheet was not.

**Fix.** Replace both constants with viewport-derived values: on the sheet use `maxHeight: windowDims.height * 0.7` and on the ScrollView `maxHeight: Math.max(160, windowDims.height - insets.top - insets.bottom - 40)` (mirroring the `Math.max(200, surfaceH - 28)` pattern already used at line 1327), so the list always scrolls rather than overflowing past the top edge.

### src/remote/RemoteControl.tsx:878
**Issue.** toNormalized (line 872-879) ends with `return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };` — an out-of-picture touch is clamped rather than rejected — and surfaceResponder is spread onto the full-size surface View (lines 1241-1252, sized windowDims.width x windowDims.height minus insets/toolbar), not onto contentRect. The video itself is pointerEvents='none' (line 1264). In the default 'fit' mode (line 228) with a 16:9 host on a 20:9 phone, baseRect (lines 768-784) produces a 412x232dp picture inside an ~851dp surface, so ~73% of the touchable area is black bar; a tap there fires mousemove+mousedown+mouseup (lines 1048-1052) clamped to y=0 or y=1, i.e. on the host's title-bar row or the Windows taskbar. The same clamp makes g.startNearTopEdge (line 906, `toNormalized(...).y < 0.08`) true across the whole upper letterbox, dropping the drag threshold from 8dp to 2dp (line 1011).

```
return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };   // line 878
...
<View ref={surfaceViewRef} style={[styles.surface, { ... width: surfaceW, height: surfaceH }]} onLayout={measureSurface} {...surfaceResponder}>   // lines 1241-1252
...
sendMessage({ type: 'mousedown', button, ...point });   // line 1050
```

**Impact.** On a 20:9 phone (e.g. 412x915dp) viewing a 16:9 Windows host in the default 'Best fit' mode, baseRect yields a 412 x 232dp picture inside an ~851dp-tall surface: 73% of the touchable area is black bar. A tap anywhere in the bottom bar clamps to y = 1 and fires mousemove+mousedown+mouseup at the very bottom of the remote desktop — i.e. on the Windows taskbar / Start button. A tap in the top bar clicks the host's title bar / window close row. The user experiences random taskbar launches and closed windows when they miss the small picture. The same clamp also makes `g.startNearTopEdge` (line 906) true for the entire upper letterbox, dropping the drag threshold from 8dp to 2dp there. Tall 20:9/21:9 phones are the worst case; a 4:3 tablet barely shows it, which is exactly why this reads as 'not responsive on mobile'.

**Fix.** Have toNormalized return null when the raw x or y falls outside 0..1, and make `onResponderGrant` return false / `onStartShouldSetResponder` reject touches outside `liveRectRef.current`, so letterbox taps are swallowed locally instead of being clamped and injected. Keep the clamp only for drag-continuation (onResponderMove/Release) where the finger legitimately leaves the picture mid-drag.

### src/remote/RemoteControl.tsx:1193
**Issue.** The connecting/error screen (lines 1190-1229) is a plain View with connectingRoot { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 } (line 1735-1741) and no ScrollView and no SafeAreaView. Its stack is ~450-500dp tall (connectingImage fixed 230x190 at line 1743, chip 32, title lineHeight 34 that wraps for long device names, body ~36, bar 12, status ~15, cancel 40+10 margin, plus six 14dp gaps from connectingInner at line 1742). In landscape (364dp usable on a 412x915 device, 312dp on a 360x740) the centre-aligned stack overflows at BOTH ends and the orange 'Cancel session' / 'Back to devices' Pressable (lines 1223-1225) is below the screen edge. It also overflows a 320x568 phone once the Android font scale is raised (no allowFontScaling={false} anywhere in this file).

```
<View style={styles.connectingRoot}>   // line 1193
...
  connectingRoot: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', padding: 24 },
  connectingInner: { alignItems: 'center', gap: 14, maxWidth: 340, width: '100%' },
  connectingImage: { width: 230, height: 190 },
```

**Impact.** Content height = image 190 + chip 32 + title lineHeight 34 + body ~36 + bar 12 + status ~14 + cancel 40 + six 14dp gaps = ~452dp. connectingRoot has padding 24 and is centred with no scroll. On a phone held in landscape (viewport height 412dp -> 364dp usable; 360dp device -> 312dp usable) the stack overflows by ~90-140dp and, because it is centre-aligned, is clipped at BOTH ends: the wait illustration is cut at the top and the orange 'Cancel session' button is entirely below the screen edge — during a slow or failing connect the user has no way to abort and must kill the app. This screen genuinely renders in landscape: orientation is unlocked on mount (line 322) before streamUrl exists, and reconnecting from the 'lost' screen while landscape-locked lands here too. The same stack also overflows a 320x568dp phone once the Android font scale is at 1.5+.

**Fix.** Wrap connectingInner in a ScrollView with `contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}` inside a SafeAreaView, and make the illustration responsive: `width: Math.min(230, windowDims.width - 48), height: Math.min(190, windowDims.height * 0.25)`. Apply the same treatment to lostRoot (line 1168).

### src/devices/DeviceManagement.tsx:461
**Issue.** On Android the Add device / Rename / New group card is never lifted: KeyboardAvoidingView gets behavior=undefined (461-462) and is therefore inert, and edge-to-edge (android/gradle.properties edgeToEdgeEnabled=true) defeats the manifest's adjustResize on all Android versions, with no keyboard-controller dependency as a fallback. autoFocus (279) opens the keypad immediately over a vertically centred card whose inner ScrollView has nothing to scroll (content < maxHeight 82%), so the 'Remember this device' row and the Add device / Save buttons sit behind the keyboard. Recoverable only by dismissing the keyboard with the back gesture first.

```
<KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.cardWrap}
          pointerEvents="box-none"
        >
```

**Impact.** All Android devices, worst on short viewports (<=640dp tall phones, split-screen). app.json sets `"edgeToEdgeEnabled": true`, and for edge-to-edge windows the manifest's `windowSoftInputMode="adjustResize"` no longer resizes the window on Android 15+, so KeyboardAvoidingView is the only thing that can move the card. The ID field has `autoFocus` (line 279), so the number pad opens immediately and covers roughly the bottom 45% of the screen while the card stays vertically centred: the 'Remember this device' row and the Add device / Save buttons sit behind the keypad with no way to reach them (the inner ScrollView scrolls the card's content, not the card's position).

**Fix.** Match the rest of the app: `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}` (see AuthScreen.tsx:132, MeetingHome.tsx:198, SettingsScaffold.tsx:66 and the sibling password prompt at App.tsx:3324). Ideally replace the hand-rolled card with `ResponsivePanel`, which every other dialog in the app uses.

### src/connect/ConnectHome.tsx:376
**Issue.** The recent-device actions popover is a hard-coded 132dp-wide card with rigid 37dp rows and non-shrinking labels, so 'File Share' wraps and is clipped at Android's ordinary 'Largest' font setting — not an extreme one.

```
const MENU_WIDTH = 132;  ...  actionsMenu: { ... width: MENU_WIDTH, zIndex: 100 },  actionMenuRow: { ... gap: 8, height: 37, paddingHorizontal: 16 },  actionMenuText: { color: '#111315', fontFamily: FONT_MEDIUM, fontSize: 13 }
```

**Impact.** Every phone and tablet with the system font size raised one or two steps (Android Settings > Display > Font size = Large/Largest, ~1.15x-1.3x; iOS Larger Text). Usable label width is 132 - 32 paddingHorizontal - 15 icon - 8 gap = 77dp. 'File Share' (line 218) measures ~66dp at 13sp and ~86dp at 1.3x, so it wraps to two ~22dp lines inside a rigid 37dp row and is clipped or collides with the Control row above it. Neither Text (lines 214, 218) has flex, flexShrink or numberOfLines, and the popover cannot widen because MENU_WIDTH is also baked into openMenu's left calculation (line 103). This is the ONLY action menu on the Connect tab, and it garbles at a font size millions of users actually run — far more reachable than the 200% cases elsewhere in this slice.

**Fix.** Replace the fixed `width: MENU_WIDTH` with `minWidth: 132, maxWidth: <row width>`; give both labels `flex: 1` (and `numberOfLines={1}` as a backstop); swap `height: 37` for `minHeight: 44, paddingVertical: 10` so the row grows with the text and also meets the 44dp touch minimum. Anchor with `right` derived from the measured row instead of `left: x + rowWidth - MENU_WIDTH`.

### src/lib/monaSans.ts:47
**Issue.** The only shared typography module maps fontWeight to a font family and nothing else — there is no type ramp, no spacing scale and no fontScale handling — so all 449 fontSize literals and 231 fixed heights in the app are raw dp, and individual screens have invented mutually incompatible scaling schemes.

```
export function monaFontStyles<T extends Record<string, any>>(styles: T): T {
  for (const key of Object.keys(styles)) {
    ... style.fontFamily = familyForWeight(style.fontWeight);
```

**Impact.** Because nothing shared exists, MeetingHome.tsx:75 rolls its own `const k = Math.min(1, width / FIGMA_WIDTH)` (FIGMA_WIDTH = 360) with `const s = (value) => Math.round(value * k * 100) / 100` and pairs it with allowFontScaling={false} on 15 Text nodes: on a 320dp phone body copy renders at 14 * 0.889 = 12.4sp and the meeting code at 10.7sp, and a low-vision user who sets Android font size to Largest or iOS Dynamic Type to AX3 sees no change at all on the Meeting tab. Every other screen ignores fontScale in the opposite direction — fixed 8/9/10sp text (43 occurrences) grows unbounded and overflows its fixed-height rows.

**Fix.** Add src/lib/typography.ts exporting a capped ramp (e.g. `export const type = { caption: 12, body: 14, title: 18 }` plus `scaled = (size, fontScale) => size * Math.min(fontScale, 1.3)`) and a spacing scale, re-export both through useResponsive(), then delete MeetingHome's private `s()`/`k` and its allowFontScaling={false} props in favour of maxFontSizeMultiplier.

### android/app/src/main/AndroidManifest.xml:30
**Issue.** The Activity is hard-locked to a single portrait orientation, but the effective targetSdkVersion is 36, and Android 16 ignores screenOrientation/resizeableActivity on any display whose smallest width is >= 600dp — so the app is forced into a landscape/large-window layout it was never built for.

```
android:screenOrientation="portrait"
```

**Impact.** Confirmed targetSdkVersion=36 (android/app/build.gradle:107 -> rootProject.ext.targetSdkVersion, resolved from node_modules/react-native/gradle/libs.versions.toml:4 `targetSdk = "36"`, and read back as targetSdkVersion="36" in the generated merged manifest). On Android 16 tablets and unfolded foldables the portrait lock is silently discarded and the app renders landscape at ~800-1200dp wide — a state the whole UI is untested in, because on every phone the lock hides it. src/lib/responsive.ts:7 then flips `compact` on (safeHeight < 600) for those landscape windows, so a 12" tablet is served the cramped small-phone layout. Reverse-portrait is also blocked outright: `portrait` (rather than `sensorPortrait`/`userPortrait`) refuses the upside-down orientation that tablet users in a stand and users with rotation-sensitive accessibility setups rely on. The native host's manifest (apps/android-host/app/src/main/AndroidManifest.xml, all five activity declarations) sets no screenOrientation at all — it simply lays out for whatever window it gets, which is why it survives every form factor.

**Fix.** Drop the hard lock and let the JS layer own orientation, which it already does: RemoteControl.tsx:322 calls ScreenOrientation.unlockAsync() on mount and lockAsync(PORTRAIT_UP) on unmount. Either remove android:screenOrientation entirely (matching the native host) and set the default lock once at startup via expo-screen-orientation, or at minimum change app.json:7 to "default" and the manifest to android:screenOrientation="userPortrait" plus android:resizeableActivity="true", then audit the top-level screens at >=600dp width.

### src/auth/AuthScreen.tsx:132
**Issue.** Eight screens wrap their content in KeyboardAvoidingView with behavior='height' on Android while the window is already android:windowSoftInputMode="adjustResize", which freezes the container to a fixed pixel height computed from the very first layout and disables flex.

```
<KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
```

**Impact.** RN 0.81's implementation (node_modules/react-native/Libraries/Components/Keyboard/KeyboardAvoidingView.js:244-247) applies `height: this._initialFrameHeight - bottomHeight, flex: 0`, and `_initialFrameHeight` is captured once on the first onLayout (lines 130-132) and never recomputed. So the height is stale after any window resize: after the remote-control screen unlocks rotation (RemoteControl.tsx:322) and the user returns, after a foldable unfold, after split-screen resize, or after a Display-size change. The visible result on small phones (320-360dp, 5") is the sign-in card collapsing to a short fixed strip with the password field and Sign In button clipped off below the keyboard, and on tall 20:9 phones a large dead gap under the card. It also double-counts on devices where adjustResize still shrinks the window. Affected: src/auth/AuthScreen.tsx:132, src/meetings/MeetingHome.tsx:198, src/chat/ChatThread.tsx:533, src/chat/AddContactModal.tsx:98, src/settings/SettingsScaffold.tsx:66, src/settings/FeedbackScreen.tsx:57, App.tsx:1997, App.tsx:3324.

**Fix.** Change every one of those eight to behavior={Platform.OS === 'ios' ? 'padding' : undefined} and let adjustResize handle Android — exactly what this codebase already does correctly at src/remote/RemoteControl.tsx:1321 and src/devices/DeviceManagement.tsx:462.

### android/app/src/main/java/com/remote365/mobile/MainActivity.kt:19
**Issue.** onCreate discards the incoming savedInstanceState by passing null to super, so every Activity recreation caused by the missing configChanges entries loses all state with no restoration path.

```
super.onCreate(null)
```

**Impact.** This is the amplifier that turns the configChanges gap (finding 1) from an annoying flicker into data loss. On a foldable unfold, a split-screen resize, or a Display-size/Font-size change, Android hands back a savedInstanceState bundle and this line throws it away — the process keeps running but the RN root is rebuilt from scratch, so the user lands back on the splash/auth gate rather than the screen they were on. There is no code path anywhere in the app that persists the current tab, the active device, or the in-flight session to survive this, so on foldables the app effectively cannot be used across a fold.

**Fix.** This line is the stock RN template and is intentional (RN cannot restore fragment state), so the correct remedy is not to change it but to stop the recreation from happening: add smallestScreenSize|density|fontScale|locale|layoutDirection to android:configChanges at AndroidManifest.xml:30. If recreation must remain possible, persist the navigation tab and active session id to AsyncStorage on change and rehydrate on mount.

### android/app/src/main/AndroidManifest.xml:30
**Issue.** android:windowSoftInputMode="adjustResize" is inert on Android 15/16 because edge-to-edge is force-enabled, so the declared keyboard handling silently stops working and screens with no KeyboardAvoidingView put the software keyboard straight over the text field

```
AndroidManifest.xml:30 `android:windowSoftInputMode="adjustResize"` + gradle.properties:47 `edgeToEdgeEnabled=true` + app.json:28 `"edgeToEdgeEnabled": true` + targetSdk 36 (node_modules/react-native/gradle/libs.versions.toml:4 `targetSdk = "36"`)
```

**Impact.** SOFT_INPUT_ADJUST_RESIZE has no effect once the window is edge-to-edge, which targetSdk 35+ forces on Android 15 and 16. So on every Android 15/16 phone the window no longer shrinks for the IME and the only remaining mechanism is KeyboardAvoidingView. src/meetings/MeetingRoom.tsx imports KeyboardAvoidingView at line 12 but never renders one, so its in-meeting chat composer TextInput at line 1195 (`placeholder="Type a reply…"`) is covered by the keyboard the moment you tap it — you type blind. Same for the device-search and add-device inputs at src/devices/DeviceManagement.tsx:272, 281, 289, which sit far above that file's only KeyboardAvoidingView at line 461. On Android 14 and below the window still resizes, so this behaves completely differently across OS versions and is invisible in testing on an older device. Worst on short/small phones where the IME eats 45-50% of the window.

**Fix.** Render a KeyboardAvoidingView (or adopt react-native-keyboard-controller, which consumes the real IME inset) around MeetingRoom's composer and DeviceManagement's forms, and stop relying on the manifest's adjustResize as the keyboard strategy on Android 15+.

### src/meetings/MeetingHome.tsx:75
**Issue.** The entire Meetings home is uniformly scaled by a Figma-width factor capped at 1, so every dimension AND every font size shrinks below the design size on any window narrower than 360dp and never grows on anything wider

```
MeetingHome.tsx:48 `const FIGMA_WIDTH = 360;`, :75 `const k = Math.min(1, width / FIGMA_WIDTH);`, :337 `const s = (value: number) => Math.round(value * k * 100) / 100;` applied to `fontSize: s(14)`, `height: s(40)`, `height: s(32)`
```

**Impact.** On a 320dp phone k = 0.889: the quick-join input's `height: s(40)` becomes 35.6dp and the copy button's `height/width: s(32)` becomes 28.4dp — both under the 48dp minimum touch target — while body text drops from 14 to 12.4sp and error text from 12 to 10.7sp. Crucially this also fires on normal-width phones the moment the user raises Settings > Display size, because Android implements that setting by lowering the dp width: a 411dp Pixel at the largest Display size reports well under 360dp, so the one screen a low-vision user just asked to make bigger is the screen that shrinks. And because all 14 Text nodes on this screen also carry allowFontScaling={false}, the font-size setting cannot compensate. Above 360dp the Math.min(1, ...) cap freezes everything at phone size, so tablets and unfolded foldables get a 360dp-wide island of content.

**Fix.** Drop the global k multiplier; use the existing src/lib/responsive.ts gutter/contentWidth tokens for spacing, leave fontSize at its design value so the platform font scale applies, and enforce minimum 44-48dp touch targets with minHeight rather than a scaled fixed height.

### App.tsx:4013
**Issue.** The chat filter chips have a fixed 22dp height wrapping 10sp/14dp text — only 8dp of total slack, all of it consumed by the first font-scale step.

```
chatChip: {
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 32,
    height: 22,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  ...
  chatChipText: { color: '#000000', fontSize: 10, fontWeight: '400', lineHeight: 14 },
```

**Impact.** Any Android phone at font size Large (1.15x) or above. The 'All' and 'Unread' pills on the Chat tab (App.tsx:1170-1180) keep a 22dp pill while the text needs 16dp at 1.15x and 18dp at 1.3x; combined with the pill's centring the glyph tops and bottoms are shaved. `chatChipWide` at App.tsx:4021 is a byte-for-byte duplicate with the same defect.

**Fix.** Replace `height: 22` with `minHeight: 22` plus `paddingVertical: 4` in both `chatChip` and `chatChipWide`.

### App.tsx:4184
**Issue.** The unread-message badge is a fixed 18dp circle containing 10sp/14dp text with no vertical padding, so the unread count is cropped at large font settings.

```
chatUnreadBadge: {
    alignItems: 'center',
    backgroundColor: '#27AE60',
    borderRadius: 91,
    height: 18,
    justifyContent: 'center',
    minWidth: 18,
    paddingHorizontal: 5,
  },
```

**Impact.** Android at 1.3x font size and above, and iOS accessibility text sizes. The green unread pill on every chat row (App.tsx:1289-1291) stays 18dp while '99+' needs ~18dp of line box at 1.3x and ~28dp at 2.0x — the digits are clipped top and bottom into unreadable slivers, and because `minWidth: 18` only guards the width, a 3-character '99+' at 2x also overflows the pill horizontally.

**Fix.** Use `minHeight: 18` with `paddingVertical: 2` instead of `height: 18`, and keep the pill's border radius proportional (e.g. `borderRadius: 999`).

### App.tsx:5702
**Issue.** The plan Upgrade button locks BOTH axes — 68dp wide and 28dp tall — around a 10sp label, so scaled text wraps and is then clipped by the fixed height.

```
upgradeButton: {
    alignItems: 'center',
    backgroundColor: '#FF8A00',
    borderRadius: 4,
    height: 28,
    justifyContent: 'center',
    marginTop: 110,
    paddingHorizontal: 10,
    width: 68,
  },
```

**Impact.** Android at 1.3x and above, on every phone size. The word 'Upgrade' (App.tsx:1807) is 7 characters; with 20dp of horizontal padding only 48dp of content width remains, so at 1.3x (13sp) the label no longer fits on one line, wraps to two, and the two lines need ~36dp inside a 28dp box — the second line is cut off entirely and the first is shaved. The `marginTop: 110` additionally pins the button to an unscaled offset while the description column above it grows, so the button drifts out of alignment with the card.

**Fix.** Drop `width: 68` and `height: 28` (keep `paddingHorizontal: 10` and add `paddingVertical: 8`), and replace `marginTop: 110` with `marginTop: 'auto'` / `alignSelf: 'flex-end'` so the button tracks the card's real height.

### App.tsx:6606
**Issue.** The remote-session password prompt is a fixed-height TextInput with no `allowFontScaling={false}`, so at large font sizes the characters the user types are vertically clipped in the one field that gates the whole remote-control flow.

```
passwordPromptInput: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(26,29,33,0.2)',
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#111315',
  },
```

**Impact.** Android at 1.5x-2.0x (Android 14+ allows 200%). The TextInput at App.tsx:3335-3344 renders 15sp text that becomes 30sp with a ~40dp line box, plus 2dp of border, inside a 46dp box that Android also gives internal padding — the password dots/characters and the caret are cropped, so a low-vision user cannot see what they typed while connecting to a device.

**Fix.** Change `height: 46` to `minHeight: 46` and add `paddingVertical: 8`.

### App.tsx:3689
**Issue.** The device search field is a fixed 40dp-tall input nested in a fixed 42dp box, and unlike two sibling search inputs in the same file it does NOT set `allowFontScaling={false}` — the handling is inconsistent within one screen.

```
deviceSearchInput: {
    color: '#111315',
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    height: 40,
    padding: 0,
  },
```

**Impact.** Android at 1.3x and above. Used at App.tsx:638 ('Search groups') and App.tsx:993, inside `deviceSearchBox { height: 42 }` (App.tsx:3679-3688). With `padding: 0` there is literally no slack: 14sp becomes 18.2sp needing ~25dp, and at 2.0x needs ~38dp of line box that Android then centres and crops in a 40dp field. Meanwhile the connect search input at App.tsx:1537 and the chat search input at App.tsx:1156 DO pass `allowFontScaling={false}` (lines 1542 and 1158), so three visually identical search bars behave three different ways.

**Fix.** Pick one policy. Preferred: delete `height: 40` (use `minHeight: 40`), give the input `paddingVertical: 8`, change the wrapper's `height: 42` to `minHeight: 42`, and remove the `allowFontScaling={false}` props at App.tsx:1158 and App.tsx:1542 so all three search fields scale.

### App.tsx:4104
**Issue.** Chat-row avatars are a fixed 40x40 circle containing 16sp/24dp initials, so the initials are cropped once text scales past ~1.6x.

```
chatAvatar: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 179, 71, 0.3)',
    borderRadius: 200,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  chatAvatarText: { color: '#111315', fontSize: 16, fontWeight: '500', lineHeight: 24, textAlign: 'center' },
```

**Impact.** Android at 1.7x-2.0x and iOS Larger Accessibility Sizes. On every row of the Chat list (App.tsx:1274-1277) the two-letter initials need a ~41dp line box at 1.7x and ~48dp at 2.0x inside a 40dp circle, so the letters are sliced top and bottom and, because `width: 40` is also fixed, wide pairs like 'WW' spill past the circle's edge.

**Fix.** Give `chatAvatarText` an `allowFontScaling={false}` (initials are decorative, not content) or size the avatar from fontScale: `const size = 40 * Math.min(fontScale, 1.3)`.

### App.tsx:6113
**Issue.** The feedback dialog's action row has a fixed 40dp height, which caps the Cancel/Send buttons stretched inside it regardless of how large their labels grow.

```
feedbackActions: {
    flexDirection: 'row',
    gap: 8,
    height: 40,
    width: '100%',
  },
```

**Impact.** Android at 1.6x and above. The two buttons at App.tsx:2034-2041 are `flex: 1` children of this row, so they inherit its 40dp cap; `feedbackCancelText` is 14sp/20dp with a 1dp border, which needs ~34dp at 1.6x and ~42dp at 2.0x — the labels 'Cancel' and 'Send' get their descenders cropped and at 2.0x are cut roughly in half. The user cannot tell the two buttons apart.

**Fix.** Replace `height: 40` with `minHeight: 40` and add `paddingVertical: 8` to `feedbackCancelButton` / `feedbackSendButton`.

### App.tsx:5803
**Issue.** Privacy & Security section rows are fixed at 40dp with 14sp/20dp labels and no wrap allowance, so longer section names clip at large font sizes.

```
privacySectionRow: {
    alignItems: 'center',
    borderRadius: 4,
    flexDirection: 'row',
    gap: 8,
    height: 40,
    paddingHorizontal: 16,
    width: '100%',
  },
```

**Impact.** Android at 1.6x-2.0x, worst on 320-360dp phones. The label Text at App.tsx:1863-1865 has no `flex`/`flexShrink` and no `numberOfLines`, so at 2.0x a 28sp section name wraps to two lines needing ~80dp inside a fixed 40dp row — the second line is invisible and the icon is pushed out of the row. The active row's orange background also stays 40dp while the text overflows it.

**Fix.** `minHeight: 40` + `paddingVertical: 10`, and add `flex: 1` to `privacySectionText` so it wraps inside the row rather than overflowing it.

### App.tsx:6243
**Issue.** Lock-app option rows are fixed at 36dp and their text is 10sp — already below the readable floor and unable to grow.

```
lockOptionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 36,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    width: '100%',
  },
  lockOptionText: { color: '#111315', fontSize: 10, fontWeight: '400', lineHeight: 14 },
```

**Impact.** Android at 1.8x-2.0x. The lock-delay options rendered at App.tsx:2116-2130 ('Immediately', 'After 1 minute', …) need a ~28dp line box at 2.0x; that fits 36dp only if the label stays on one line, and on a 320dp phone at 2.0x it does not — it wraps and the second line is cut. At default scale the 10sp label is already too small to read comfortably.

**Fix.** Raise `fontSize` to 14, replace `height: 36` with `minHeight: 36` + `paddingVertical: 8`, and give `lockOptionText` `flex: 1`.

### src/devices/DeviceManagement.tsx:568
**Issue.** Group-picker dropdown rows are fixed at 42dp while their label is `flex: 1` with no `numberOfLines`, so a scaled or long group name wraps and is clipped.

```
dropdownItem: {
    height: 42,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(26,29,33,0.06)',
  },
  dropdownItemText: { flex: 1, fontSize: 14, color: '#111315' },
```

**Impact.** Android at 1.5x and above, and any device with long group names. `flex: 1` guarantees the text wraps rather than truncating; two lines of 21sp text need ~58dp inside a 42dp row, so the second line is invisible and rows visually collide with the row separators. Users cannot read which group they are picking when assigning a device.

**Fix.** Change `height: 42` to `minHeight: 42` and add `paddingVertical: 10`; the enclosing `dropdownScroll { maxHeight: 216 }` (line 567) should likewise become `maxHeight: 216 * Math.min(fontScale, 2)` so at least four options stay visible.

### src/devices/DeviceManagement.tsx:507
**Issue.** The device context-menu rows are fixed at 48dp with 14sp labels that can wrap.

```
menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    height: 48,
  },
  menuLabel: { fontSize: 14, color: '#111315' },
```

**Impact.** Android at 1.8x-2.0x on 320-360dp phones. Menu entries such as 'Remove from group' at 28sp exceed the row width, wrap to two lines needing ~76dp, and get clipped inside the 48dp row — the destructive/red entries (`menuLabelDanger`, line 515) in particular become unreadable, which is a mis-tap hazard.

**Fix.** Change `height: 48` to `minHeight: 48` and add `paddingVertical: 12`.

### src/devices/DeviceManagement.tsx:537
**Issue.** The add/rename-device text field is fixed at 44dp with 14sp text and no vertical padding allowance, and no `allowFontScaling={false}`.

```
input: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(17,19,21,0.15)',
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#111315',
  },
```

**Impact.** Android at 1.8x-2.0x. 14sp becomes 28sp needing a ~38dp line box; add 2dp of border and Android's own input padding and the typed device/group name is cropped inside the 44dp field, so the user cannot verify what they entered before saving.

**Fix.** `minHeight: 44` plus `paddingVertical: 10`.

### src/meetings/MeetingRoom.tsx:2232
**Issue.** The meeting invite buttons are fixed at 44dp, and one of the three labels has no `numberOfLines`, so it wraps and clips at large font sizes.

```
inviteButton: {
    alignItems: 'center',
    borderColor: 'rgba(26,29,33,0.2)',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    height: 44,
    paddingHorizontal: 12,
  },
  inviteButtonText: { color: '#111315', flexShrink: 1, fontSize: 14, fontWeight: '500' },
```

**Impact.** Android at 1.5x and above, worst on 320-360dp phones. In the People panel (MeetingRoom.tsx:1287-1298) 'Copy meeting link' at line 1297 carries no `numberOfLines`, so `flexShrink: 1` makes it wrap instead of ellipsize: two lines of 21sp text need ~58dp inside the 44dp button and the second line is cut. 'Copy meeting code (XXX-XXX-XXX)' at line 1293 does set `numberOfLines={1}` and instead truncates to 'Copy meet…', hiding the code the user is trying to read.

**Fix.** Change `height: 44` to `minHeight: 44` with `paddingVertical: 10`, and change the code label's `numberOfLines={1}` to `numberOfLines={2}` so the meeting code stays visible.

### src/meetings/MeetingRoom.tsx:2147
**Issue.** The email-invite field is fixed at 44dp with 14sp text and no font-scaling opt-out, while the sibling chat input in the same file DOES opt out — inconsistent handling inside one screen.

```
emailInput: {
    color: '#111315',
    flex: 1,
    fontSize: 14,
    height: 44,
    paddingHorizontal: 12,
  },
```

**Impact.** Android at 1.8x-2.0x. The invite email field (MeetingRoom.tsx:1300-1309) crops the typed address inside its 44dp box and its `emailRow` wrapper sets `overflow: 'hidden'` (line 2160), so nothing spills into view — the user cannot confirm the address before sending. The meeting chat input 100 lines earlier passes `allowFontScaling={false}` (MeetingRoom.tsx:1204) and therefore behaves completely differently.

**Fix.** `minHeight: 44` + `paddingVertical: 10` on `emailInput`, and remove the `allowFontScaling={false}` at line 1204 after giving `chatInput` (line 2075) the same `minHeight` treatment.

### src/remote/RemoteControl.tsx:1555
**Issue.** The in-session chat unread badge is a fixed 16dp circle holding 9sp text — the smallest type in the app inside the tightest box.

```
unreadBadge: {
    position: 'absolute',
    left: 4,
    top: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    ...
  },
  unreadBadgeText: { fontSize: 9, fontWeight: '700', color: '#FFFFFF' },
```

**Impact.** Android at 1.4x and above. The badge on the collapsed chat tab (RemoteControl.tsx:1310-1312) needs ~17dp of line box at 1.4x and ~24dp at 2.0x inside a 16dp circle, so the '9+' digits are cropped to unreadable stubs during an active remote session. At default scale 9sp is already well under the 12sp floor.

**Fix.** Raise `fontSize` to 11, replace `height: 16` with `minHeight: 16` and `paddingVertical: 1`, and use `borderRadius: 999`.

### src/remote/RemoteControl.tsx:1659
**Issue.** The in-session chat composer input is fixed at 36dp with 13sp text — the tightest text input in the app.

```
chatInput: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(26,29,33,0.25)',
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#111315',
  },
```

**Impact.** Android at 1.4x and above. 13sp becomes 18.2sp at 1.4x (needing ~25dp) and 26sp at 2.0x (needing ~35dp) inside a 36dp box that also carries a 1dp border top and bottom — the caret and the typed text are cropped while the user is trying to message the person at the remote machine. The panel around it (`chatPanel { height: 400 }`, line 1613) is also a fixed dp box, so nothing above it gives way.

**Fix.** `minHeight: 36` + `paddingVertical: 8`, and change `chatPanel`'s `height: 400` to `maxHeight: '60%'`.

### src/chat/ChatEmpty.tsx:87
**Issue.** The empty-chat screen combines a fixed 200dp illustration with a fixed-offset absolutely-positioned wrapper, so scaled body text pushes the primary button off the bottom of the clamped area.

```
illustration: {
    height: 200,
    width: 190,
  },
  ...
  button: { alignItems: 'center', borderRadius: 4, height: 40, justifyContent: 'center', overflow: 'hidden', width: '100%' },
```

**Impact.** Short phones (≤640dp tall, e.g. Galaxy A03/A13, iPhone SE) at 1.5x and above. The wrapper is absolute with `top: insets.top + 60`, `bottom: 0` and `paddingBottom: 120` (lines 28, 69), so the usable box is ~436dp on a 640dp phone. `inner` has `flexShrink: 1` but the Image has an explicit height and does not shrink, and the title (24sp/34dp) plus the subtitle (14sp/20dp, wrapping to 4+ lines) grow past it — the 'Start Chatting' CTA at line 39 with its fixed `height: 40` is pushed below `bottom: 0` and becomes untappable. The `overflow: 'hidden'` on the button also crops its own label.

**Fix.** Size the illustration from the existing `illustrationHeight` helper (src/lib/responsive.ts:15, already used for two illustrations in App.tsx), give the button `minHeight: 40` + `paddingVertical: 10`, and wrap `inner` in a ScrollView.

### App.tsx:6616
**Issue.** The device-password modal's action row is a non-shrinking flex row of intrinsically-sized buttons, so at large font scale Cancel/Connect overflow the card and are clipped by ResponsivePanel's overflow:hidden. This is the real font-scaling break in the modal the auditor flagged for its (roomy) input.

```
passwordActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },  // App.tsx:6616 — children passwordCancel (paddingHorizontal 16) and passwordConnect (paddingHorizontal 20) carry no flex/flexShrink, text is 14sp (App.tsx:6618, 6625), inside passwordCard { width: '86%', maxWidth: 380, padding: 20 } (App.tsx:6596-6603) which ResponsivePanel wraps with { flexShrink: 1, maxHeight, overflow: 'hidden' } (src/components/ResponsivePanel.tsx:17)
```

**Impact.** On a 360dp phone the card's interior is ~270dp. 'Cancel' + 'Connecting…' with their padding need ~271dp at 1.5x and ~334dp at 2.0x, so from Android's 1.5x accessibility step upward the row overflows; because RN defaults flexShrink to 0 and justifyContent is flex-end, the overflow goes off the LEFT edge and ResponsivePanel's overflow:'hidden' clips it — the Cancel button is partly or wholly invisible/untappable while the user is being asked for the password that gates the whole remote-control flow. On a 320dp phone (235dp interior) it breaks from ~1.3x, the ordinary 'Largest' setting.

**Fix.** Give the row wrap/shrink behaviour instead of a fixed line: add flexWrap:'wrap' + rowGap to passwordActions and flexShrink:1 to passwordCancel/passwordConnect, or stack the buttons vertically when scaled — src/lib/responsive.ts already computes a `stackActions` flag (safeWidth < 360 || fontScale > 1.3) for exactly this and nothing consumes it.

### src/remote/RemoteControl.tsx:140
**Issue.** sheetStyles.sheet maxHeight:520 (RemoteControl.tsx:140) and the inner ScrollView maxHeight:440 (line 1440) exceed a phone's landscape viewport height (411dp on a 411x869 device, 360dp on a 360x800). Bottom-anchored in an absoluteFill overlay with flexShrink 0, the ~465dp Actions sheet has its grabber and first row laid out above y=0 and they cannot be scrolled back. Fix: cap both with the live window height as the chat panel already does at line 1327.

```
sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 8,
    maxHeight: 520,
  },
... overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', zIndex: 150 }
... line 1440:              <ScrollView style={{ maxHeight: 440 }}>
```

**Impact.** This screen deliberately leaves portrait: line 322 calls `ScreenOrientation?.unlockAsync?.()` on mount and line 337 calls `lockAsync(OrientationLock.LANDSCAPE)`. In landscape a 411x869dp phone has a 411dp-tall viewport and a 360x800dp phone has 360dp. The Actions sheet has 10 rows (lines 1135-1153), each 12+12 padding + ~19dp label = ~43dp, so the ScrollView measures ~430dp (under its 440 cap, so it does not shrink), and the sheet totals ~16 (grabber) + 430 + 8 + bottom inset = ~470dp. With `justifyContent: 'flex-end'` in an absoluteFill overlay, Yoga positions the sheet's bottom at the container bottom and its top at 411-470 = -59dp: the grabber and the first row ('Chat with remote user') sit above the screen. Scrolling does not help because the ScrollView's own 430dp viewport is what is hanging off the top.

**Fix.** Replace both constants with runtime values: `const { height } = useWindowDimensions()` and use `maxHeight: Math.min(520, height - insets.top - 24)` on the sheet, and `maxHeight: Math.min(440, height - insets.top - insets.bottom - 60)` on the ScrollView — or reuse `modalMaxHeight` from src/lib/useResponsive.ts, which already computes exactly this.

### src/meetings/MeetingHome.tsx:75
**Issue.** MeetingHome scales every dimension - font sizes, line heights and hit targets - by k = min(1, width/360) (line 75) and then disables OS font scaling on 15 Text/TextInput nodes, so text shrinks below the design size on <=360dp phones (12.4sp body at 320dp, ~10.8sp at 277dp), never grows on tablets, and the accessibility font setting is ignored on this tab alone. The copy/share buttons are 32dp at k=1 and 28.4dp at 320dp - under Android's 48dp minimum in all cases.

```
const FIGMA_WIDTH = 360;
...
  const k = Math.min(1, width / FIGMA_WIDTH);
  const styles = useMemo(() => makeStyles(k), [k]);
...
  const s = (value: number) => Math.round(value * k * 100) / 100;
...
    bodyText: { color: '#000000', fontSize: s(14), fontWeight: '400', lineHeight: s(20) },
    copyButton: { alignItems: 'center', height: s(32), justifyContent: 'center', width: s(32) },
...
<Text allowFontScaling={false} style={styles.bodyText}>Create an instant meeting</Text>
```

**Impact.** On a 320dp phone k = 0.889: body text 14sp becomes 12.4dp, meetingCode 12 becomes 10.7dp, sectionTitle 18 becomes 16, and the copy/refresh buttons (line 357, 499) drop from 32 to 28.4dp — already under Android's 48dp minimum touch target and now 40% under it. On a 360dp phone with Display size = Largest the window reports ~277dp, k = 0.77: body text renders at 10.8dp and the copy button at 24.6dp. Because `Math.min(1, ...)` caps at 1, nothing ever grows on tablets. Worse, the 15 `allowFontScaling={false}` props (lines 212-298) mean a user who has set the system font to Large or Largest sees every other screen in the app grow while Meetings stays microscopic — the exact inconsistency that reads as 'not responsive'.

**Fix.** Delete the `k`/`s()` scaling entirely and use fixed dp for spacing plus unscaled sp for type, exactly as src/settings/SettingsScaffold.tsx does. If a small-screen tier is wanted, use the discrete tiers already in src/lib/responsive.ts (`gutter`, `compact`) rather than a continuous ratio, and remove every `allowFontScaling={false}`; give buttons `minHeight: 44` / `minWidth: 44` instead of `height: s(32)`.

### src/chat/ChatThread.tsx:1277
**Issue.** The chat contact bar is a `space-between` row whose left group has no `flex`/`minWidth: 0` and whose name Text has no `flexShrink`/`numberOfLines`, so a long conversation name pushes the search and overflow buttons off the right edge.

```
contactBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  contactInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
...
  contactName: { fontSize: 15, fontWeight: '600', color: '#111315' },
```

**Impact.** The row (JSX at lines 542-566) holds a 44dp avatar + 12dp gap + the name/status block on the left, and the search + more-vertical buttons on the right; `contactActions` is `{ flexDirection:'row', alignItems:'center', gap:4 }` with no flexShrink either. RN's default flexShrink is 0, so with a long group name ('Engineering Support — EMEA Tier 2') on a 320-360dp phone the left block consumes the full content width and the two action buttons are laid out past the right edge, unreachable — the user cannot open search or the block/mute menu. At larger OS font sizes this happens with much shorter names. The same file's own message rows do it correctly, and src/settings/SettingsScaffold.tsx:263-268 solves it with `flex: 1 / minWidth: 0 / flexShrink: 1`.

**Fix.** Add `flex: 1, minWidth: 0` to `contactInfo`, wrap the name/status Pressable in a `{ flex: 1, minWidth: 0 }` View, add `numberOfLines={1}` to `contactName` and `contactStatus`, and add `flexShrink: 0` to `contactActions`.

### src/chat/ChatThread.tsx:669
**Issue.** The message list is an unvirtualized ScrollView + .map, so up to 150 MessageBubble subtrees (each with an Animated.Value, a PanResponder, a Date parse and an Intl format) mount in one commit on open and none are ever recycled or clipped while scrolling.

```
654: <ScrollView
655:   ref={scrollRef}
656:   style={styles.messageList}
...
669:   rendered.map((message) => (
670:     <MessageBubble
671:       key={message.id}
```

**Impact.** Any phone, but visibly on mid/low-end (Snapdragon 4xx / 2-4GB RAM). Opening a thread with a few hundred messages mounts a few hundred MessageBubble subtrees — each with an Animated.Value, a PanResponder, a Date parse and an Intl call — in one synchronous commit. The screen stays on the spinner and then hangs for seconds before the first paint, and scrolling the thread drops frames because nothing is ever recycled or clipped.

**Fix.** Replace the ScrollView + map with an inverted `FlatList` over `rendered`: `<FlatList data={rendered} inverted keyExtractor={(m) => m.id} renderItem={renderMessage} initialNumToRender={15} maxToRenderPerBatch={10} windowSize={7} removeClippedSubviews />`. Keep the existing scroll-to-bottom behaviour by using `inverted` plus a reversed copy of `rendered` rather than an imperative scrollRef.

### src/chat/ChatThread.tsx:1050
**Issue.** Every keystroke in the composer re-renders all ~150 unmemoized MessageBubbles, each of which re-runs a regex parse, an Intl time format and a fresh PanResponder.create — the composer visibly lags the keyboard in a long thread.

```
1013: function MessageBubble({          // plain function, no React.memo
1050:   const panResponder = useMemo(
1051:     () =>
1052:       PanResponder.create({
...
1074:     [swipeable, onSwipeReply, translateX],

(parent, ChatThread.tsx:674) onSwipeReply={() => setReplyTarget(message)}
```

**Impact.** Mid/low-end phones typing in a thread. `handleInputChange` (ChatThread.tsx:466) calls `setInput` on every character, re-rendering ChatThread, which re-renders all N MessageBubbles, which each allocate a new PanResponder plus re-run `parseSessionInvite` and `new Date(...).toLocaleTimeString()`. On a 200-message thread that is 200 PanResponder allocations and 200 Intl calls per keypress — the composer visibly lags behind the keyboard.

**Fix.** Wrap the component as `const MessageBubble = React.memo(function MessageBubble({...}) {...})`, and in the parent hoist the per-row callbacks so their identity is stable — pass the message id and use `useCallback` handlers (`onSwipeReply={handleSwipeReply}` with `const handleSwipeReply = useCallback((m) => setReplyTarget(m), [])`), or pass `message` back out of the row. Also memoize `time` with `useMemo(() => new Date(message.createdAt).toLocaleTimeString(...), [message.createdAt])`.

### App.tsx:1026
**Issue.** visibleDevices renders into a plain ScrollView with no virtualization; a ~100-device group mounts on the order of 1,000 native views in a single commit, and each character typed into the search box re-runs three .filter() passes plus a full reconciliation of every row.

```
983:  <ScrollView contentContainerStyle={styles.managedContent} showsVerticalScrollIndicator={false}>
...
1026:   {visibleDevices.map((device) => (

(and in the same render body, App.tsx:945-953)
945:  const onlineCount = devices.filter((device) => device.isOnline).length;
946:  const inSessionCount = devices.filter((device) => device.inSession).length;
947:  const visibleDevices = devices
948:    .filter(...)
952:    .filter((device) => (q ? `${device.name} ${device.accessKey}`.toLowerCase().includes(q) : true));
```

**Impact.** Mid/low-end phones on real fleets — this repo's own preprod carries 99+ devices. Each row mounts a Pressable, two Feather glyphs and a react-native-svg `ConnectSvgIcon` (App.tsx:372), so a 100-device group mounts roughly 600 native views in one commit: opening "All devices" stalls for a beat, the list scrolls with visible frame drops, and typing in the device search box re-runs three `.filter()` passes plus a full 100-row reconciliation per character.

**Fix.** Swap the ScrollView + map for `<FlatList data={visibleDevices} keyExtractor={(d) => d.id} renderItem={renderDeviceRow} getItemLayout={(_, i) => ({ length: ROW_H, offset: ROW_H * i, index: i })} initialNumToRender={12} removeClippedSubviews />`, move the filters/search chrome into `ListHeaderComponent`, wrap `onlineCount` / `inSessionCount` / `visibleDevices` in `useMemo` keyed on `[devices, statusFilter, q]`, and extract the row into a `React.memo` component.

### App.tsx:2435
**Issue.** AppContent (App.tsx:2435-~3379) holds 27 useState hooks and App.tsx contains zero useMemo, useCallback or React.memo, so any chat toast, typing push (≤1 per 2.5s per peer), account-sync refetch or foreground refresh re-renders the entire active screen and every unmemoized row in it.

```
2435: function AppContent() {
2437:   const [showSplash, setShowSplash] = useState(true);
...  (27 useState hooks through line 2486)
3009:   return (

(grep over App.tsx: useMemo 0, useCallback 0, React.memo 0; grep over App.tsx + all of src/: React.memo 0)
```

**Impact.** Mid/low-end phones during any active session. `onTyping` (App.tsx:3002) fires `setTypingConversations` for every keystroke the other party types, `onMessage` fires two setStates plus a toast, `patchDeviceByKey` fires on presence flips, and a 30s poll fires `refreshDevices` — each one re-renders AppContent and, with no memoized children anywhere, re-renders the entire active screen and every row in it. The symptom is a UI that intermittently stops responding to taps for a few hundred ms while someone else is typing or while devices come online.

**Fix.** Split state by concern and stop the cascade: (1) move `conversations` / `typingConversations` / `chatToast` into a small context or store so only the chat surfaces subscribe; (2) wrap `ConnectScreen`, `DevicesScreen`, `ChatScreen`, `MeetingScreen`, `ManagedDevicesScreen`, `MonitoringOverviewScreen`, `BottomNav` and every `*Row` in `React.memo`; (3) wrap the callbacks passed to them (`goToTab`, `openSettings`, `openManagedDevices`, `startRemoteControl`, …) in `useCallback` so the memo actually holds. Enabling the React Compiler (see the app.json finding) would do most of (2) and (3) automatically.

### android/app/build.gradle:76
**Issue.** R8/minification and resource shrinking are disabled for release builds — the gating Gradle property is never set anywhere in the project.

```
76: def enableMinifyInReleaseBuilds = (findProperty('android.enableMinifyInReleaseBuilds') ?: false).toBoolean()
...
144:             def enableShrinkResources = findProperty('android.enableShrinkResourcesInReleaseBuilds') ?: 'false'
145:             shrinkResources enableShrinkResources.toBoolean()
146:             minifyEnabled enableMinifyInReleaseBuilds

(neither `android.enableMinifyInReleaseBuilds` nor `android.enableShrinkResourcesInReleaseBuilds` appears anywhere in android/gradle.properties or any .gradle file)
```

**Impact.** Low-end and low-storage Android devices. Every Java/Kotlin class from react-native-webrtc, Expo modules, Fresco and the notification stack ships unshrunk and unoptimised, and no unused resources are stripped. That means a larger APK, more classes to load and verify at cold start, and a measurably slower first launch on entry-level hardware — the exact devices the user is complaining about.

**Fix.** Add `android.enableMinifyInReleaseBuilds=true` and `android.enableShrinkResourcesInReleaseBuilds=true` to android/gradle.properties. The existing android/app/proguard-rules.pro already carries the required `-keep` rules for TurboModules; add keeps for `org.webrtc.**` and any Expo module using reflection, then smoke-test a release build before shipping.

### src/connect/ConnectHome.tsx:7
**Issue.** The bundled PNG illustrations are 1.5-3.1 megapixel sources rendered into boxes capped at 240dp, with no @2x/@3x variants and no downscaled asset, so Android decodes multi-megabyte bitmaps for thumbnail-sized artwork on the app's first screen.

```
src/connect/ConnectHome.tsx:7  const heroImage = require('../../assets/recent.png');
src/connect/ConnectHome.tsx:119   <Image source={heroImage} resizeMode="contain" style={styles.heroImage} />
src/connect/ConnectHome.tsx:264-267  heroImage: { height: '100%', width: '100%' }
src/lib/responsive.ts:15  illustrationHeight: Math.max(80, Math.min(240, contentWidth * 0.65, safeHeight * 0.3)),

Actual asset headers (read from the PNG IHDR chunks):
  recent.png    1394x1128  703 KB  -> ~6.0 MB decoded ARGB   (ConnectHome hero, first screen)
  wait.png      1920x1633  179 KB  -> ~12.0 MB decoded ARGB  (App.tsx:92 launch screen AND RemoteControl.tsx:45 connecting cover)
  no-device.png 1621x1421  129 KB  -> ~8.8 MB decoded ARGB   (App.tsx:91)
  chat.png      1469x1559  125 KB  -> ~8.7 MB decoded ARGB   (src/chat/ChatEmpty.tsx:7)
  no-sign.png   1254x1254  628 KB  -> ~6.0 MB decoded ARGB   (App.tsx
```

**Impact.** 2 GB-RAM phones and anything below a Snapdragon 6-series. Decoding a 1.5-3.1 MP PNG costs roughly 60-200 ms of CPU on such a device, and it happens on the Connect screen the user lands on first, again on the launch screen, and again inside RemoteControl's connecting cover at the exact moment the WebRTC session is negotiating. Worse, a single-scale asset lands in drawable-mdpi, so on an xxhdpi (3x) phone Android density-scales it UP before drawing, inflating both the decode time and the resident bitmap several times over. Symptom: a visible white gap then a pop-in for the illustration, a slow first frame on Connect, and heap pressure that makes the OS trim the app in the background.

**Fix.** Downscale the sources to what they are actually drawn at — a 240dp box needs roughly 720x720 at 3x — and ship them as recent.png / recent@2x.png / recent@3x.png so RN picks the right density bucket instead of upscaling mdpi. For the two 600 KB+ files (recent.png, no-sign.png) re-export as WebP. Where the source must stay large, add `resizeMethod="resize"` to the Android <Image> so Fresco downsamples during decode instead of after.


## MEDIUM

### App.tsx:1074
**Issue.** The ManagedDevicesScreen empty state (App.tsx:1073-1088) is a non-scrollable flex:1 View that vertically centres a 171dp illustration + copy + button. It fits at default font on a 360x640 phone, but at Android font size >= 150% (or Display size Large + large font) the block overflows the viewport in both directions: the illustration is pushed under the header and the 'Add' button drops below the container into the nav pill, with no scroll to recover it - a first-run user cannot add their first device. Fix: wrap the branch in a ScrollView with contentContainerStyle={{flexGrow:1, justifyContent:'center'}}.

```
App.tsx:1074  <View style={styles.noDeviceContent}>
App.tsx:1075  <Image source={noDeviceImage} style={styles.noDeviceImage} resizeMode="contain" />
App.tsx:3889-3896  noDeviceContent: { alignItems: 'center', flex: 1, gap: 45, justifyContent: 'center', paddingBottom: 150, paddingHorizontal: 16, width: '100%' }
App.tsx:3898-3901  noDeviceImage: { height: 171, maxWidth: '70%', width: 200 }
```

**Impact.** Small/short phones (320x568dp, 360x640dp) and any phone with Android's Display size = Large or Font size >= 130%. Required height is 171 (image) + 45 + title/body (~70dp at 1x, ~110dp at 1.3x) + 45 + 44 (button) + 150 (padding) ≈ 525dp; the space under the header on a 568dp-tall device is ~440dp. `justifyContent: 'center'` then pushes the top of the illustration off-screen and the 'Add' button under the floating nav pill, with no way to scroll to it — the user cannot add their first device.

**Fix.** Wrap it in a ScrollView the same way the populated branch already is: `<ScrollView contentContainerStyle={styles.noDeviceContent} showsVerticalScrollIndicator={false}>`, change `flex: 1` to `flexGrow: 1` in the style, replace the hard `paddingBottom: 150` with `r.navClearance`, and drive the image height from `r.illustrationHeight` in useAppStyles (the pattern already used for `loginGateImage`/`launchImage` at App.tsx:6649, 6651).

### App.tsx:6647
**Issue.** App.tsx:6647 injects responsive layout into 'monitoringContent' and 'devicesListContent', neither of which exists (the real key is monitorContent, App.tsx:4684); .filter(key => key in baseStyles) swallows the typo. Consequences, both visible: (1) Monitoring is the only tab without the maxWidth:720 cap and responsive gutter, so on a tablet or unfolded foldable its device rows stretch edge-to-edge while every other tab stays centred at 720; (2) monitorTabs (App.tsx:4739-4749, width:'100%', no horizontal padding) then sits flush against both screen edges while endpointSummary directly above it is inset by paddingHorizontal:20 (App.tsx:4694-4698) - a visible misalignment on every device. The nav-clearance part of the claim is false.

```
App.tsx:6647 ...Object.fromEntries(['devicesContent','managedContent','monitoringContent','chatListContent','appsContent','devicesListContent'].filter(key => key in baseStyles).map(...))
(the real style is `monitorContent`, App.tsx:4684; grep for 'monitoringContent' and 'devicesListContent' across App.tsx matches only line 6647)
```

**Impact.** MonitoringOverviewScreen on every device. It falls back to `monitorList`'s hard-coded `paddingBottom: 140` (App.tsx:4786) instead of `navClearance` (= navHeight + 32 + insets.bottom, i.e. 152dp at font scale 1 on a 48dp-inset handset, more at larger font scale) — combined with the double-inset defect above, the last device row in the list is covered by the floating nav pill and cannot be scrolled clear. On a tablet/unfolded foldable the monitoring rows also stretch edge-to-edge because the maxWidth 720 cap never lands.

**Fix.** Rename the keys to the ones that exist ('monitorContent', and either delete 'devicesListContent' or point it at the real style), or better, replace the string list with a check that throws in __DEV__ when a key is missing. Then drop the hard-coded 140 in `monitorList` (App.tsx:4786) and let the injected `navClearance` apply.

### App.tsx:766
**Issue.** styles.monitorTitle (App.tsx:4673-4678) has no flexShrink and its Text at App.tsx:766 has no numberOfLines, and the containing Pressable row monitorHeaderTitle (4668-4672) has neither flex nor minWidth - so in the space-between headerFrame row nothing can shrink. On a 320dp phone at font size >= 115%, or a 360dp phone at >= 140%, 'Monitoring Overview' overflows and pushes monitorActions past the right edge, clipping the help and settings buttons off-screen and making them untappable. Fix: mirror managedTitle - add flexShrink:1 to monitorTitle, numberOfLines={1} to the Text, and flexShrink:1/minWidth:0 to monitorHeaderTitle.

```
App.tsx:763-767  <HeaderFrame style={styles.monitorHeader}> ... <Text style={styles.monitorTitle}>Monitoring Overview</Text>
App.tsx:4668-4678  monitorHeaderTitle: { alignItems: 'center', flexDirection: 'row', gap: 12 }, monitorTitle: { color: '#111315', fontSize: 16, fontWeight: '600', lineHeight: 23 }
(compare App.tsx:3801-3807 managedTitle: { ... flexShrink: 1 } used with numberOfLines={1} at App.tsx:963)
```

**Impact.** 320-360dp phones, and any phone at Android font size >= 130%. 'Monitoring Overview' at 16sp is ~165dp, at 1.3x ~215dp; plus the 20dp back arrow, 12dp gap and 32dp of header padding that is 279dp at 1x / 329dp at 1.3x, leaving under 41dp for the two 28dp icon buttons and their 18dp gap (74dp needed). The help and settings buttons are pushed off the right edge and become untappable on a 360dp device at large font, and are clipped even at default font on a 320dp device.

**Fix.** Add `flex: 1, minWidth: 0` to `monitorHeaderTitle` (App.tsx:4668), `flexShrink: 1` to `monitorTitle` (App.tsx:4673) and `numberOfLines={1}` to the Text at App.tsx:766 — exactly what `managedHeaderTitle`/`managedTitle` already do. The same missing `flexShrink` exists on `chatTitle` (3953), `meetingTitle` (4337) and `appsTitle` (4522); those labels are short today but will break the moment they are localised.

### App.tsx:1568
**Issue.** NoConnectScreen autofocuses its text field but has no KeyboardAvoidingView — the Cancel/Connect action row is an ordinary flex child at the bottom of the SafeAreaView, so it relies entirely on the window resizing under the keyboard.

```
App.tsx:1539  autoFocus
App.tsx:1568  <View style={[styles.noConnectButtons, { paddingBottom: insets.bottom + 12 }]}>
(KeyboardAvoidingView is imported at App.tsx:18 and used on the auth screens at 1996 and 3322, but not here)
```

**Impact.** iOS (all sizes): the keyboard is up the instant the screen opens because of `autoFocus`, and since iOS never resizes the window the 'Connect' primary button is covered by the keyboard — the user must dismiss the keyboard to submit (the `returnKeyType="go"` / `onSubmitEditing` path is the only way through). On Android it works only because AndroidManifest.xml:30 declares `windowSoftInputMode="adjustResize"`; on a short screen (568dp) after the resize, the scrollable body between header and buttons collapses to almost nothing and the 'No connection selected' copy is not reachable.

**Fix.** Wrap the ScrollView + button row in `<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>` as done at App.tsx:1996, or move the action row into the ScrollView's content container with `flexGrow: 1` and `justifyContent: 'flex-end'`.

### App.tsx:1158
**Issue.** Text and inputs opt out of the OS font-size setting with `allowFontScaling={false}` instead of letting their fixed-height containers grow.

```
App.tsx:1158  allowFontScaling={false}   (chat 'Search for contact' TextInput)
App.tsx:1542  allowFontScaling={false}   (support-ID TextInput on NoConnectScreen)
App.tsx:498   <Text allowFontScaling={false} style={styles.splashTitle}>Remote 365</Text>
App.tsx:503   <Text allowFontScaling={false} style={styles.tagline}>Secure Node Mesh</Text>
```

**Impact.** Users on Android font size 130-200% or iOS Larger Text: the chat search field and the support-ID entry field stay at 14sp / 8-10sp while the rest of the app scales, so on a device set to 200% these are the only unreadable elements on screen — and the support-ID field is the primary entry point for starting a session. The likely reason is that both fields live in hard-capped 40dp boxes (`searchField` App.tsx:3494-3502, `chatSearchBox` App.tsx:3984) that would clip if the text scaled.

**Fix.** Remove `allowFontScaling={false}` and make the containers elastic instead: swap `height: 40` for `minHeight: 40` on `searchField` (3501), `searchInput` (3508) and `chatSearchBox`, and let the TextInput size itself. Keep the opt-out only where a fixed glyph metric genuinely matters.

### src/connect/ConnectHome.tsx:274
**Issue.** The first screen's primary controls use fixed heights around text that scales with the OS font setting

```
ConnectHome.tsx:268-279  outlineButton: { alignItems:'center', borderColor:BORDER, borderRadius:4, borderWidth:1, flexDirection:'row', height: 40, justifyContent:'space-between', paddingHorizontal:16, width:'100%' }
ConnectHome.tsx:296-302  recentHeader: { alignItems:'center', flexDirection:'row', height: 38, justifyContent:'space-between', paddingHorizontal:16 }
both hold outlineButtonText (ConnectHome.tsx:280-285, fontSize:14 / lineHeight:20) with allowFontScaling left at its default
```

**Impact.** Any phone at Android font size >= 150% or iOS Larger Text, on the Connect tab - the app's landing screen (rendered from App.tsx:556). RN scales both fontSize and lineHeight, so at 2.0x the 'Search and connect' and 'Recent connections' labels need ~40dp of line box inside 40dp and 38dp boxes with no room for the 1dp border: the text is vertically clipped and the 20dp/16dp icons beside it are squeezed. It is the same class of bug the rest of the app already fixed with explanatory comments (App.tsx:3717-3723 quickRowTall 'a fixed 41px clipped the second line', App.tsx:3759-3764, 3823-3831).

**Fix.** Change height:40 -> minHeight:40 and height:38 -> minHeight:38, adding paddingVertical:8 so the row grows with the label.

### App.tsx:1660
**Issue.** The launch screen footer is absolutely positioned at bottom:16 with no safe-area inset, so it renders underneath the Android navigation bar / iOS home indicator

```
App.tsx:1660  <View style={styles.signInFooter}>
App.tsx:5402-5406  signInFooter: { alignItems: 'center', bottom: 16, position: 'absolute' },
(same defect in upgradeFooter, App.tsx:5718-5724: { alignSelf:'center', bottom:16, position:'absolute', width:226 }, used at App.tsx:1812)
```

**Impact.** Every device that reports a bottom inset. Because Yoga positions an absolute child with an explicit inset from the containing block's padding box (react-native/ReactCommon/yoga/yoga/algorithm/AbsoluteLayout.cpp:202-211 subtracts border and margin but NOT the parent's padding), the SafeAreaView's paddingBottom does not push this child up: bottom:16 is 16dp from the physical screen edge. On gesture navigation (24dp inset) the 'Copyright 2026 (c) Remote 365' line sits inside the gesture bar; on 3-button navigation (48dp) both the 'Privacy Policy' link and the copyright line are drawn behind the system bar, and the Privacy Policy tap is swallowed by the system. Every other absolutely-positioned element in the file gets this right (navWrap uses bottom: 12 + insets.bottom at App.tsx:2383, connectToast uses top: r.insets.top + 12 at App.tsx:6653).

**Fix.** Make it inset-aware like navWrap: style={[styles.signInFooter, { bottom: 16 + insets.bottom, left: 0, right: 0 }]} (it also has no left/right, so its horizontal placement falls back to the parent's static alignment). Same change for upgradeFooter.

### App.tsx:1655
**Issue.** LaunchingScreen's only call-to-action is a fixed 40dp-high, 61%-wide button whose label has no numberOfLines and no minHeight, so it wraps out of the button at raised font scales

```
1655 `<Pressable style={styles.launchButton} onPress={onContinue}>` / 1656 `<Text style={styles.signInButtonText}>Open Remote 365</Text>`; `launchButton: { alignItems: 'center', backgroundColor: '#FF8A00', borderRadius: 4, height: 40, justifyContent: 'center', maxWidth: 220, width: '61%' }` (5468-5476) and `signInButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '500', lineHeight: 20 }` (5311-5316).
```

**Impact.** This screen IS live (mounted at App.tsx:3044 for the OAuth hand-off). The button resolves to 61% of the content box — ~161dp on a 320dp phone, ~185dp on a 360dp phone, ~212dp on a 412dp phone (capped at 220). 'Open Remote 365' is ~110dp at fontScale 1, so at Android Settings > Display > Font size = Largest (1.3) it is ~143dp and already touching the edge on a 320dp phone, and at Android 14's 200% setting it is ~210-220dp and wraps to two lines inside a box whose height is pinned at 40dp. The second line renders outside the orange pill and the label becomes unreadable — on the one screen whose only action is this button.

**Fix.** Replace `height: 40` with `minHeight: 44` plus `paddingVertical: 10`, drop the percentage width in favour of `alignSelf: 'stretch'` with `maxWidth: 220`, and add `numberOfLines={1}` + `adjustsFontSizeToFit` (or let it wrap into a growing button) to the label.

### App.tsx:1660
**Issue.** LaunchingScreen's absolutely-positioned footer overlaps the CTA because the responsive override replaced the 90dp bottom padding that reserved space for it with 24dp

```
1660 `<View style={styles.signInFooter}>` with `signInFooter: { alignItems: 'center', bottom: 16, position: 'absolute' }` (5402-5406); the flow container reserves room via `launchContent: { … justifyContent: 'center', paddingBottom: 90, paddingTop: 70, flexGrow: 1 }` (5428-5437) but useAppStyles overwrites it at 6650: `launchContent: { ...baseStyles.launchContent, ...content, paddingTop: r.insets.top + 16, paddingBottom: 24 }`.
```

**Impact.** The footer is two lines (`signInFooterMain` 10sp/`signInFooterSub` 8sp, 5407-5420) sitting 16dp off the bottom, so it occupies the bottom ~41dp — but only 24dp is reserved. While the content is short it is centred and there is no contact; as soon as the free space in the container drops below ~34dp the 'Open Remote 365' button slides down into the footer. That happens on a short phone (≤640dp tall, e.g. 720x1280 hardware) at font size Large/Largest, where the image (illustrationHeight up to 240dp), the 24sp title and the 3-4 line body have consumed the height: the copyright line is drawn across the orange button. There is no scroll container in the shipped (HEAD) version, so the user cannot scroll it apart either — which is what the broken working-copy ScrollView edit was evidently trying to fix.

**Fix.** Keep the footer in flow as the last child of the scroll content (or set the container's `paddingBottom` to the footer's measured height + 16 instead of a bare 24) so the CTA and the footer can never occupy the same band.

### App.tsx:3744
**Issue.** deviceGroupTitle (App.tsx:3744) pins height:14 on a Text whose lineHeight:14 is font-scaled, so the 'Managed devices' (664) and 'Groups' (676) captions on the Devices tab lose their descenders at Android font size 'Large' (x1.15) and are cut roughly in half at accessibility x2.0. Fix: delete `height: 14` (minHeight if a box is needed).

```
deviceGroupTitle: {
    color: '#111315',
    fontSize: 10,
    fontWeight: '400',
    height: 14,
    lineHeight: 14,
  },
```

**Impact.** Any Android phone with Settings → Display → Font size above Default (RN multiplies lineHeight by fontScale as well as fontSize, so 14dp becomes 16.1dp at 1.15 and 18.2dp at 1.3 inside a 14dp box). The two section headings on the Devices tab — "Managed devices" (used at line 664) and "Groups" (line 676) — lose their descenders at 'Large' and are cut roughly in half at Accessibility → Font size 2.0, where only the top ~14 of 28dp is painted. Not visible at all at the default font size, which is why it survived.

**Fix.** Delete `height: 14` (the Text sizes itself). If a rhythm baseline is wanted use `minHeight: 14`, and drop the explicit `lineHeight` or raise it to at least 1.35 × fontSize.

### App.tsx:3889
**Issue.** noDeviceContent (3889) is rendered as a plain View (1074) with a fixed 171dp illustration, 45dp gaps and a hardcoded paddingBottom:150, so on 320x568dp phones (and 360dp at fontScale >= 1.3) the centred content overflows its clipped box: the illustration and part of the title ride up behind the (transparent, headerFlat 3467) header and cannot be scrolled into view. Fix: wrap in a ScrollView with contentContainer flexGrow:1, use r.illustrationHeight and r.navClearance instead of 171/150.

```
noDeviceContent: {
    alignItems: 'center',
    flex: 1,
    gap: 45,
    justifyContent: 'center',
    paddingBottom: 150,
    paddingHorizontal: 16,
    width: '100%',
  },
```

**Impact.** 320×568dp phones (small 4.7" devices, and any phone with Android 'Display size: Largest', which shrinks the effective dp width toward 320). Usable box = 568 − 48 bottom inset − 84 header − 150 padding = 286dp, while the content measures ≈ 429dp at the default font size (171 image + 45 + 34 title + 14 + 4×20 body + 45 + 40 button). Centred overflow puts the illustration's top ~60dp under the header and drops the orange "Add" button (3923) to ~138dp above the screen bottom — inside the 108-164dp band occupied by the floating nav pill (see the double-inset finding), which has `zIndex: 50` and therefore swallows the tap. A first-run user with zero devices cannot add one. At fontScale 1.3 the same happens on 360dp phones, and nothing can be scrolled into view.

**Fix.** Wrap the empty state in `<ScrollView contentContainerStyle={[styles.noDeviceContent, { flexGrow: 1 }]}>`, replace `paddingBottom: 150` with `r.navClearance` (the helper already exists and is used for the other five content containers at 6647), and drive `noDeviceImage.height` from `r.illustrationHeight` — which is computed as `min(240, contentWidth*0.65, safeHeight*0.3)` for exactly this purpose but is currently only consumed by `loginGateImage`/`launchImage`.

### App.tsx:3854
**Issue.** managedDeviceName (3877) has no flexShrink inside managedDeviceNameRow (3854), so on 320-412dp phones a long hostname eats the row and the conditional orange 'In session' pill (1046) is pushed off the right edge — the operator cannot see that the machine is already being controlled. Fix: flexShrink:1 + minWidth:0 on the name (and flexShrink:0 on the pill).

```
managedDeviceNameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
```

**Impact.** 320-412dp phones with realistic Windows hostnames. On the Managed Devices list (rendered at 1038-1052), a name like "DESKTOP-4KJ8H2Q-Accounting" fills the row, so the orange "In session" badge (1047) is laid out beyond the row's right edge and is clipped away entirely — the operator cannot tell that someone is already controlling the machine, which is the one piece of state that row exists to surface. Gets worse as fontScale grows because the name claims more width. The same file solves this correctly two blocks away: `chatContactName` uses `flex: 1` (4142) and `chatPreview` uses `flex: 1` (4171).

**Fix.** Add `flex: 1` (or `flexShrink: 1, minWidth: 0`) to `managedDeviceName` and `flexShrink: 0` to `inSessionPill`, so the name ellipsizes and the pill keeps its intrinsic width.

### App.tsx:3777
**Issue.** deviceListLabel (3777) has no flexShrink inside deviceListInner (3769), so on the Devices tab a long group name (rows built at 683-693) consumes the row and the '{n} in session' pill (903-907) is laid out past the right edge and disappears. Fix: flexShrink:1 + minWidth:0 on the label.

```
deviceListLabel: {
    color: '#111315',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
```

**Impact.** Any phone once a device group has a long name — the group rows are built at 897-909 with `<Text style={styles.deviceListLabel} numberOfLines={1}>{label}</Text>` immediately followed by the in-session pill. On a 360dp screen a group named "Jeddah Warehouse Workstations (12)" fills the row, the pill is pushed off the right edge and the in-session count silently disappears from the Devices tab. At fontScale 1.3 even "All devices (24)" starts crowding the pill out.

**Fix.** `deviceListLabel: { ..., flex: 1, minWidth: 0 }` and `flexShrink: 0` on the pill.

### App.tsx:983
**Issue.** Confirmed as written: add keyboardShouldPersistTaps="handled" to the ScrollViews at 629, 983 and 1147 (1552 already has it).

```
<ScrollView contentContainerStyle={styles.managedContent} showsVerticalScrollIndicator={false}>
```

**Impact.** All phones, but worst on small ones where the keyboard covers 45-55% of the screen. With the keyboard raised (opened automatically by the `autoFocus` at line 989), the first tap on any device row is consumed by RN's default `keyboardShouldPersistTaps="never"` to dismiss the keyboard, so connecting to a device takes two taps and reads as an unresponsive list. Same omission at 629 (Devices groups, search opened by the header magnifier) and 1147 (Chat, search box always visible). Line 1552 in this same file gets it right.

**Fix.** Add `keyboardShouldPersistTaps="handled"` to the ScrollViews at 629, 983 and 1147.

### App.tsx:4060
**Issue.** `chatSmallAdd` is an 18×18dp tap target used as the "add contact" button, with no `hitSlop`.

```
chatSmallAdd: {
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
```

**Impact.** All phones, disproportionately high-density and small ones and anyone using Android's larger Display size (which does not enlarge fixed dp boxes but does enlarge the finger's relative footprint). 18dp is 37% of Android's 48dp minimum touch target and 41% of iOS's 44pt; the button at line 1187 (`<Pressable style={styles.chatSmallAdd} onPress={onAddContact}>`) is the only way to start a new conversation from the chat list, and it sits 8dp from the 24×24dp filter button (4054), so mis-taps land on the wrong control. Sibling `chatToolButton` (24×24) and `iconButton` (28×28) share the problem.

**Fix.** Keep the 18dp visual and add `hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}` (the file already uses hitSlop correctly at 1160, 1194 and 2396), or grow the pressable to 44dp with a nested 18dp circle.

### App.tsx:3637
**Issue.** `iconButton` gives every header action a 28×28dp hit area, and none of its 11 call sites in this slice add `hitSlop`.

```
iconButton: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
```

**Impact.** All phones; the failure mode is systematic because this style backs Settings (520, 620, 772, 972, 1137, 1391, 1445, 1614), Search (617, 966), Refresh (969) and Help (614, 769). 28dp is well under the 48dp Android guideline, and on Managed Devices three of them sit in a row 18dp apart (`managedActions` gap, 3811), so on a 320dp screen a thumb tap regularly hits Refresh instead of Settings. `noConnectBack` (3488) shows the intended pattern — it is 24×32 but carries `hitSlop={8}` at line 1526.

**Fix.** Add `hitSlop={10}` at every `styles.iconButton` Pressable, or bake a 44dp pressable around the 28dp visual box.

### App.tsx:4184
**Issue.** `chatUnreadBadge` pins `height: 18` around text whose `lineHeight` is 14 (4197) and which scales with the OS font setting, so the digits are clipped as soon as fontScale passes ~1.29.

```
chatUnreadBadge: {
    alignItems: 'center',
    backgroundColor: '#27AE60',
    borderRadius: 91,
    height: 18,
    justifyContent: 'center',
    minWidth: 18,
    paddingHorizontal: 5,
  },
```

**Impact.** Any Android phone at Display → Font size 'Largest' (1.30) or Accessibility → Font size above it: the scaled line box is 18.2dp then 21dp then 28dp inside an 18dp pill, so the unread count rendered at 1289 (`{unreadCount > 99 ? '99+' : unreadCount}`) loses its top and bottom and '99+' becomes an unreadable green smear. The neighbouring `chatChip`/`chatChipWide` filters (4013/4021, `height: 22`) fail the same way above ~1.57, and `chatAvatar` (4104, 40×40 with `lineHeight: 24` initials at 4116) above ~1.66.

**Fix.** Replace `height` with `minHeight` plus `paddingVertical: 2` on all three, and either drop the fixed `lineHeight` or cap the scale with `maxFontSizeMultiplier={1.3}` on the badge/chip/initial Texts.

### App.tsx:4184
**Issue.** chatUnreadBadge is a fixed 18dp-high box around text whose lineHeight is font-scaled, so the unread count breaks out of / is cropped by its own pill

```
chatUnreadBadge: { ... height: 18, justifyContent: 'center', minWidth: 18, paddingHorizontal: 5 } with chatUnreadText: { fontSize: 10, ... lineHeight: 14 }
```

**Impact.** Any Android phone with Settings > Display > Font size above Default. RN scales lineHeight from SP (14 -> 18.2 at x1.3, 21 at x1.5, 28 at x2.0) while height:18 is a fixed DIP box, so the green circle on the Chat list rows (rendered at 1288-1291) is too short for its own digits: the number spills above and below the pill (or is cropped), and '99+' turns into an unreadable smear. The badge is the only indicator of unread messages on that screen.

**Fix.** Drop `height: 18` and use minHeight: 18 + paddingVertical: 2 (the same pattern inSessionPill at 3865 already uses correctly), or set allowFontScaling={false} on the count.

### App.tsx:6575
**Issue.** On the three screens that pass `action` to BottomNav (701, 1243, 1409), the per-tab slot is (min(W,420) − 96)/5, which drops below the fixed 46dp navRaised circle at any window narrower than ~326dp: 44.8dp at 320dp, 43.4dp at Android 'Display size: Larger' on a 360dp phone (313dp), 36.2dp at 'Largest' (277dp). The orange circle and its 44dp white halo then bleed ~5dp into each neighbouring tab slot, erasing the white notch and crowding the adjacent icons. Independently, navRaised (46) is 2dp wider than navHalo (44) at every size, so the orange circle always touches the grey pill instead of sitting in a white gap.

```
navRaised: {
    width: 46,
    height: 46,
    borderRadius: 23,   // inside navHalo { width: 44, height: 52 } (6570-6571)
```

**Impact.** Per-tab width = (W − 24 navRow padding − 8 gap − 48 navAddFab − 8 pill padding − 8 navPillShrunk gaps)/5. On a 360dp phone with Android 'Display size: Larger' (313dp) that is 43.4dp, and at 'Largest' (277dp) it is 36.2dp — the 46dp orange circle overflows its slot by up to 10dp on each side and visibly overlaps the neighbouring tab icons, and the 44dp white halo overflows the grey pill. Affects the Devices (701), Chat (1243) and Meeting (1409) tabs, which pass `action` and therefore get the shrunk pill. Also note navRaised (46) is already 2dp wider than navHalo (44) at every size, so the orange circle touches the grey pill instead of sitting in a white notch.

**Fix.** Derive these from the measured tab width instead of constants: `const slot = Math.min(46, tabWidth - 4)` via onLayout, or size the halo/circle from `r` (e.g. `Math.min(46, (r.safeWidth - 96) / tabs.length - 2)`), and make navHalo at least as wide as navRaised (`width: 48, height: 52`).

### App.tsx:6411
**Issue.** `accountToggle` is a 36x20dp custom switch used as the only control for two settings, with no `hitSlop` at either render site (2081-2088 biometrics, 2235-2242 notifications).

```
accountToggle: {
    alignItems: 'center',
    backgroundColor: '#E4E7EB',
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
    paddingHorizontal: 2,
    width: 36,
  },
```

**Impact.** 20dp of vertical target is under half the 48dp Android minimum — on a 5" 320dp phone that is roughly 3mm tall. Users repeatedly miss the biometric and notification switches, and it does not grow with the Android font-size or display-size settings that make everything around it larger, so it becomes proportionally *harder* to hit exactly for the users who need accessibility settings. The 16dp knob (6427-6428) is likewise fixed.

**Fix.** Add `hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}` at both Pressables (the nav tabs at 2396 already do this), or scale the control: `height: Math.max(20, 20 * Math.min(r.fontScale, 1.5))` with a matching knob and borderRadius.

### App.tsx:5468
**Issue.** `launchButton` fixes its height at 40 while sizing its width as a percentage capped at 220, and the label `signInButtonText` is fontSize 14 / lineHeight 20 that does scale with fontScale.

```
launchButton: {
    ...
    height: 40,
    justifyContent: 'center',
    maxWidth: 220,
    width: '61%',
  },
```

**Impact.** On a 320dp phone `launchContent` gets `paddingHorizontal: r.gutter` = 12, so the button is 0.61 x 296 = 180dp. 'Open Remote 365' (15 chars) is ~105dp at scale 1.0 but ~210dp at Android font size 2.0 — it wraps to two 40dp lines inside a fixed 40dp pill, so the text renders outside the orange background and overlaps the copyright footer below. The arbitrary 61% also gives a 169dp button on a 288dp window ('Display size: Largest' on a small phone) while capping at 220dp on a tablet.

**Fix.** Use `minHeight: 44`, `paddingVertical: 10`, `paddingHorizontal: 24`, `alignSelf: 'center'` and drop `width: '61%'` in favour of intrinsic width with `maxWidth: '100%'`, so the pill grows with the label instead of clipping it.

### App.tsx:5527
**Issue.** Avatar circles are a fixed 32x32 while the initials inside them are `fontSize: 14 / lineHeight: 20`, which RN multiplies by fontScale — so the text box outgrows the circle.

```
settingsAvatar: {
    ...
    borderRadius: 100,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },   // settingsAvatarText: { fontSize: 14, lineHeight: 20 } (5537, 5539); identical pair at accountAvatar 6341-6348 / accountAvatarText 6351-6353
```

**Impact.** At Android font size 2.0 the initials are 28sp with a 40dp line box inside a 32dp circle: two-letter initials ('ZA' ≈ 34dp wide) spill horizontally past the lilac circle and clip vertically against the row above and below. Visible on every phone once the accessibility font size is raised, on the Settings profile row (1717-1720) and the Account profile row (2202-2205).

**Fix.** Size the circle from the scale: `const d = Math.round(32 * Math.min(r.fontScale, 1.6))` and set `height: d, width: d, borderRadius: d / 2`, or cap the initials with `maxFontSizeMultiplier={1.3}` on the Text.

### App.tsx:5416
**Issue.** Body and legal copy are specified at 8sp and 10sp, below any legible minimum at default font scale, and this block uses 10sp for real content (not just captions).

```
signInFooterSub: {
    color: 'rgba(26, 29, 33, 0.5)',
    fontSize: 8,   // identical at upgradeFooterSub 5735
```

**Impact.** On a 5" 320dp screen at the default font scale, the copyright line renders at roughly 1.7mm cap height at 50% opacity — unreadable, and it is the string that carries the legal notice. The same problem at 10sp affects real content, not chrome: privacyBodyText (5785, the policy intro paragraph), feedbackInput (6105, the text the user is typing), upgradePlanDescription (5698, what the paid plan includes), permissionRowStatus (5911), trustedRowMeta (5998), accountInfoSubtitle (6407) and lockOptionText (6253). Users who fix this with the Android font-size slider then hit the fixed-height-container defects above.

**Fix.** Raise the floor to 12sp for body copy and 11sp for captions (8sp → 11, 10sp → 12), and if the 10sp look is required by the design, scope it to labels that carry no information the user must read.

### App.tsx:5641
**Issue.** `upgradeCurrentButton` and `upgradePlanCard` cap themselves at `maxWidth: 420` but never set `alignSelf: 'center'`, and their parent `upgradeContent` (5627) sets no `alignItems` — so on a wide window they stay pinned to the left edge.

```
upgradeCurrentButton: { ... maxWidth: 420, ... width: '100%' }   // and upgradePlanCard: { ... maxWidth: 420, minHeight: 159, ... } (5664-5665)
```

**Impact.** Tablets and unfolded foldables (840-1280dp): the 'Free Plan' button and the Business Plan card occupy the leftmost 420dp of the screen with 400-860dp of empty white to their right, which reads as a broken/half-loaded page. The same two styles are the only ones in the upgrade screen that even try to constrain width, so the fix is one property.

**Fix.** Add `alignSelf: 'center'` to both (or `alignItems: 'center'` on `upgradeContent`) — and better, spread the shared `content` object from 6643 into `upgradeContent`, which already carries `maxWidth: 720` + `alignSelf: 'center'`.

### App.tsx:6647
**Issue.** Two of the six keys in the useAppStyles responsive-content patch do not exist in baseStyles, so `.filter(key => key in baseStyles)` silently drops them: the Monitoring screen's style is named `monitorContent` (4684), not `monitoringContent`, and there is no `devicesListContent` style at all. Only 4 of the 6 intended screens actually receive maxWidth 720 / alignSelf center / r.gutter / r.navClearance.

```
...Object.fromEntries(['devicesContent','managedContent','monitoringContent','chatListContent','appsContent','devicesListContent'].filter(key => key in baseStyles).map(key => [key, { ...(baseStyles as any)[key], ...navContent }])),   // vs the real key at 4684: `monitorContent: {` , used at 778 `<View style={styles.monitorContent}>`
```

**Impact.** Tablets and unfolded foldables (Pixel Fold ~840dp, 10" tablet landscape ~1280dp): the Monitoring Overview screen (778) never gets maxWidth 720 / alignSelf center, so its endpoint summary and device list run edge-to-edge while Devices/Managed/Chat/Apps are correctly centred — the app looks half-ported on large screens. The failure is silent (the filter swallows it, TypeScript does not flag the string literals), and it hides itself from review: anyone reading 6647 believes Monitoring is covered. On phones the miss is masked because monitorList (4786) carries its own hard-coded `paddingBottom: 140`, which happens to exceed the 92dp the floating nav occupies — but that number is also not derived from r.navClearance, so it drifts independently.

**Fix.** Fix the key names ('monitoringContent' -> 'monitorContent', drop or correct 'devicesListContent'), and make the miss loud: replace the silent `.filter(key => key in baseStyles)` with a dev-time assert, or type the array as `(keyof typeof baseStyles)[]` so a typo is a compile error.

### App.tsx:6650
**Issue.** launchContent's override reserves only 24dp at the bottom, but signInFooter (5402) is `position:'absolute', bottom:16` and ~41dp tall inside the same SafeAreaView, so the two overlap whenever the launch content is tall enough to fill the viewport. The sibling auth screen solves exactly this and documents it: authScrollContent (5171-5178) reserves paddingBottom 88 with the comment about clearing the absolutely-positioned footer.

```
launchContent: { ...baseStyles.launchContent, ...content, paddingTop: r.insets.top + 16, paddingBottom: 24 },   // vs signInFooter (5402): { alignItems: 'center', bottom: 16, position: 'absolute' }  and authScrollContent (5177): paddingBottom: 88
```

**Impact.** Any phone in landscape (e.g. 640x360dp: r.illustrationHeight collapses to safeHeight*0.3 = 108, but 40 top + 108 image + 45 gap + ~94 copy + 60 gap + 40 button + 24 = ~411dp of content in a ~336dp viewport), and portrait 5" 320x568 at Android font scale >=1.5. The content then scrolls, and at the end of the scroll the 40dp orange 'Open Remote 365' button lands under the copyright/Privacy Policy footer — roughly 33 of its 40dp are covered, so the only action on the screen is unreadable and its lower half is hit-tested by the footer's parent. On tall portrait phones at scale 1.0 the content is centred and nothing overlaps, which is why it survives casual testing.

**Fix.** Reserve the footer in the scroll content the way authScrollContent already does — `paddingBottom: 24 + FOOTER_HEIGHT` (~88), or better, measure it — and while fixing the JSX break at 1658, keep signInFooter as a sibling of the ScrollView rather than moving it inside the scrollable content.

### src/auth/AuthScreen.tsx:53
**Issue.** The country/state picker modal has zero horizontal padding: it renders s.page (only flex+backgroundColor) wrapping s.card (only width/maxWidth/gap/flexShrink), so the search field, the Close link and all ~250 country rows sit flush against the physical screen edges.

```
<SafeAreaView style={s.page}><View style={s.card}>   // s.page = { flex: 1, backgroundColor: '#fff' } (L186); s.card = { width: '100%', maxWidth: 420, alignSelf: 'center', gap: 16, flexShrink: 1 } (L188) — neither declares padding
```

**Impact.** Every phone narrower than 420dp (i.e. all of them): the search input's 1px border is drawn on column 0 and on the last column, and each country row's text starts at x=0. On curved-edge panels (Galaxy S Edge/Ultra) and devices with large corner radii the first and last characters of the leading rows are physically clipped by the glass curvature; the Close link's 44dp hit area is half off the touch-reject margin. The main sign-in screen looks fine because its padding comes from the ScrollView's contentContainer (s.content, padding: 24) — the modal has no equivalent, so the Business sign-up path suddenly loses all gutters.

**Fix.** Add a padded wrapper inside the modal, e.g. change the modal body to `<SafeAreaView style={s.page}><View style={[s.card, s.modalCard]}>` and add `modalCard: { paddingHorizontal: 24, flex: 1 }` to the StyleSheet — or better, source the gutter from the app's own helper: `const { gutter } = useResponsive();` and use `paddingHorizontal: gutter`.

### src/auth/AuthScreen.tsx:50
**Issue.** The select field's value Text has no style, no numberOfLines and no flexShrink, so a long country name wraps to two lines and pushes the chevron outside the field's right border.

```
<Text>{value || `Select ${label.toLowerCase()}`}</Text><Feather name="chevron-down" size={16} />
```

**Impact.** Any phone at 360dp or narrower, and any device at Android 'Display size: Largest' (which scales a 411dp Pixel down to ~316dp effective width). s.inputWrap is flexDirection:'row' with justifyContent:'space-between' (L190/L192) and RN's default flexShrink is 0, so when the Text's measured width equals the available inner width the chevron has no room and overflows past the border — RN Views do not clip children by default on Android, so the arrow is drawn outside the input box, on top of the card edge. geo.ts:2/12 feeds this list through Intl.DisplayNames, which yields strings like "South Georgia & South Sandwich Islands" (38 chars) and "British Indian Ocean Territory"; at the default 14sp that is ~266dp against ~264dp of usable width on a 360dp phone (only ~224dp on a 320dp-effective screen), so the box also grows to two lines and stops matching the 44dp height of every other field above it.

**Fix.** Give the label text a shrink-and-truncate treatment: `<Text numberOfLines={1} style={s.selectValue}>{value || `Select ${label.toLowerCase()}`}</Text>` with `selectValue: { flex: 1, minWidth: 0, marginRight: 8, fontFamily: 'MonaSans-Regular', fontSize: 14, color: '#111315' }` (this also fixes the unstyled Text falling back to the system font instead of Mona Sans, unlike every other control on the screen).

### src/auth/AuthScreen.tsx:187
**Issue.** The screen hardcodes a 24dp gutter and never consults the app's own responsive layout helper, which prescribes 12dp below 360dp and exposes a `compact` flag for short screens.

```
content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24, paddingTop: 8 },
```

**Impact.** Small and accessibility-scaled phones. src/lib/responsive.ts:5 computes `const gutter = safeWidth < 360 ? 12 : safeWidth >= 600 ? 24 : 16;` and src/lib/useResponsive.ts exports it, but AuthScreen.tsx's import block (lines 1-10) never imports useResponsive — only App.tsx, ResponsivePanel.tsx and SettingsScaffold.tsx do. On a 320dp-effective screen (a 411dp Pixel at Display size = Largest, a very common accessibility setting) the hardcoded 48dp of horizontal padding leaves 272dp of card where the app's own rule would give 296dp — a 9% loss of every input, and the password field's typing area shrinks to ~194dp once the 44dp eye button and 32dp of input padding are subtracted. The screen also gets 24dp of side gutter on a 600dp+ tablet where the rule agrees, so the divergence is purely at the small end.

**Fix.** Import the existing hook and drive the container from it: `import { useResponsive } from '../lib/useResponsive';` then `const { gutter } = useResponsive();` and `<ScrollView contentContainerStyle={[s.content, { paddingHorizontal: gutter }]} ...>`, dropping the horizontal half of `padding: 24`.

### src/auth/AuthScreen.tsx:130
**Issue.** AuthScreen is the only full screen in the app that renders no <StatusBar>, so when it mounts the previous screen's StatusBar entry is popped and the bar reverts to RN's default (light/white icons) over this screen's hardcoded white background.

```
return <SafeAreaView style={s.page}>   // s.page = { flex: 1, backgroundColor: '#fff' }; the import on line 2 pulls only Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View — no StatusBar, and expo-status-bar is never imported
```

**Impact.** Every Android and iOS device. App.tsx renders `<StatusBar style="dark" />` immediately after the SafeAreaView on ~30 screens (e.g. App.tsx:553, 610, 761, 958, 1129, 1523). RN's StatusBar keeps a props stack and pops the entry on unmount, falling back to `barStyle: 'default'` = light content, so navigating Settings -> Sign in flips the clock, battery and signal icons to white on this all-white page: they vanish. It is worse under edge-to-edge (RN's WindowUtil.kt:106 calls setDecorFitsSystemWindows(false) and WindowUtil.kt:115 sets statusBarColor = TRANSPARENT), so there is no opaque bar behind them, and on gesture-navigation devices in system dark mode WindowUtil.kt:124 sets isAppearanceLightNavigationBars=false, drawing a white gesture pill on the white background too.

**Fix.** Import `import { StatusBar } from 'expo-status-bar';` and render `<StatusBar style="dark" />` as the first child of the outer SafeAreaView (line 130) and of the SelectField modal's SafeAreaView (line 53), matching the convention used by every other screen in App.tsx.

### src/auth/AuthScreen.tsx:30
**Issue.** No TextInput in the screen sets returnKeyType, onSubmitEditing or blurOnSubmit, so there is no way to advance or submit from the software keyboard — the user must dismiss the keyboard and hunt for the button.

```
<TextInput accessibilityLabel={label} style={s.input} value={value} onChangeText={onChange}
```

**Impact.** Short screens (640dp tall and below) and landscape, where the keyboard claims 250-300dp of a ~520dp usable viewport. Every field renders a plain 'return'/newline key. On Business sign-up step 2 the card is ~962dp of content (5 address fields + step tabs + Back + Next + legal block); with the keyboard up the Next button sits in the region the keyboard covers, and because the ScrollView's max scroll offset stops at the content end the user has to blind-tap empty space to dismiss the keyboard before every step transition. The 6-digit verify/2FA screens are worst: the numeric keypad has no submit key at all, so after typing the code there is no path to 'Verify And Sign In' from the keyboard.

**Fix.** Thread the submit action through Field: add `returnKeyType`/`onSubmitEditing` props (`returnKeyType={code || password ? 'go' : 'next'}`, `onSubmitEditing={onSubmit}`) and pass `submit` (line 94) down from AuthScreen, e.g. `<Field ... onSubmitEditing={businessDetails ? nextStep : submit} />`. Also add `keyboardDismissMode="on-drag"` to the ScrollView at line 133.

### src/auth/AuthScreen.tsx:52
**Issue.** Both Modals in the screen omit statusBarTranslucent/navigationBarTranslucent while the app runs edge-to-edge, and the SafeAreaView inside them applies the app window's insets a second time

```
L52 `<Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>` then L53 `<SafeAreaView style={s.page}>` (no `edges` prop => all four edges). Same at L179 `<Modal visible={legal !== null} animationType="slide" onRequestClose={() => setLegal(null)}>`. app.json declares `"edgeToEdgeEnabled": true`, and the app's other modals do pass the flag: src/chat/AddContactModal.tsx:95 `<Modal visible={visible} transparent animationType="fade" statusBarTranslucent ...>`.
```

**Impact.** Android, every device, worst where the system bars are tallest. RN's Modal defaults statusBarTranslucent=false, so the dialog window is laid out INSIDE the system bars, while useSafeAreaInsets (SafeAreaProvider is mounted on the main edge-to-edge window at App.tsx:2432) still reports top = status-bar height and bottom = nav-bar height. The picker therefore starts one extra status-bar height (24dp on an older phone, 40-48dp on a punch-hole Pixel/Galaxy) below the top of the modal and loses another 24-48dp at the bottom on 3-button-nav devices — a blank band above 'Close' and dead space under the last country row, sized differently on every handset. Also note every other screen in the app deliberately opts out of the top edge (`edges={['left','right','bottom']}` at App.tsx:552, 609, 760, ... and src/settings/SettingsScaffold.tsx:63) — the auth modals are the only surface using the default all-edges inside a Modal.

**Fix.** Add `statusBarTranslucent navigationBarTranslucent` to both Modals (L52, L179) so the dialog window is edge-to-edge like the host window, and keep the inner SafeAreaView; or, if the modal stays non-translucent, drop the SafeAreaView for a plain View so the insets are not applied twice.

### src/settings/SettingsScreen.tsx:224
**Issue.** The initials avatar is a hard 32x32dp circle whose child Text scales with fontScale, so the initials outgrow the circle at accessibility font sizes.

```
  avatar: {
    alignItems: 'center',
    backgroundColor: '#F9F5FF',
    borderRadius: 100,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  avatarText: {
    color: '#7F56D9',
    fontSize: 14,
    ...
    lineHeight: 20,
```

**Impact.** React Native scales both fontSize and lineHeight by fontScale when allowFontScaling is on (it is — nothing in src/settings sets allowFontScaling={false}, unlike src/meetings/MeetingHome.tsx which does). At Android fontScale 1.6 the two-letter initials become 22.4sp on a 32dp line box; at 2.0 they are 28sp with a 40dp line box inside a 32dp circle. Because the View has no overflow:'hidden', the letters render past the lavender circle on all four sides and, on a 320dp phone, collide with the display name to their right (profileCopy is flex:1 with only a 10dp gap). AccountScreen.tsx:131-132 has the identical pattern (`borderRadius: 16, height: 32, ... width: 32` with `fontSize: 14, lineHeight: 20`), so the Account screen shows the same broken circle. Worst on small phones where the user is also most likely to have raised the system font size.

**Fix.** Either add allowFontScaling={false} to the initials <Text> (line 90 here, line 60 in AccountScreen) — the initials are a glyph, not reading copy — or size the circle from fontScale: const { fontScale } = useResponsive(); const d = 32 * Math.min(fontScale, 1.4); style={[styles.avatar, { width: d, height: d, borderRadius: d / 2 }]}.

### src/settings/AccountScreen.tsx:142
**Issue.** The Notifications row uses a hand-rolled 36x20dp toggle as its entire tap target — well under the 48dp Android / 44pt iOS minimum — with no hitSlop, instead of the shared SettingsToggleRow that wraps a real native <Switch>.

```
  toggle: { alignItems: 'center', backgroundColor: '#E4E7EB', borderRadius: 10, height: 20, justifyContent: 'center', paddingHorizontal: 2, width: 36 },
```

**Impact.** The Pressable at lines 80-87 has no hitSlop and no expanded parent target (the surrounding infoRow is not pressable), so the whole hit area is 36x20dp. On a 5" 1080p phone (~440dpi, ~2.75 px/dp) that is roughly 3.3mm x 1.8mm of glass — below the ~7mm/48dp finger target Android's own accessibility scanner flags, and misses are frequent one-handed. It also does not respond to the OS at all: the shared SettingsToggleRow (SettingsScaffold.tsx:131-136) uses React Native's <Switch>, which renders at the platform's own size and honours platform switch settings, so the same boolean (SETTING_KEYS.chatNotifications, also rendered by ChatSettingsScreen.tsx:15-21) appears as a big native switch on one screen and a tiny custom pill on another.

**Fix.** Replace the whole block at AccountScreen.tsx:72-88 with <SettingsToggleRow icon="bell" title="Notifications" subtitle={...} value={notificationsEnabled} onValueChange={setNotificationsEnabled} /> from SettingsScaffold, and delete the toggle/toggleOn/toggleKnob/toggleKnobOn styles. If the custom pill must stay, at minimum add hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }} to the Pressable.

### src/settings/AccountScreen.tsx:102
**Issue.** The delete-confirm <Modal> omits statusBarTranslucent (and navigationBarTranslucent) even though the app runs edge-to-edge, so the dim backdrop stops short of the system bars.

```
      <Modal transparent animationType="fade" visible={confirmDelete} onRequestClose={() => setConfirmDelete(false)}>
```

**Impact.** app.json:28 sets "edgeToEdgeEnabled": true, so the app draws under the status bar and the gesture/3-button navigation bar. A transparent RN Modal without statusBarTranslucent is laid out inside the content insets, so its rgba(0,0,0,0.5) backdrop covers only the middle of the screen: on any Android device with a notch, punch-hole or tall status bar you get an undimmed horizontal band at the top (and at the bottom over the navigation bar) showing the bright orange app gradient through, which reads as a rendering glitch — most obvious on tall 20:9 phones where the bars are proportionally large. Two other modals in this same repo already do it correctly (src/chat/AddContactModal.tsx:95 and src/meetings/MeetingRoom.tsx:1663 both pass statusBarTranslucent), so this is an inconsistency, not a platform limitation.

**Fix.** Add statusBarTranslucent and navigationBarTranslucent to the Modal: <Modal transparent statusBarTranslucent navigationBarTranslucent animationType="fade" ...>. (BiometricScreen.tsx:123 and TwoFactorScreen.tsx:151 have the same omission and should be fixed with it.)

### src/settings/SettingsScaffold.tsx:66
**Issue.** The scaffold's KeyboardAvoidingView uses behavior="height" on Android while the activity is declared windowSoftInputMode="adjustResize", which double-subtracts the keyboard height from the content area.

```
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
```

**Impact.** android/app/src/main/AndroidManifest.xml:30 declares android:windowSoftInputMode="adjustResize", so on Android the RN root window is already shrunk by the IME before KeyboardAvoidingView runs. behavior="height" then sets its own height to (already-reduced frame height − keyboard height), removing the keyboard height a second time. On a 640dp-tall phone with a ~280dp IME the scaffold's usable area collapses from the correct 360dp to roughly 80dp, so the focused field jumps upward and the surrounding form is squeezed into a thin strip; on a 5" phone (~534dp usable) with a 300dp keyboard the remaining area is near zero and the page appears blank above the keyboard. This hits every scaffolded page that has a TextInput — ChangePasswordScreen.tsx:93, TwoFactorScreen.tsx:97 and FeedbackScreen — i.e. exactly the flows where the keyboard is always open. It is worst on short phones and on devices with tall IMEs (gesture-bar phones, or any IME with a suggestion strip).

**Fix.** Pass undefined on Android so adjustResize is left to do its job: behavior={Platform.OS === 'ios' ? 'padding' : undefined}. The ScrollView with keyboardShouldPersistTaps at line 68 already handles the scroll-to-field case.

### src/settings/PermissionsScreen.tsx:140
**Issue.** PermissionsScreen hand-rolls its own row at 12sp title / 10sp status — roughly half the type scale of the shared SettingsRow (14sp/12sp) — making permission states unreadable at small display-size / high density.

```
  rowTitle: { color: '#111315', fontSize: 12, fontWeight: '400', lineHeight: 17 },
  rowStatus: { fontSize: 10, fontWeight: '500', lineHeight: 14 },
```

**Impact.** Compare SettingsScaffold.tsx:288-301, where rowTitle is fontSize 14 and rowMeta is fontSize 12 — every other settings screen uses that scale, so opening Permissions visibly shrinks the type. The 10sp status ('Allowed' / 'Denied' / 'Not set') is the only thing on the screen that carries information, and 10sp is below Material's 12sp body floor. It gets physically smaller still on Android's Settings > Display > Display size = Small, which lowers the density so 10sp maps to fewer physical millimetres — on a 6" 1080p phone at Small display size the colour-coded status renders at roughly 1.5mm cap height. Users with any degree of presbyopia cannot read whether a permission is granted, which is the entire purpose of the screen. The screen also duplicates the scaffold's row instead of composing SettingsRow, so it will keep drifting from the rest of Settings.

**Fix.** Delete the local `row`/`rowLeft`/`rowCopy`/`rowTitle`/`rowStatus` styles and the PermissionRow component and compose the shared one: <SettingsRow icon={icon} iconColor={COLOR[status]} title={title} detail={LABEL[status]} onPress={onPress} />. If a coloured status line is required, use SettingsOptionRow's title/subtitle pair, which is already 14sp/12sp.

### src/settings/SettingsScaffold.tsx:285
**Issue.** The detail column is capped at a percentage of row width (maxWidth: '45%') while its text is numberOfLines={1}, so the value a settings row exists to show gets ellipsised as font scale rises — the cap does not grow with the text.

```
  rowRight: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    maxWidth: '45%',
    flexShrink: 1
  },
...
        {detail ? <Text style={styles.rowMeta} numberOfLines={1}>{detail}</Text> : null}
```

**Impact.** On a folded Galaxy Fold (280dp) or a 320dp phone the content width is ~256-296dp, so rowRight is capped at ~115-133dp, and after the 16dp chevron plus the 8dp gap only ~91-109dp is left for the text. At default font scale that is fine, but the cap is width-relative while rowMeta (12sp) is fontScale-relative: at fontScale ~1.6 and above the value no longer fits and truncates. Concretely, SettingsScreen.tsx:118 renders detail={currentLangNative} from src/lib/i18n.tsx:11-21 — 'Português' and 'Français' become 'Portugu…' / 'Franç…', and PrivacySecurityScreen.tsx:24's detail="Always on" becomes 'Alway…'. The user has raised the font size specifically to read these values and they are the first thing to be cut, while the title beside them (which has no numberOfLines) is allowed to wrap freely.

**Fix.** Make the cap font-scale aware and let the value wrap: in SettingsRow read const { stackActions } = useResponsive() and, when stackActions is true (safeWidth < 360 or fontScale > 1.3), render the detail as a second line inside rowLabelGroup instead of in rowRight; otherwise raise the cap (maxWidth: '45%' -> '55%') and drop numberOfLines={1} to numberOfLines={2}.

### src/settings/AccountScreen.tsx:16
**Issue.** The Account screen truncates the email address to a single line in a fixed-width flex column, so the primary datum on the screen is unreadable on narrow phones or at raised font scale, with no way to reveal it.

```
        <Text style={styles.infoSubtitle} numberOfLines={1}>{subtitle}</Text>
```

**Impact.** AccountInfoRow is used at line 70 as <AccountInfoRow icon="mail" title="Email address" subtitle={user?.email} />. infoCopy is flex:1 (line 139) inside a row that also holds a 16dp icon and a 12dp gap, so on a 320dp phone with the 12dp gutter the email gets ~264dp. infoSubtitle is 12sp, so at fontScale 2.0 (24sp, ~13dp/char) about 20 characters fit — 'zainulabidden769@gmail.com' (26 chars) renders as 'zainulabidden769@gm…'. On a folded Fold (280dp) it truncates at fontScale 1.3 already. The same numberOfLines={1} is on the header name and email at lines 63-64. Nothing on the screen is selectable or expandable, so a user checking which account they are signed into cannot find out. By contrast SettingsScreen.tsx:94 renders the same email with no numberOfLines and lets it wrap, so the two screens disagree.

**Fix.** Drop numberOfLines={1} from AccountScreen.tsx:16 (and from line 64) so the address wraps — infoRow already uses minHeight: 51 (line 137) and will grow. Add selectable to the email <Text> so it can be copied.

### src/settings/SettingsScaffold.tsx:40
**Issue.** Every settings page title is locked to one line with numberOfLines={1}, so the header ellipsises the page name at raised font sizes and in longer languages — even though the header height itself is already made to grow with fontScale, so there is room for a second line.

```
<Text style={styles.title} numberOfLines={1}>{title}</Text>  // styles.title: { fontSize: 16, fontWeight: '600', lineHeight: 23, flexShrink: 1 }, inside header minHeight: headerHeight + insets.top (line 37)
```

**Impact.** Any 320-400dp phone at Android Settings > Display > Font size above default, and any non-English locale at default. On a 360dp phone the title box is 360 - 32 (header padding) - 20 (back arrow) - 12 (gap) = 296dp. 'Two-factor authentication' (25 chars) at fontScale 1.6 needs ~333dp, and the Spanish 'Autenticacion de dos factores' (i18n.tsx line ~31, 29 chars) needs ~313dp at fontScale 1.3 — the *default maximum* of the Android font-size slider. Both render as 'Autenticacion de do...' with the rest of the header sitting empty, and the page loses its only identifying label. Affects Two-factor authentication, Privacy and security, Streaming quality and Open source licenses in es/fr/pt/de.

**Fix.** Drop numberOfLines={1} (or raise it to 2) on SettingsScaffold.tsx:40 and let the header grow — line 37 already uses minHeight rather than height, so a two-line title costs nothing structurally.

### src/settings/BiometricScreen.tsx:166
**Issue.** iOS only (iPhone X and later, and any iPad): the sheet is presented in a full-screen Modal, so its Cancel / Save Setting row (BiometricScreen.tsx:136-143) ends 12pt above the physical bottom edge, i.e. inside the 34pt home-indicator band. The buttons are visually crowded by the indicator and their lower third sits in the system's swipe-up region. Fix: `style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}` using useSafeAreaInsets, matching ChatThread.tsx:862.

```
sheetBackdrop: { backgroundColor: 'rgba(243, 244, 246, 0.7)', flex: 1, justifyContent: 'flex-end' },
  sheet: {
    ...
    overflow: 'hidden',
    paddingBottom: 12,
```

**Impact.** Every gesture-navigation Android phone (bottom inset ~24-48dp) and every iPhone X-and-later (34pt home indicator). The sheet is pinned to justifyContent:'flex-end', so the "Cancel" / "Save Setting" row is drawn underneath the gesture pill: the buttons are visually cut in half and taps near their lower edge are swallowed by the system swipe-up gesture, so users repeatedly fail to save the lock delay. On 3-button-nav devices it looks fine, which is why it survives review.

**Fix.** Call useSafeAreaInsets() in BiometricScreen and apply it to the panel, matching the pattern already used at chat/ChatThread.tsx:862: `const insets = useSafeAreaInsets();` then `<ResponsivePanel style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]} ...>` and drop `paddingBottom: 12` from the static style.

### src/settings/BiometricScreen.tsx:100
**Issue.** All devices: the biometric on/off switch has a 36x20dp hit area, well under the 48dp Android / 44pt iOS minimum, and the row around it is inert. Worst on 'Display size: Small' and for users with motor impairment. Fix: add hitSlop={{top:14,bottom:14,left:8,right:8}} or wrap the pill in a 44dp-tall pressable, or just use the native <Switch> the rest of Settings uses.

```
style={[accountToggleStyles.toggle, biometricEnabled && accountToggleStyles.toggleOn]}
// AccountScreen.tsx:142 → toggle: { ... borderRadius: 10, height: 20, justifyContent: 'center', paddingHorizontal: 2, width: 36 },
```

**Impact.** All devices, worst on small/high-density phones and with Android "Display size: Large/Largest" (which shrinks logical dp, so 20dp becomes ~3.5mm physical). 20dp tall is well under the 48dp Android / 44pt iOS minimum target: users tap the row and nothing happens, which reads as "the biometric toggle is broken". The adjacent SettingsToggleRow in the same app uses a native <Switch> and gets a correct 48dp target, so the two settings screens behave differently under the same finger.

**Fix.** Add `hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}` to the Pressable at line 96-103 (bringing it to 48x64dp), or better, make the whole row press-to-toggle by wrapping lines 88-104 in a Pressable with onPress={toggleBiometric} and minHeight: 48.

### src/settings/TwoFactorScreen.tsx:193
**Issue.** Devices at fontScale >= ~1.8 (Android 14+ font-size slider near max, iOS Dynamic Type AX sizes): the 22sp digits need a ~52dp line box inside a 50dp inner box, so ascenders/descenders of the auto-focused code are shaved and the user cannot verify the code before submitting. Fix: replace height:52 with minHeight:52 + paddingVertical, and drop the fixed height entirely.

```
codeInput: { backgroundColor: '#F8FAFC', borderColor: 'rgba(26,29,33,0.15)', borderRadius: 8, borderWidth: 1, color: '#111315', fontSize: 22, height: 52, letterSpacing: 6, paddingHorizontal: 16, textAlign: 'center' },
```

**Impact.** Any device with Android "Font size" above Default (fontScale 1.3 at Large, 2.0 at Largest on Android 14+) or iOS Dynamic Type at XXL/AX sizes. At fontScale 2.0 the glyphs render at 44px inside 50dp of usable box (52 minus 2x borderWidth 1): digit tops and descenders are shaved off, and because the field autoFocuses (line 124) the user is staring at a half-rendered code they cannot verify before submitting. letterSpacing: 6 is also unscaled, so the tracking stays tight relative to the enlarged glyphs.

**Fix.** Replace `height: 52` with `minHeight: 52` and add `paddingVertical: 10`; optionally cap runaway scaling on this one field with `maxFontSizeMultiplier={1.6}` on the TextInput at line 116.

### src/settings/ChangePasswordScreen.tsx:132
**Issue.** Android 'Font size: Large' and above (fontScale >= ~1.5) and iOS Dynamic Type AX sizes: the 14sp text needs a ~25-33dp line box inside 24dp of content height, so the typed characters, the revealed password and the 'Confirm new password' placeholder are sliced top and bottom. Fix: minHeight instead of height (the row wrapper at line 131 already supplies the border and padding).

```
input: { color: '#111315', flex: 1, fontSize: 14, height: 40, paddingVertical: 8 },
```

**Impact.** Any device with Android "Font size: Large/Largest" or iOS Dynamic Type at AX sizes. At fontScale 2.0 the text renders at 28px inside a 40dp box that already spends 16dp on paddingVertical, so only ~24dp of glyph height is visible — password dots/characters and the placeholders ("Confirm new password") are sliced through the middle. Users with low vision, i.e. exactly the users who raised the font size, cannot confirm what they typed on a screen where typos are invisible by design.

**Fix.** Change to `minHeight: 40` and drop the fixed height, letting paddingVertical: 8 define the padding; the parent `inputRow` (line 131) already uses paddingVertical: 4 and will grow with it.

### src/settings/FeedbackScreen.tsx:136
**Issue.** <=360dp phones at fontScale ~2.0 in the longest locales (Urdu, German): the label wraps to two lines (~80dp) and is centre-cropped inside the rigid 44dp box, leaving a sliver of a word. Fix: swap height:44 for minHeight:44 + paddingVertical:10 on both buttons, matching BiometricScreen.tsx:211/223.

```
actions: { flexDirection: 'row', gap: 8, marginTop: 4, width: '100%' },
  cancelButton: { ... flex: 1,
    height: 44,
    justifyContent: 'center',
  },
  sendButton: { alignItems: 'center', backgroundColor: '#FF8A00', borderRadius: 4, flex: 1, height: 44, justifyContent: 'center' },
```

**Impact.** Narrow phones (<=360dp) combined with Android "Font size: Large" or larger, and any device at fontScale 2.0. Each button is only ~(screenWidth-40)/2 ≈ 140dp wide; at fontScale 2.0 the 14px labels render at 28px with an effective lineHeight of 40dp, and localised labels (Spanish "Cancelar", Portuguese "Enviar", German) wrap to two lines needing ~80dp. The text is then vertically centre-cropped inside 44dp — the user sees a button with a sliver of a word in it and cannot tell Cancel from Send. This is the narrowest button pair in the slice, so it breaks first. The repo already solves this at UpgradePlanScreen.tsx:348 and BiometricScreen.tsx:212 with minHeight.

**Fix.** Replace `height: 44` with `minHeight: 44` + `paddingVertical: 10` + `paddingHorizontal: 8` on both cancelButton and sendButton, and stack the row vertically when cramped using the already-computed but entirely unused `stackActions` flag from lib/responsive.ts:10 (`safeWidth < 360 || fontScale > 1.3`): `<View style={[styles.actions, stackActions && { flexDirection: 'column' }]}>`.

### src/settings/TwoFactorScreen.tsx:194
**Issue.** The three action buttons use fixed height: 44 / height: 40 while their labels scale with the OS font setting.

```
primaryButton: { alignItems: 'center', backgroundColor: '#FF8A00', borderRadius: 6, height: 44, justifyContent: 'center', width: '100%' },
  ghostButton: { alignItems: 'center', ... height: 40, justifyContent: 'center', width: '100%' },
  destructiveButton: { alignItems: 'center', backgroundColor: '#D92D20', borderRadius: 6, height: 44, justifyContent: 'center', width: '100%' },
```

**Impact.** Android "Font size: Large/Largest" and iOS AX Dynamic Type. "Verify & enable" at fontScale 2.0 renders at 28px with a 40dp effective lineHeight; on a <=360dp phone it wraps to two lines (~80dp) and is clipped to the middle 44dp, so the user sees "Verify &" cropped top and bottom. The 40dp `ghostButton` ("Cancel setup") is already below the 44/48dp minimum touch target even at default font size.

**Fix.** Change all three to `minHeight` (44 / 44 / 44 — raise ghostButton from 40) plus `paddingVertical: 10` and `paddingHorizontal: 12`.

### src/settings/ChangePasswordScreen.tsx:138
**Issue.** The submit button has a fixed height: 44 while its label ("Update password" / "Set password") scales with the OS font setting.

```
submitButton: { alignItems: 'center', backgroundColor: '#FF8A00', borderRadius: 6, height: 44, justifyContent: 'center', marginTop: 4, width: '100%' },
```

**Impact.** Android Font size Largest (fontScale 2.0) on a <=360dp phone: "Update password" at 28px needs ~210dp; the button is full-width (~296dp) so it stays on one line, but its 40dp effective lineHeight leaves only 2dp of slack inside 44dp and the glyph box is visibly cropped. In Spanish ("Actualizar contraseña", i18n is wired at lib/i18n) it wraps to two lines and the second line disappears entirely.

**Fix.** Replace `height: 44` with `minHeight: 44` and add `paddingVertical: 10`, `paddingHorizontal: 16`.

### src/settings/UpgradePlanScreen.tsx:372
**Issue.** The plan-detail CTA uses a fixed height: 44 even though it carries the longest label in the screen ("Upgrade to Enterprise").

```
detailUpgrade: {
    alignItems: 'center',
    backgroundColor: '#FF8A00',
    borderRadius: 4,
    height: 44,
    justifyContent: 'center',
    width: '100%',
  },
```

**Impact.** Narrow phones at Android Font size Large/Largest. `Upgrade to ${detailPlan.name}` (line 151) is built at runtime from the server plan catalogue, so its length is unbounded; at fontScale 2.0 "Upgrade to Enterprise" needs ~290dp at 28px and wraps to two lines (~80dp) inside a rigid 44dp box, cropping the plan name the user is about to pay for. Notably the sibling `upgradeButton` on the same screen (line 348) already uses `minHeight: 44` correctly, so the list and the detail view behave differently.

**Fix.** Change `height: 44` to `minHeight: 44` and add `paddingVertical: 10, paddingHorizontal: 16` to match `styles.upgradeButton` at lines 341-350.

### src/settings/FeedbackScreen.tsx:109
**Issue.** FeedbackScreen builds its own scaffold instead of using SettingsPage, and its content container drops the 720dp cap and the responsive gutter that every other settings screen has.

```
content: { gap: 24, paddingHorizontal: 16, paddingTop: 24, width: '100%' },
```

**Impact.** iPad (app.json sets "supportsTablet": true) and unfolded foldables in portrait (~700-840dp wide). SettingsScaffold.tsx:244-247 and UpgradePlanScreen.tsx:244-246 both cap content at `maxWidth: 720, alignSelf: 'center'`; Feedback does not, so the feedback textarea and the Cancel/Send buttons stretch the full window width while the Settings page the user just came from is centred at 720 — the content visibly jumps sideways on navigation, and the buttons become absurdly wide stripes. It also hard-codes paddingHorizontal: 16, ignoring `useResponsive().gutter` (12 below 360dp, 24 at/above 600dp), so on a 320dp phone it is 4dp tighter than every other settings screen and on a tablet 8dp looser.

**Fix.** Add `maxWidth: 720, alignSelf: 'center'` to `content`, and replace the hard-coded `paddingHorizontal: 16` with the hook value: `const { gutter } = useResponsive();` then `contentContainerStyle={[styles.content, { paddingHorizontal: gutter, paddingBottom: insets.bottom + 24 }]}`.

### src/settings/LanguageScreen.tsx:18
**Issue.** The language picker offers two RTL languages and the LANGUAGES table even flags them, but nothing in the app ever switches layout direction — `I18nManager`, `forceRTL` and `writingDirection` do not appear anywhere in src/.

```
onPress={() => setLang(item.code)}
// lib/i18n.tsx:19-20 → { code: 'ar', label: 'Arabic', native: 'العربية', rtl: true },
//                       { code: 'ur', label: 'Urdu', native: 'اردو', rtl: true },
```

**Impact.** Any device whose app language is set to Arabic or Urdu. The whole settings UI stays hard LTR: the back chevron stays top-left, every `flexDirection: 'row'` row keeps its icon on the left and its value/chevron on the right, and Arabic/Urdu strings render left-aligned in a mirrored-reading context. Numbers and Latin fragments inside Arabic strings also bidi-reorder unpredictably because no `writingDirection` is declared. The `rtl: true` flag is dead data — a grep over the entire src/ tree returns zero hits for I18nManager.

**Fix.** Either drop 'ar'/'ur' from LANGUAGES until RTL is supported, or wire the flag up: on setLang, call `I18nManager.allowRTL(true); I18nManager.forceRTL(!!LANGUAGES.find(l => l.code === next)?.rtl);` and prompt for the required app reload (RN cannot flip direction live), and add `writingDirection: 'rtl'` to the text styles for those locales.

### src/settings/UpgradePlanScreen.tsx:372
**Issue.** The plan-detail CTA is a fixed height:44 button whose label is a server-supplied plan name concatenated into a sentence, so it cannot grow when the label wraps - and the same file already uses minHeight for the sibling button.

```
detailUpgrade: { alignItems: 'center', backgroundColor: '#FF8A00', borderRadius: 4, height: 44, justifyContent: 'center', width: '100%' }  // label at line 151: `Upgrade to ${detailPlan.name}` — while upgradeButton at line 348 correctly uses minHeight: 44
```

**Impact.** 320-360dp phones at fontScale >= ~1.8, and any device as soon as the API returns a longer plan name (plans come from fetchPlans, line 68). On a 320dp phone the button is 288dp wide; 'Upgrade to Professional' at 28px is ~320px, so the Text wraps to two 40dp lines inside a rigid 44dp box and both lines are centre-cropped - the primary purchase CTA reads as two half-height slivers, right where a mis-read costs money.

**Fix.** Replace `height: 44` with `minHeight: 44, paddingVertical: 10, paddingHorizontal: 16` (exactly what upgradeButton at line 341-350 already does), and give detailUpgradeText `textAlign: 'center'`.

### src/settings/PrivacyPolicyScreen.tsx:95
**Issue.** Accordion section headers are locked to a single line, so at raised font sizes the section titles are ellipsized instead of wrapping - on a legal document where the heading is the only navigation.

```
<Text style={styles.sectionHeaderText} numberOfLines={1}>{section.title}</Text>   // sectionHeaderText: { color: '#FFFFFF', flexShrink: 1, fontSize: 14, ... } and sectionHeader has minHeight: 40 (line 140)
```

**Impact.** <=360dp phones at fontScale >= ~1.5 (Android 'Font size: Large' upward, iOS AX sizes). Header width is ~296dp minus 32dp padding minus the 18dp chevron and 8dp gap = ~238dp; '6. Security and Compliance' at 21-28px needs 290-380px, so it renders as '6. Security a…'. The user raised the font size precisely to read this screen and now cannot tell the sections apart. The header itself has minHeight (not height), so wrapping is free.

**Fix.** Drop numberOfLines={1} from line 95 (or use numberOfLines={2}); sectionHeader already uses minHeight: 40 + paddingVertical: 10 so it grows correctly.

### src/settings/SystemLogsScreen.tsx:20
**Issue.** Diagnostics values are rendered through SettingsRow's `detail` slot, which is capped at 45% of the row width and hard-limited to one line, so the device name and platform string - the entire point of this screen - are silently truncated.

```
<SettingsRow icon="smartphone" iconColor="#14AE5C" title="Device" detail={String(deviceName)} />   // SettingsScaffold.tsx:99 `<Text style={styles.rowMeta} numberOfLines={1}>{detail}</Text>` inside rowRight: { ... maxWidth: '45%', flexShrink: 1 } (SettingsScaffold.tsx:281-287)
```

**Impact.** Every phone, degrading with width and font scale: on a 360dp device the value column is ~147dp, so at the default 12sp only ~24 characters survive ('Zain's Galaxy S24 Ult…'), and at fontScale 2.0 only ~10. The text is not selectable, does not wrap, and there is no detail view - so a support agent asking 'what device / OS version?' gets an unreadable answer, which is the one job of a System info screen.

**Fix.** For value-carrying rows let the detail wrap: pass a variant that drops numberOfLines and raises/removes maxWidth (e.g. `rowRight: { flexShrink: 1 }` plus `flexWrap: 'wrap'` on the row), or stack title over value on narrow widths (`stackActions` from useResponsive already reports safeWidth < 360 || fontScale > 1.3).

### src/chat/ChatThread.tsx:960
**Issue.** On every window narrower than ~373dp (360dp = the most common Android phone) the fixed-width chat Image (209dp at W=360) exceeds the 64%-capped bubble's content box (201.9dp) and is clipped on the right by the bubble's `overflow: 'hidden'`. It is worse for a photo WITH a caption or a reply quote, where `imageOnly` is false (line 1044) so the bubble keeps `paddingHorizontal: 11` and the box drops to 187.9dp — a 21dp slice off every captioned photo at W=360.

```
const MAX_W = Math.min(210, Math.round(screenW * 0.58));   // line 960
  bubbleWrap: { maxWidth: '64%' },                            // line 1650
  bubble: { minWidth: 50, ... paddingHorizontal: 11, ... overflow: 'hidden' },  // line 1651
  bubbleImageOnly: { paddingHorizontal: 4, paddingTop: 4, paddingBottom: 4 },   // line 1652
```

**Impact.** Solve `0.64*(W-32) - 8 >= min(210, 0.58W)` and it fails for every screen narrower than ~373dp. At W=360dp (Galaxy S23, Galaxy A54, and essentially every 1080x2400 @3.0 Android phone) the image is 209dp inside a 201.9dp box — the right ~8dp of every received photo is sliced off by the bubble's `overflow: 'hidden'`. At W=320dp (or a 360dp phone with Android 'Display size = Largest', which drops the effective width to ~277dp) the cut is 10-12dp. The photo looks deliberately cropped on the right edge with no visual cue that it is clipped.

**Fix.** Derive the image cap from the same box the bubble uses instead of a second, unrelated fraction. Pass the resolved bubble content width down, or compute it in ChatImage: `const BUBBLE_FRACTION = 0.64; const MAX_W = Math.floor((screenW - 32) * BUBBLE_FRACTION) - 8;` and drop the `Math.min(210, ...)` clamp (see also the tablet finding). Better still, replace the magic 0.64/32 with `useResponsive()`'s `gutter`/`contentWidth` so the two stay in sync.

### src/chat/ChatThread.tsx:763
**Issue.** The composer TextInput (ChatThread.tsx:763) is the only text in the chat screen that ignores the OS font-size setting; at Android 14's 2.0x setting message bubbles render at ~26px while the input stays locked at 13dp, making the composer the smallest text on the screen for precisely the users who enlarged it.

```
<TextInput
            allowFontScaling={false}
            style={styles.messageInput}   // messageInput: { fontSize: 13, ... } line 1774
```

**Impact.** A user on Android 'Font size = Largest' (fontScale 1.3) or iOS Accessibility Text Sizes (up to 3.1) sees message bubbles render at 16-37px while the box they type into stays locked at 13dp. On any device with a large-font setting the composer is the smallest text on the screen — low-vision users cannot read what they are typing, and the caret/selection handles are sized for 13px text. Confirmed no global clamp: `grep allowFontScaling|maxFontSizeMultiplier|defaultProps` across src/ + App.tsx returns only per-call-site opt-outs.

**Fix.** Remove `allowFontScaling={false}` from line 763 and instead bound the growth: `maxFontSizeMultiplier={1.6}` on the TextInput, and raise `messageInput.fontSize` from 13 to at least 15 so the base size is not already sub-minimum. Apply the same treatment to `styles.bubbleText` (fontSize 12) and `styles.bubbleTime` (fontSize 10).

### src/chat/ChatThread.tsx:543
**Issue.** A conversation name whose rendered width exceeds ~202dp at a 360dp window (~26 chars at fontSize 15, ~20 chars at Android fontScale 1.3, fewer at 2.0) overflows the non-shrinking contactInfo group and pushes the search and overflow buttons past the right edge, silently removing access to search/Mute/Block/Unfriend/Delete chat. Group names and email-style display names are the realistic trigger.

```
        <View style={styles.contactInfo}>          // contactInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 }  line 1284
          <View style={styles.avatar}>             // fixed 44x44, line 1285-1292
          ...
          <Pressable onPress={() => setShowProfile(true)}>
            <Text style={styles.contactName}>{conversationName}</Text>   // no numberOfLines, no maxWidth
```

**Impact.** `contactBar` is `justifyContent: 'space-between'` with both children at the RN default `flexShrink: 0`. On a 360dp phone the bar has 328dp: avatar 44 + gap 12 leaves 272dp, and `contactActions` needs ~72dp (two icon buttons at padding 6 + gap 4). Any display name whose rendered width exceeds ~200dp — 'Muhammad Abdul Rahman', a company address, or any name at all once fontScale hits 1.5 (contactName 15 -> 22.5) — shoves the search and ⋮ buttons past the right edge, where they are unreachable. The user loses access to Mute/Block/Unfriend/Delete-chat and message search entirely, with no visual indication anything is missing.

**Fix.** Add `flex: 1, minWidth: 0` to `contactInfo` (line 1284), wrap the name/status Pressable in `style={{ flex: 1 }}`, and give both Texts `numberOfLines={1}` — the same shape already used correctly for `meetingHeaderText: { flex: 1 }` at line 1723. Optionally add `flexShrink: 0` to `contactActions`.

### src/chat/PendingInvitation.tsx:72
**Issue.** With no ScrollView and a non-shrinking 151dp illustration, the Accept/Decline buttons fall off the bottom once the block exceeds the region: reached at Android fontScale 1.3 plus Display size = Largest (block ~476dp vs ~318dp available on a 360x640 phone), and in any short/landscape window. At fontScale 1.0 on a normal phone it fits with ~60dp to spare.

```
  wrap: {
    alignItems: 'center',
    flex: 1,
    paddingBottom: 40,
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  illustration: { height: 151, width: 220 },   // lines 89-90, no flexShrink
```

**Impact.** Content height is 48 + 151 + 36 + title(30) + 14 + desc + 4 + 40 + 40. At fontScale 1.0 that is ~420dp and fits. At Android 'Font size = Largest' (1.3) plus 'Display size = Largest' (effective width ~277dp, so the description wraps to 6-7 lines) the block reaches ~640dp on a device whose usable height is ~590dp — the Accept and Decline buttons are simply not on screen, and there is nothing to scroll. The user cannot accept a contact request at all until they turn their accessibility settings back down. Same failure on any 640dp-tall budget Android (360x640dp) and in unfolded-foldable/DeX landscape, where Android ignores the app.json `"orientation": "portrait"` lock.

**Fix.** Wrap the body in a ScrollView: replace the outer `<View style={styles.wrap}>` with `<ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">` (keep `flexGrow: 1` instead of `flex: 1` on `wrap`), and let the artwork give way first with `illustration: { height: 151, width: 220, flexShrink: 1 }` or by driving it from `useResponsive().illustrationHeight` (responsive.ts:15), which is exactly what App.tsx:6651 already does for `launchImage`.

### src/chat/ChatThread.tsx:1480
**Issue.** The full-screen photo viewer positions its close button and page counter with hard-coded dp offsets and never reads safe-area insets, even though `insets` is already in scope in this component.

```
  viewerClose: { position: 'absolute', top: 48, right: 24, zIndex: 2, padding: 6 },      // line 1480
  viewerCounter: { position: 'absolute', bottom: 40, alignSelf: 'center', ... },          // lines 1492-1500
```

**Impact.** app.json sets `"edgeToEdgeEnabled": true` (Android), so this transparent full-screen Modal draws under the system bars. On a 3-button-navigation Android phone (insets.bottom = 48dp) the '3 / 10' counter at `bottom: 40` renders behind the navigation bar and is unreadable. On a tall gesture-nav device the counter sits on top of the gesture pill. At the top, `top: 48` is below the 59dp safe-area inset of Dynamic Island iPhones and above the ~24dp inset of an older Android, so the X button is either crowding the cutout or floating in dead space depending on the device. In landscape on a cutout device, `right: 24` puts the X partly under the cutout because `insets.right` (up to 48dp) is ignored.

**Fix.** `ChatThread` already calls `useSafeAreaInsets()` at line 133 — pass it through: `style={[styles.viewerClose, { top: insets.top + 12, right: insets.right + 16 }]}` and `style={[styles.viewerCounter, { bottom: insets.bottom + 16 }]}`. Add `statusBarTranslucent` to the Modal at line 812 so the inset values match the window it actually renders in.

### src/chat/ChatThread.tsx:819
**Issue.** The gallery pager sizes its cells from the live `windowWidth` but never re-scrolls when that width changes, so any width change (rotation, fold/unfold, split-screen resize) leaves the pager stranded between two photos.

```
            getItemLayout={(_, index) => ({ length: windowWidth, offset: windowWidth * index, index })}
            renderItem={({ item }) => <GalleryPage uri={item.url} width={windowWidth} onClose={closeImageViewer} />}
            onMomentumScrollEnd={(e) =>
              setViewerPage(Math.round(e.nativeEvent.contentOffset.x / Math.max(windowWidth, 1)))
```

**Impact.** FlatList preserves `contentOffset` (in px), not the item index, across a layout change. Unfold a Galaxy Z Fold while viewing photo 6 of 10 (344dp -> 674dp) and the preserved offset 5*344 = 1720px now lands at 1720/674 = item 2.55 — the user sees the right half of photo 3 and the left half of photo 4 side by side, with the counter reading '3 / 10'. The same happens on any tablet or DeX window resize, and on Android large screens the `"orientation": "portrait"` lock in app.json does not apply, so a rotation reproduces it too.

**Fix.** Hold a ref to the list and re-anchor on width change: `useEffect(() => { if (viewerIndex !== null) listRef.current?.scrollToIndex({ index: viewerPage, animated: false }); }, [windowWidth]);` and add `onScrollToIndexFailed` so the initial mount is safe.

### src/chat/ChatThread.tsx:1700
**Issue.** The meeting-invite card is a fixed 264dp wide and is rendered outside the `bubbleWrap` percentage cap, so it is not bounded by the message list's content width.

```
  meetingCard: {
    width: 264,
    backgroundColor: '#FFFFFF',
    ...
  },                       // and at line 1119 it is a direct child of bubbleRow, bypassing bubbleWrap's maxWidth
```

**Impact.** The message list's content width is `W - 32` (messageListContent padding 16). A 360dp phone set to Android 'Display size = Largest' has an effective width of ~277dp, leaving 245dp — the 264dp card overflows the ScrollView by ~19dp and the copy-code button plus the right edge of the Join button are cut off the screen. In the other direction the card stays a 264dp postage stamp on a 674dp unfolded foldable or an iPad, next to text bubbles that are 431dp wide, so the thread looks visibly inconsistent.

**Fix.** Replace the literal with a bounded fluid width: `const { width } = useWindowDimensions();` then `style={[styles.meetingCard, { width: Math.min(320, width - 64) }]}`, or simply move the card inside `bubbleWrap` and use `alignSelf: 'stretch'` so it inherits the same cap as text bubbles.

### src/chat/AddContactModal.tsx:295
**Issue.** All three form fields use a fixed `height` rather than `minHeight`, so the text is vertically clipped as soon as the OS font scale grows, and the multiline members field cannot grow at all.

```
  input: {
    ...
    fontSize: 13,
    height: 40,          // line 295 — fixed
    paddingHorizontal: 14,
  },
  inputMultiline: {
    height: 76,          // line 299 — fixed, not minHeight/maxHeight
    paddingTop: 9,
    textAlignVertical: 'top',
  },
```

**Impact.** At Android 'Font size = Largest' (fontScale 1.3) the 13dp text renders at ~17px with a ~22dp line box, which still fits; at iOS accessibility sizes (up to 3.1) or Android 1.3 combined with a large-display OEM skin the line box exceeds 40dp and the email text is clipped top and bottom inside its border. The members field is worse: fixed at 76dp it shows ~2 lines at default scale and barely one at large scale, so a user pasting five member emails cannot see what they typed and there is no internal scroll cue.

**Fix.** Swap the fixed heights for minimums: `input: { ..., minHeight: 44, paddingVertical: 10 }` (drop `height`), and `inputMultiline: { minHeight: 76, maxHeight: 140, paddingTop: 9, textAlignVertical: 'top' }` so the members field grows and then scrolls.

### src/chat/AddContactModal.tsx:322
**Issue.** The dialog's action buttons are capped at fixed pixel widths and never stack, even though `responsive.ts` exports a `stackActions` flag designed for exactly this — a flag that is dead code, referenced nowhere in the repo.

```
  cancelBtn: { ... flex: 1, height: 38, maxWidth: 120 },   // lines 313-323
  submitBtn: { ... flex: 1, height: 38, maxWidth: 130 },   // lines 329-337
  submitText: { fontSize: 13, fontWeight: '500' },         // line 341-345
```

**Impact.** `stackActions: safeWidth < 360 || fontScale > 1.3` (responsive.ts:10) is defined and used by nothing (verified by grep across src/ and App.tsx). At fontScale 1.3+ 'Create group' renders at ~17px — roughly 105dp of glyphs plus the button's own centring — inside a 130dp cap and a fixed 38dp height, so the label wraps to two lines inside a box that cannot grow and the second line is clipped. On a 320dp phone the two capped buttons plus the 8dp gap sit in a 250dp row right-aligned, leaving a large dead area on the left while the labels themselves are cramped.

**Fix.** Consume the flag: `const { stackActions } = useResponsive();` then `<View style={[styles.actions, stackActions && { flexDirection: 'column-reverse' }]}>` and drop `maxWidth` (or lift it to `maxWidth: stackActions ? undefined : 130`), plus `minHeight: 44` instead of `height: 38` so a wrapped label is not clipped.

### src/chat/AddContactModal.tsx:96
**Issue.** A `KeyboardAvoidingView` is used as the direct child of a `statusBarTranslucent` Modal and the card is vertically centred, so on short screens the focused field and both action buttons end up behind the keyboard with no scroll-into-view.

```
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
  backdrop: { alignItems: 'center', ..., flex: 1, justifyContent: 'center', paddingHorizontal: 20 }   // lines 215-221
```

**Impact.** ResponsivePanel's only height guard is `modalMaxHeight = safeHeight - 24`, derived from `useWindowDimensions()` on the *app* window (responsive.ts:14) — a RN Modal on Android is a separate window, so that value is never reduced by the keyboard. In Group mode the card is ~382dp tall (header 40 + text block ~90 + two fields 180 + actions 38 + padding 32 + gaps). On a 360x640dp budget Android with a ~280dp keyboard, a vertically-centred 382dp card spans y=129..511 while the keyboard top is at y=360 — the Members field and both Cancel / Create group buttons are behind the keyboard and unreachable. Same on any 640-720dp-tall device and in split-screen.

**Fix.** Anchor rather than centre when the keyboard is up: add a `Keyboard.addListener` (the pattern already used in MeetingHome.tsx:97-103) and switch `backdrop` to `justifyContent: keyboardHeight ? 'flex-start' : 'center'` with `paddingTop`, or replace the KeyboardAvoidingView with `react-native-keyboard-controller`'s view. At minimum pass the measured keyboard height into ResponsivePanel so `modalMaxHeight` shrinks with it.

### src/chat/ChatThread.tsx:1565
**Issue.** The header overflow menu is absolutely positioned at a hard-coded `top: 96` with a fixed `width: 188`, but the two rows above it are font-scale dependent, so the menu overlaps the contact bar and its labels wrap inside the fixed width.

```
  actionsMenu: {
    position: 'absolute',
    top: 96,
    right: 12,
    width: 188,
    ...
  },
  sessionOptionText: { fontSize: 14, fontWeight: '500', color: '#111315' },   // line 1587, no numberOfLines
```

**Impact.** The header row is `paddingVertical: 12` around an 18dp title (~46dp) and the contact bar is a 44dp avatar plus `paddingBottom: 12` (~56dp) — 102dp total at fontScale 1.0, already 6dp below the menu's anchor. At fontScale 1.5 the title alone is 27dp so the stack reaches ~107dp and the menu covers the contact's name and online status. Inside the 188dp box, 'Unmute notifications' at fontScale 1.5 (21px) needs ~200dp but only has 188 - 32(padding) - 16(icon) - 10(gap) = 130dp, so it wraps to three lines and the four-row menu balloons past 300dp tall. On a 640dp device that pushes the Delete-chat row toward the composer.

**Fix.** Anchor the menu to the real geometry instead of a constant: capture the ⋮ button's position with `onLayout` (or `measureInWindow`) and position from that, clamping with the existing `fitPopover()` helper in lib/responsive.ts:21. Replace `width: 188` with `minWidth: 188, maxWidth: Math.min(280, width - 24)` and give `sessionOptionText` `flex: 1`.

### src/chat/ChatThread.tsx:530
**Issue.** The screen applies the bottom safe-area inset via SafeAreaView and the KeyboardAvoidingView sits inside it, so the inset padding stays in place when the keyboard opens and leaves a dead band between the composer and the keys.

```
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
```

**Impact.** On an iPhone with a home indicator (insets.bottom = 34) and on gesture-nav Android (24dp) or 3-button Android (48dp), opening the keyboard leaves a 24-48dp white strip between the composer's top border and the top of the keyboard — the composer visibly floats. It is most obvious on 3-button-nav Android phones, where it costs a full row of message list height on top of the keyboard.

**Fix.** Take `bottom` off the SafeAreaView edges (`edges={['top','left','right']}`) and pay the inset on the composer only when the keyboard is closed: `<View style={[styles.composer, { paddingBottom: 10 + (keyboardOpen ? 0 : insets.bottom) }]}>`, using the same `Keyboard.addListener` you add for the scroll-to-bottom fix.

### src/chat/ChatThread.tsx:1700
**Issue.** The video-meeting invite card is a hard-coded 264dp-wide box that is NOT inside the percentage-capped bubbleWrap, so it overflows the message list on narrow windows

```
meetingCard: {
    width: 264,   // line 1699-1700
... rendered at line 1116: <View style={[styles.bubbleRow, ...]}><View style={styles.meetingCard}>  — no bubbleWrap, no maxWidth
```

**Impact.** The list content box is W-32 (messageListContent padding 16, line 1642), so the card needs a 296dp window. It overflows on a 360dp phone set to Display size = Largest (~277dp effective, 245dp content -> 19dp over), in Android split-screen, and on small-window foldable/DeX layouts. Because bubbleRowTheirs is flex-start, a received invite loses its right edge — the Copy-code button (meetingCopy, a 40x40 box at the end of meetingActionsRow) is the first thing cut. A sent invite uses bubbleRowMine (flex-end), so the overflow goes the other way and the meeting icon/title are cut off the left. There is no horizontal scroll, so the clipped control is simply unreachable.

**Fix.** Drop the fixed width: wrap the card in styles.bubbleWrap like every other bubble, or replace `width: 264` with `alignSelf: 'stretch', maxWidth: 264` so it shrinks below 264 on narrow content boxes.

### src/chat/AddContactModal.tsx:329
**Issue.** Add-contact modal's action buttons have a fixed 38dp height, a 120/130dp maxWidth and overflow:'hidden', so their labels are clipped at large font scales

```
submitBtn: {
    alignItems: 'center',
    borderRadius: 19,
    flex: 1,
    height: 38,
    justifyContent: 'center',
    maxWidth: 130,
    overflow: 'hidden',
  },        // lines 329-337; cancelBtn is the same at height 38 / maxWidth 120 (lines 313-323)
  submitText: { ... fontSize: 13 ... }   // line 341-345, no allowFontScaling opt-out
```

**Impact.** On Android 14+, where the accessibility font slider reaches 2.0x, 'Send invite'/'Create group' render at 26px (~143dp) inside a 130dp cap, so the label wraps to two lines needing ~60dp inside a 38dp box that explicitly clips — the user sees a half-cut word on the only button that submits the form. The Cancel button (120dp cap) breaks first. The same modal's inputs are `height: 40` (line 288-297) with a 13dp font, which is already only ~6dp taller than a 2.0x line box.

**Fix.** Replace the fixed heights with minHeight plus paddingVertical, drop the maxWidth caps (or raise them with fontScale from useResponsive()), and remove overflow:'hidden' from the button now that the gradient Rect is absolutely filled anyway.

### src/meetings/MeetingHome.tsx:198
**Issue.** MeetingHome stacks three keyboard compensations that all fire together: the Android window is already adjustResize (AndroidManifest MainActivity), KeyboardAvoidingView behavior='height' (line 198) subtracts the keyboard height again, and ensureQuickJoinVisible (lines 84-92) does a third manual scrollTo, plus a 300*k spacer (line 319). On a short window the content visibly jumps and over-scrolls when 'Enter code or link' is focused, and because the spacer is gated on focus rather than on keyboard visibility, a device with a hardware keyboard gets 300dp of blank scroll space under the content. Nothing is permanently unreachable — the ScrollView still scrolls.

```
<KeyboardAvoidingView style={styles.scroll} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
// ... line 89-93
const keyboardTop = Dimensions.get('window').height - keyboardHeight;
const overlap = y + h - keyboardTop + Math.round(24 * k);
if (overlap > 0) {
  scrollRef.current?.scrollTo({ y: scrollYRef.current + overlap, animated: true });
}
// ... line 319
{codeFocused ? <View style={{ height: Math.round(300 * k) }} /> : null}
```

**Impact.** android/app/src/main/AndroidManifest.xml declares `android:windowSoftInputMode="adjustResize"`, so the OS already shrinks the window when the keyboard opens; `behavior="height"` then shrinks the KeyboardAvoidingView by the keyboard height a second time. On a short phone — 360x640dp budget Android, or any device in split-screen — with a ~280dp keyboard, the usable scroll viewport collapses toward ~80dp: after tapping "Enter code or link" the user sees a sliver of content with the header and the Join button jumping around, and the manual scrollTo then over-scrolls it further because `Dimensions.get('window').height` is display-based and does not shrink with the resized window, so `keyboardTop` is computed in a different coordinate space than `measureInWindow`'s y. The 300dp spacer also appears whenever the field merely has focus, so on a tablet/Chromebook/foldable with a hardware keyboard attached (no soft keyboard) the user gets 300dp of empty scroll void under the content.

**Fix.** On Android with adjustResize, pass `behavior={Platform.OS === 'ios' ? 'padding' : undefined}` (the OS already handles it) and delete the manual `ensureQuickJoinVisible` scroll and the conditional 300dp spacer. If a nudge is still wanted, replace all three with the ScrollView's own `automaticallyAdjustKeyboardInsets` (iOS) plus a single `contentInset`/`scrollToFocusedInput`, and gate the spacer on `keyboardHeight > 0` rather than on `codeFocused`.

### src/meetings/MeetingRoom.tsx:903
**Issue.** chatCardBottom (MeetingRoom.tsx:903) adds insets.bottom unconditionally although the comment scopes it to Android edge-to-edge; there is no Platform guard even though the keyboard listener 45 lines up is platform-split. On iPhones with a home indicator (insets.bottom 34) the in-meeting chat/People/Settings card is lifted 42pt higher than needed, leaving a permanent dark strip between the composer and the keyboard and costing 42pt of message list. Cosmetic, not blocking.

```
const chatCardBottom = keyboardHeight > 0
    ? Math.max(0, keyboardHeight - controlBarSpace + insets.bottom + 8)
    : 0;
```

**Impact.** There is no `Platform.OS` guard here, while the listener two blocks up (line 856) is explicitly platform-split (`keyboardWillShow` on iOS, `keyboardDidShow` on Android). On every notched/Dynamic-Island iPhone (insets.bottom = 34pt) the in-meeting chat card is lifted 34pt + 8 = 42pt higher than the keyboard actually needs, leaving a permanent dead strip of dark stage showing between the composer and the top of the keyboard, and stealing 42pt of message list on exactly the devices with the least room. On an iPhone SE (insets.bottom = 0) it behaves correctly, so the bug only shows on the modern fleet.

**Fix.** Gate the fudge to the platform it was written for: `const kbFudge = Platform.OS === 'android' ? insets.bottom + 8 : 8;` then `keyboardHeight - controlBarSpace + kbFudge`. Better still, replace the whole hand-rolled calculation with `useAnimatedKeyboard`/`KeyboardAvoidingView` on the card, or subscribe to `keyboardWillChangeFrame` and use `screenHeight - endCoordinates.screenY` which is inset-agnostic on both platforms.

### src/meetings/MeetingRoom.tsx:2332
**Issue.** noticeToast (MeetingRoom.tsx:2321-2334) is pinned at `top: 96` from the top of the full-bleed screen View with no insets.top term, while the header at line 1066 uses `paddingTop: insets.top + 10` and the chatToast at 1470 uses `top: insets.top + 8`. The header's bottom edge sits at insets.top + 63, so on any device reporting a status-bar inset of 34dp or more (iPhone 14/15/16 Pro at 59, Samsung punch-hole devices at 48-56) the toast lands on top of the Meeting Time / Participants row and the Live/Recording pill and covers them (zIndex 40). In immersive mode, where the header and status bar are hidden, it still floats 96dp down for no reason.

```
noticeToast: {
    ...
    maxWidth: '92%',
    position: 'absolute',
    top: 96,
    zIndex: 40,
  },
// contrast, line 1470:
<Pressable style={[styles.chatToast, { top: insets.top + 8 }]}
```

**Impact.** The header's bottom edge sits at `insets.top + 55` (paddingTop insets.top+10 + title lineHeight 20 + gap 4 + meta row 17 + paddingBottom 4). On an iPhone 14/15/16 Pro (insets.top = 59pt) that is 114pt, so the toast at 96 lands *on top of* the "Meeting Time 00:00 / N Participants" row and the Live/Recording pill, with `zIndex: 40` guaranteeing the toast wins. Same on Samsung devices that report a 48–56dp status-bar inset with a punch-hole cutout. On an older 24dp-status-bar phone the header ends at 79 and the toast clears it, which is why this passes on a test device and fails on the current flagship fleet. In immersive mode (header hidden) the toast also floats 96dp down for no reason.

**Fix.** Move the offset into the JSX the way chatToast already does: `<View style={[styles.noticeToast, { top: insets.top + (isImmersive ? 12 : 66) }]}>` and drop `top: 96` from the stylesheet — or better, render both toasts from one inset-aware wrapper so they cannot diverge again.

### src/meetings/MeetingRoom.tsx:1061
**Issue.** MeetingRoom is mounted bare at App.tsx:3031 (no SafeAreaView, unlike MeetingScreen at App.tsx:1385 which uses edges={['left','right','bottom']}), its root style `screen` (2530) is only backgroundColor + flex:1, and insets.left/insets.right are never read anywhere in the file — the six insets references at 899/904/1066/1404/1470/1500 are all top or bottom. With edgeToEdgeEnabled:true and no resizeableActivity=false, the screen runs landscape on tablets, unfolded foldables and in multi-window, where the display cutout and the nav bar move to a side edge; header and stage only have 16dp of horizontal padding, so the title and the edge column of video tiles slide under the notch and the opposite stage edge goes under the nav bar. iPad Slide Over clips the same way.

```
return (
    <View style={styles.screen}>
      <StatusBar hidden={isImmersive} />
// screen (2530-2533) is just:
  screen: {
    backgroundColor: '#1A1D21',
    flex: 1,
  },
```

**Impact.** App.tsx mounts `<MeetingRoom .../>` directly at line 3031 with no SafeAreaView wrapper (unlike MeetingScreen at line 1384, which uses `edges={['left','right','bottom']}`). `android:screenOrientation="portrait"` does not save this: Android 12L+ ignores orientation requests on large-screen displays, so an unfolded Pixel Fold / Galaxy Z Fold and most tablets run this screen in landscape, and multi-window ignores the lock on every device. In landscape the display cutout inset moves to the left or right edge (typically 32–48dp) and the gesture/nav bar can take the right edge; `header` and `stage` only have 16dp of horizontal padding/margin, so the "Meeting" title and the left column of video tiles slide under the notch, and the right edge of the stage disappears under the nav bar. iPad Slide Over produces the same class of clipping.

**Fix.** Either wrap the returned tree in `<SafeAreaView style={styles.screen} edges={['left','right']}>` (keeping the manual top/bottom handling), or add `paddingLeft: insets.left, paddingRight: insets.right` to `styles.screen` at the JSX level: `<View style={[styles.screen, { paddingLeft: insets.left, paddingRight: insets.right }]}>`. Do the same for the `waitingScreen` branch at line 1039.

### src/meetings/MeetingPreview.tsx:264
**Issue.** The camera preview panel is a fixed `height: 280` inside a dialog whose total content is ~422dp, with no viewport-relative cap, so on a short viewport the preview alone consumes the whole modal and pushes Cancel/Join below the fold.

```
previewPanel: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    height: 280,
    overflow: 'hidden',
    position: 'relative',
  },
```

**Impact.** ResponsivePanel caps the card at `modalMaxHeight = safeHeight - 24` (src/lib/responsive.ts:14). Card content = 16 padding + 32 header + 18 gap + 280 preview + 18 gap + 42 actions + 16 padding = 422dp. On an Android device in split-screen (~safeHeight 300–380dp), on a foldable cover display, or on a large-screen device forced landscape, maxHeight drops to ~276–356 and the preview alone (280) fills or exceeds it — the user opens "New meeting", sees their camera, and the Create/Join and Cancel buttons are entirely off-screen until they discover they can scroll inside the card. The audio/video toggles are `position:'absolute', bottom:10` *inside* the preview panel (lines 243-249), so they scroll away with it too and there is no visible affordance that more content exists.

**Fix.** Make the preview viewport-relative and give it a floor: `const { height } = useWindowDimensions();` then `<View style={[styles.previewPanel, { height: Math.min(280, Math.max(140, height * 0.38)) }]}>`. Drop `height: 280` from the stylesheet. Optionally hide the preview entirely when `useResponsive().compact` is true and show just the two toggles.

### src/meetings/MeetingRoom.tsx:1788
**Issue.** The screen-share approval dialog is sized `width: '84%'` with no maxWidth, unlike every other dialog in the same file, so it scales without limit on wide viewports.

```
approvalCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    gap: 14,
    padding: 20,
    width: '84%',
  },
```

**Impact.** `centerCard` caps at `maxWidth: 360` (line 1919), `moreCard` at `maxWidth: 260` (line 2297), and MeetingPreview's card at `maxWidth: 430` — `approvalCard` is the only one without a cap. On an iPad (app.json sets `supportsTablet: true`) in portrait at 810pt, or on an unfolded foldable at ~840dp, the "Waiting for the host to allow you to share your screen..." dialog stretches to 680–860dp wide with a single centred line of 14pt text and a lone Cancel button — a full-bleed white band that reads as a broken layout rather than a dialog.

**Fix.** Add `maxWidth: 360` to `approvalCard` to match `centerCard`, i.e. `approvalCard: { ..., width: '84%', maxWidth: 360 }`.

### src/meetings/MeetingRoom.tsx:2224
**Issue.** The immersive-mode restore button is pinned at a hardcoded `bottom: 24` and ignores `insets.bottom`, while the control pill 1200 lines earlier correctly uses `Math.max(insets.bottom + 12, 28)` for the same edge.

```
immersiveExit: {
    ...
    bottom: 24,
    height: 44,
    position: 'absolute',
    right: 24,
    width: 44,
// contrast, line 1404:
<View style={[styles.controls, { marginBottom: Math.max(insets.bottom + 12, 28) }]}>
```

**Impact.** On an iPhone with a 34pt home indicator the 44pt button occupies 24–68pt from the bottom edge, so its lower ~10pt sits inside the home-indicator area where an upward swipe is claimed by the system — the user taps to exit fullscreen and instead triggers the app switcher, and immersive mode becomes hard to leave (there is no other exit control: the header, control pill and all panels are hidden when `isImmersive` is true). Same on Android 3-button navigation where insets.bottom is 48dp: the button is then fully behind the navigation bar and completely untappable. It also ignores `insets.right`, so in landscape on a cutout device it can sit under the side nav bar.

**Fix.** Apply the inset in the JSX like the control bar does: `<Pressable style={[styles.immersiveExit, { bottom: Math.max(insets.bottom + 12, 24), right: Math.max(insets.right + 12, 24) }]} onPress={() => setIsImmersive(false)}>` and remove the hardcoded `bottom: 24` / `right: 24` from the stylesheet.

### src/meetings/MeetingRoom.tsx:2055
**Issue.** Chat bubbles have a hardcoded maxWidth: 260 and rely on shrinking that React Native does not do by default (flexShrink is 0, not 1), so incoming messages overflow the chat card and get clipped on narrow windows.

```
chatBubble: {
    maxWidth: 260,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
// row context, line 2097:
  chatMessageRow: { alignItems: 'flex-end', flexDirection: 'row', gap: 10 },
// avatar, line 2386: operatorAvatar { height: 32, width: 32 }
// clipper, line 1815: chatCard { left: 12, right: 12, overflow: 'hidden', position: 'absolute' }
```

**Impact.** On a 320dp-wide device (Android Go / Galaxy A0x phones, a Z Flip cover display, or a 360dp phone in Android split-screen) the chat card is 296dp wide, chatList strips 16dp each side and chatContent 4dp each side, leaving 256dp for the row. A message from another participant renders operatorAvatar 32 + gap 10 + bubble, and because RN defaults flexShrink to 0 the bubble sits at its full maxWidth of 260 instead of shrinking, making the row 302dp. chatCard has overflow:'hidden', so roughly 26dp of the bubble — the last characters of every long line — is cut off at the right edge with no way to reveal it. At 360dp the row is 302 against 296 available, so the longest messages still clip by a few dp; only 375dp and wider is safe.

**Fix.** Add flexShrink: 1 to chatBubble and replace maxWidth: 260 with a percentage (e.g. maxWidth: '78%') so the bubble is measured against the actual card width rather than a Figma-frame constant.

### src/meetings/MeetingRoom.tsx:2220
**Issue.** The immersive-mode restore button — the only visible control once the header and control pill are hidden — is positioned at fixed bottom:24 / right:24 with no safe-area insets.

```
immersiveExit: {
    ...
    bottom: 24,
    height: 44,
    position: 'absolute',
    right: 24,
    width: 44,
    zIndex: 30,
  },
// render, line 1450-1454: {isImmersive && (<Pressable style={styles.immersiveExit} onPress={() => setIsImmersive(false)}>
```

**Impact.** app.json sets android.edgeToEdgeEnabled: true, so the app draws behind the system bars. On a phone with 3-button navigation (insets.bottom ≈ 48dp) the lower 24dp of this 44dp button sits behind the navigation bar and taps there go to the system, leaving a ~20dp strip to hit; on iPhone the lower 10dp falls in the home-indicator swipe zone. In landscape on a tablet or unfolded foldable — reachable per the configChanges/multi-window analysis above — the nav bar moves to the right edge, and right:24 with no insets.right puts the button entirely behind it, so there is no way out of immersive mode except backing out of the meeting. isImmersive is entered by any participant tapping the maximise chip on a tile (styles.tileFullscreen, line 1734), so this is a one-tap trap.

**Fix.** Offset the button by the insets: style={[styles.immersiveExit, { bottom: 24 + insets.bottom, right: 24 + insets.right }]}, the same pattern the control pill already uses at line 1404.

### src/remote/RemoteControl.tsx:1804
**Issue.** lostButtons is { flexDirection: 'row', gap: 12 } (line 1804) and both children use paddingHorizontal: 32 with no flexShrink and no numberOfLines (lostSecondary 1805-1811, lostPrimary 1813-1818, texts at 1177 and 1183). 'Back to devices' at 14pt is ~105dp of glyphs + 64dp padding, 'Reconnect' ~65 + 64, plus the 12dp gap = ~310dp against the 312dp of usable width inside lostRoot's padding 24 (line 1784-1790). It fits only at font scale 1.0 on a 360dp phone; at Android 'Large' (~1.15x) or on a 320dp device the row overflows and the orange Reconnect button is visibly cut at the right edge, and at 'Largest' (~1.5x) roughly half of it is clipped.

```
lostButtons: { flexDirection: 'row', gap: 12 },
  lostSecondary: { paddingHorizontal: 32, paddingVertical: 12, borderRadius: 8, borderWidth: 1, ... },
  lostPrimary: { paddingHorizontal: 32, paddingVertical: 12, borderRadius: 8, backgroundColor: '#FF8A00' },
  lostSecondaryText: { fontSize: 14, fontWeight: '500', ... }
```

**Impact.** 'Back to devices' at 14pt is ~105dp of glyphs + 64dp of horizontal padding = ~169dp; 'Reconnect' is ~63 + 64 = ~127dp; plus the 12dp gap = ~308dp against 312dp of usable width on a 360dp phone (lostRoot padding 24). It fits by 4dp at font scale 1.0 and fails immediately beyond that: at Android's 'Large' font setting (1.15x) the row needs ~333dp and the orange Reconnect button is clipped at the right edge; on a 320dp phone (272dp usable) it is clipped at font scale 1.0. Neither button has flexShrink and the Texts have no numberOfLines, so nothing reflows — the primary recovery action is simply off-screen after a dropped session.

**Fix.** Add `flexWrap: 'wrap', justifyContent: 'center'` to lostButtons and give each button `flexShrink: 1, minWidth: 120` with `paddingHorizontal: 20`, or stack them vertically (`flexDirection: windowDims.width < 380 ? 'column' : 'row'`) with `alignSelf: 'stretch'`.

### src/remote/RemoteControl.tsx:1612
**Issue.** chatPanelWrap is { position: 'absolute', left: 12, right: 12, zIndex: 90 } (line 1612) and its only inset-aware property is applied at the call site: style={[styles.chatPanelWrap, { bottom: bottomInset + 14 }]} (line 1322). insets.left / insets.right are never consulted, unlike the top-right disconnect (line 1299), the collapsed tab (line 1306) and the toolbar (line 1379), which all do. In landscape with 3-button navigation the nav bar occupies a side inset of ~48dp, so the orange Send button (chatSend paddingHorizontal 16 inside chatComposer paddingHorizontal 10, lines 1649-1676) sits underneath it, and a display cutout on the opposite side clips the 'Chat — <device>' header (line 1329).

```
chatPanelWrap: { position: 'absolute', left: 12, right: 12, zIndex: 90 },
// used as: style={[styles.chatPanelWrap, { bottom: bottomInset + 14 }]}   // line 1322 — only `bottom` is inset-aware
```

**Impact.** In landscape on any Android device with gesture navigation or 3-button nav, react-native-safe-area-context reports insets.right of ~24-56dp; on notched phones insets.left is ~34-48dp. The orange 'Send' button lives at the panel's right edge (chatComposer paddingHorizontal 10 + chatSend paddingHorizontal 16 = 26dp from the edge), so it lands squarely inside the system gesture strip: taps are consumed by the OS back/home gesture instead of sending the message, and the button is visually overlaid by the nav bar. On the left, the message bubbles and the 'Chat — <device>' header are clipped by the cutout. The toolbar right below carries a comment about this precise hazard ('must clear insets.right or the system swallows the taps') but chat was never given the same treatment.

**Fix.** Change the inline style to `{ left: insets.left + 12, right: insets.right + 12, bottom: bottomInset + 14 }` and remove the static left/right from chatPanelWrap. Give the sheet overlay the same treatment (see the SafeAreaView at line 1418, which uses edges={['bottom']} only).

### src/remote/RemoteControl.tsx:1380
**Issue.** keyboardHeight is tracked (lines 356-368) but consumed in exactly one place, gated to iOS: `Platform.OS === 'ios' && keyboardHeight > 0 ? { bottom: keyboardHeight } : null` (line 1380). Neither bottomInset (line 791) nor surfaceH (line 799) contains a keyboardHeight term, so the remote picture is never lifted or shrunk for the IME. On iOS, where the window is not resized, tapping a text field in the lower half of the remote desktop (the usual case) leaves the field, the caret and everything typed behind the on-screen keyboard, which covers 35-45% of a portrait phone and 55-60% in landscape. The chat KeyboardAvoidingView is also inert on Android (behavior={Platform.OS === 'ios' ? 'padding' : undefined}, line 1321).

```
Platform.OS === 'ios' && keyboardHeight > 0 ? { bottom: keyboardHeight } : null,   // line 1380
<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} ...>   // line 1321
const bottomInset = toolbarCollapsed ? insets.bottom : TOOLBAR_HEIGHT + insets.bottom;   // line 791 — no keyboardHeight term
const surfaceH = Math.max(0, windowDims.height - surfaceTop - bottomInset);   // line 799
```

**Impact.** app.json sets "edgeToEdgeEnabled": true and no softwareKeyboardLayoutMode, so on Android 15+ the window is not resized for the IME and safe-area insets do not include it — meaning the absolutely-positioned toolbar (bottom: 0) and the chat panel (bottom: bottomInset + 14) sit underneath a keyboard that covers 35-45% of the screen. On an Android phone: opening chat and tapping the input hides the composer and the Send button entirely behind the keyboard; tapping the toolbar's keyboard icon to type into the host leaves that same toolbar unreachable. On BOTH platforms surfaceH ignores keyboardHeight, so the remote picture is never lifted or shrunk — after tapping a text field in the lower half of the remote desktop (the usual place), the field, the caret and everything you type are behind the on-screen keyboard. Worst on short-viewport devices and in landscape, where the IME can take 55-60% of the height.

**Fix.** Include the keyboard in the reserved chrome on both platforms: `const bottomInset = (toolbarCollapsed ? insets.bottom : TOOLBAR_HEIGHT + insets.bottom) + keyboardHeight;` and drop the `Platform.OS === 'ios'` guard on the toolbar's `{ bottom: keyboardHeight }`. For the chat panel use `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}` or, better, drive both from the already-tracked keyboardHeight so Android's edge-to-edge non-resizing window is handled explicitly.

### src/remote/RemoteControl.tsx:1373
**Issue.** The toolbar double-applies the horizontal safe-area insets — SafeAreaView with edges left/right adds them as padding and the inline style adds them again as margin — so in landscape the bar is inset by twice the cutout/nav-bar width on each side.

```
<SafeAreaView
          edges={['bottom', 'left', 'right']}
          style={[
            styles.toolbar,
            { marginLeft: insets.left, marginRight: insets.right },
```

**Impact.** react-native-safe-area-context's SafeAreaView defaults to mode 'padding', so edges left/right already add paddingLeft/paddingRight = insets. Adding marginLeft/marginRight on top consumes 2 x insets.left + 2 x insets.right. On a landscape phone with a 48dp cutout inset and a 48dp gesture bar that is 192dp of the width gone, leaving visible dark gutters at both ends of the white bar (it no longer spans the screen) and pushing the 344dp content group inward; combined with toolbarRow's own 44dp of padding, the bar needs 580dp before it starts clipping — reachable on a small landscape phone at raised display size. The visual result is a white bar that looks mis-centred and floats away from the screen edges.

**Fix.** Pick one mechanism. Simplest: drop the inline `{ marginLeft: insets.left, marginRight: insets.right }` and keep `edges={['bottom','left','right']}`, or keep the margins and change the edges to `['bottom']`.

### src/remote/RemoteControl.tsx:796
**Issue.** A hardcoded 52dp control band is subtracted from the video height for mobile hosts regardless of orientation or screen size, spending a fixed portrait-tuned constant on the axis that is scarcest in landscape — and reserving 52dp for a control that is only 40dp tall.

```
const controlBand = hostIsMobileDevice ? 52 : 0;
  const surfaceTop = insets.top + controlBand;
  const surfaceW = Math.max(0, windowDims.width - insets.left - insets.right);
  const surfaceH = Math.max(0, windowDims.height - surfaceTop - bottomInset);
```

**Impact.** For a mobile host the rotate chip is not rendered at all (line 1289) — the only thing the band protects is the 40x40dp topDisconnect button. In landscape on a 412x915 phone (viewport 412dp tall) the band eats 12.6% of the height on top of the 64dp toolbar, leaving surfaceH ≈ 412 - 52 - 64 - insets.bottom ≈ 272dp for the picture; on a 360dp-tall landscape phone it drops to ~220dp. Since the band is a constant it does not shrink when vertical space is scarce, so phone-to-phone sessions in landscape show a noticeably smaller remote screen than they need to, and the wasted strip is empty dark background.

**Fix.** Make the band proportional and orientation-aware: `const controlBand = hostIsMobileDevice ? Math.min(52, Math.max(0, windowDims.height * 0.06)) : 0;`, or drop it to 44 in landscape (`windowDims.width > windowDims.height ? 44 : 52`). Better still, measure the disconnect button's real height rather than assuming 52.

### src/remote/RemoteControl.tsx:956
**Issue.** 'Scaled (fill screen)' deliberately overflows the surface but there is no local pan gesture — one finger is a remote drag, two fingers is a remote scroll — and pinch is disabled outright for mobile hosts, so in fill mode the overflowing part of the host screen is permanently unreachable.

```
if (!hostIsMobileDevice && Math.abs(dist - g.pinchStartDist) > 14) g.twoFingerMode = 'zoom';
// baseRect fill branch (line 780): w = Math.max(size.w, size.h * ar); h = w / ar;
// menu item is offered unconditionally (line 1153):
{ label: 'Scaled (fill screen)', ..., onPress: () => { setFitMode('fill'); resetZoom(); } },
```

**Impact.** baseRect's fill branch returns a rect wider or taller than the surface with a negative x/y (centred overflow), and clampRect is only ever applied during a pinch. For a phone viewer in landscape (surface ~851x272dp) connected to a portrait Android host (aspect ~0.46), fill produces an 851 x 1846dp rect inside a 272dp-tall surface: the user sees ~15% of the host's screen height, centred, with no gesture that pans it — and because hostIsMobileDevice is true, the pinch branch that could pan is skipped entirely, so the only escape is switching back to Best fit. 'Reset zoom' is not offered either because isZoomed stays false. The severity scales with how different the viewer and host aspect ratios are, i.e. it is invisible on matched phones and total on a landscape-phone-to-portrait-host pairing.

**Fix.** Either add a genuine one-finger pan when `contentRect` exceeds the surface (route the drag through clampRect instead of sending mousedown/mousemove), or hide the 'Scaled (fill screen)' item when no pan gesture is available (`hostIsMobileDevice`), or allow the two-finger steady-distance drag to pan locally instead of sending a wheel event whenever the content overflows the surface.

### src/remote/RemoteControl.tsx:1610
**Issue.** Several primary controls are below the 48dp Android / 44pt iOS minimum touch target and carry no hitSlop, with the smallest one placed hard against the right screen edge where the system gesture strip competes for the touch.

```
hideButton: { height: 40, width: 24, alignItems: 'center', justifyContent: 'center' },
  toolButton: { height: 40, width: 40, alignItems: 'center', justifyContent: 'center' },
// chat close, line 1330:
<Pressable hitSlop={8} onPress={() => setChatOpen(false)}><Feather name="x" size={16} ... /></Pressable>
```

**Impact.** The Hide (chevron-down) button is a 24 x 40dp target — roughly a quarter of the recommended area — and it is the last child of a space-between row, so it sits within ~22dp of the right edge, overlapping the Android back-gesture strip in portrait and the side nav bar in landscape; users repeatedly trigger the system back gesture (which opens the disconnect confirm) instead of hiding the bar. The five 40x40dp tool buttons are also under-size and, on a 360dp phone, have only ~3dp between them (see the toolbar-width finding), so adjacent mis-taps open the wrong sheet. The chat close button is a 16dp icon with hitSlop 8 = 32x32dp effective, missable for users with motor impairment or on a small screen.

**Fix.** Give hideButton `width: 44, height: 44` (or keep the visual size and add `hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}`), raise toolButton to 44x44 with `flex: 1` so spacing comes from the flex distribution, and raise the chat close hitSlop to 14. Keep the whole row clear of `insets.right` (see the double-inset finding).

### src/remote/RemoteControl.tsx:1650
**Issue.** Text and TextInput are placed inside fixed-height containers with no lineHeight and no allowFontScaling/maxFontSizeMultiplier anywhere in the file, so at raised OS font-size settings the labels are vertically clipped inside boxes that cannot grow.

```
chatComposer: { height: 56, ... },
  chatInput: { flex: 1, height: 36, borderRadius: 8, ..., fontSize: 13, color: '#111315' },
  chatHeader: { height: 40, ... },
  connectingChip: { ..., height: 32, borderRadius: 16, paddingHorizontal: 14 },
  connectingChipText: { fontSize: 12, color: '#111315' },
```

**Impact.** grep for allowFontScaling / maxFontSizeMultiplier / fontScale across src/remote/ returns nothing, so every fontSize is multiplied by the OS setting. On Android at font size 'Largest' combined with 'Largest' display size the effective multiplier reaches ~2.0, and iOS accessibility text sizes go far higher: the 13pt chat composer text becomes ~26pt with a ~35dp line box inside a 36dp-tall TextInput — descenders are cut and the caret sits half outside the field; the 12pt 'Connecting safely' chip text becomes ~24pt inside a fixed 32dp pill, clipping top and bottom; the 13pt 'Chat — <device>' header (numberOfLines 1) is cropped by its 40dp row. This affects precisely the low-vision users a remote-support product is most used by.

**Fix.** Either cap scaling on chrome that lives in fixed boxes (`maxFontSizeMultiplier={1.3}` on those Text/TextInput elements) or, preferably, replace the fixed heights with `minHeight` + `paddingVertical` and add explicit `lineHeight` so the boxes grow: chatComposer `minHeight: 56`, chatInput `minHeight: 40` with `paddingVertical: 8`, chatHeader `minHeight: 40`, connectingChip `minHeight: 32` with `paddingVertical: 6`.

### src/remote/RemoteControl.tsx:780
**Issue.** 'Scaled (fill screen)' mode makes most of the remote desktop permanently unreachable on tall phones, because there is no pan gesture to recover the cropped area

```
w = Math.max(size.w, size.h * ar);   // baseRect, fill branch, line 780
    return { x: (size.w - w) / 2, y: (size.h - h) / 2, w, h };   // line 783
  surface: { backgroundColor: '#0A0A0A', overflow: 'hidden' },   // line 1509
```

**Impact.** Selecting View > 'Scaled (fill screen)' (line 1153) on a 20:9 phone (412x915dp) with a 16:9 host gives w = max(412, 851*1.778) = 1513dp against a 412dp-wide surface, which is clipped by overflow:'hidden' — only the horizontal centre 27% of the remote desktop is on screen, and the Start button, system tray and every window edge are outside it. The single-finger drag is a host mouse drag (lines 1013-1023) and a steady two-finger drag is classified as 'scroll' and forwarded as wheel events to the host (lines 992-1000), so there is no local pan: the only way to move the viewport is an awkward pinch that changes finger distance (lines 960-987). The cropping is purely a function of the viewer's aspect ratio — a 4:3 tablet loses ~11%, a 21:9 phone loses ~75% — which is exactly the 'works on my tablet, useless on my phone' behaviour being reported.

**Fix.** Clamp fill mode to something reachable (e.g. cover only the shorter axis, or cap the scale at ~1.5x base) AND give the surface a real one-or-two-finger pan when contentRect is wider/taller than the surface, reusing clampRect (line 823) which already implements the correct bounds.

### src/remote/RemoteControl.tsx:1379
**Issue.** The bottom toolbar applies the left/right safe-area insets twice — once as SafeAreaView padding and again as margin

```
<SafeAreaView
  edges={['bottom', 'left', 'right']}
  style={[
    styles.toolbar,
    { marginLeft: insets.left, marginRight: insets.right },   // line 1379
```

**Impact.** react-native-safe-area-context's SafeAreaView applies the listed edges as PADDING, so with edges left/right plus these margins the horizontal inset is counted twice. On any phone in landscape with 3-button navigation (insets.right ~48dp) the white bar stops 48dp short of the screen edge — leaving a strip of black video showing beside it — and the End/Hide buttons are then pushed a further 48dp inward, i.e. ~96dp from the physical edge instead of the intended 22dp. The same doubling applies on the left for a landscape display cutout. Invisible in portrait (insets.left/right are 0), which is why it survived.

**Fix.** Drop 'left' and 'right' from the SafeAreaView edges and keep the explicit margins (or keep the edges and delete the margin override) — one inset application, not both.

### src/remote/RemoteControl.tsx:1612
**Issue.** No max-width on any floating surface: on tablets and unfolded foldables the chat panel and the bottom sheets stretch the full display width

```
chatPanelWrap: { position: 'absolute', left: 12, right: 12, zIndex: 90 },   // line 1612
  chatBubble: { maxWidth: '82%', ... },   // line 1639
  sheet: { ... borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 8, maxHeight: 520 },   // lines 135-141
```

**Impact.** app.json sets ios.supportsTablet: true, and the Android build has no tablet exclusion, so this viewer runs on 1024-1366dp iPads and on ~673-841dp foldable inner displays. chatPanelWrap has no maxWidth or alignSelf, so the chat panel becomes a ~1000-1340dp-wide card: a one-line message bubble may stretch to 82% of that (~1000dp), the composer's Send button sits at the far right corner well outside thumb reach, and the sheet rows put their 14pt label at the extreme left with the orange active dot ~1000dp away at the right. Nothing in the file caps a floating surface's width the way styles.confirmCard does (maxWidth: 468, line 1688) — that cap exists for the confirm card only.

**Fix.** Give chatPanelWrap and sheetStyles.sheet the same treatment as confirmCard: width '100%', maxWidth ~468-560, alignSelf 'center' (and for the sheet, centre it with side radii on large widths).

### src/devices/DeviceManagement.tsx:601
**Issue.** cardButtons (601-606) has no flexWrap and no shrinkable children, so once 'Cancel' + the primary button exceed the card's inner width (232dp at 320dp / Display size Largest, 272dp at 360dp) the overflow spills off the LEFT of the row and is clipped by the card's ScrollView. Reached at ~fontScale 1.5 on a 232dp card and ~fontScale 2.0 on a 272dp card. The Cancel button becomes a half-cut, untappable stub (Android does not dispatch touches outside the clipping parent); the user can still dismiss via the backdrop and the primary button still works.

```
cardButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
```

**Impact.** 320-360dp-wide phones (5" devices, or any phone with Android Display size = Largest) at Android font size >= 1.5x. Card inner width is 232-272dp; 'Cancel' (~95-116dp incl. 32dp padding) + 'Add device' (~137-172dp, minWidth 104) + 10dp gap measures 242-298dp. RN flex items have flexShrink 0, so nothing gives: with justifyContent 'flex-end' the overflow spills off the START of the row, i.e. the Cancel button is pushed outside the white card and is clipped by the ScrollView it sits in. On Android touches outside the parent's bounds are never dispatched, so the user sees a half-cut 'ancel' and cannot dismiss the Add device / Rename / Assign-to-groups dialog with anything but the backdrop.

**Fix.** Give the row `flexWrap: 'wrap'` and add `flexShrink: 1` to both `cancelButton` and `primaryButton`; better, import `getResponsiveLayout`/`useResponsive` and when `stackActions` is true (safeWidth < 360 || fontScale > 1.3) switch `cardButtons` to `flexDirection: 'column-reverse'` with `alignSelf: 'stretch'` on each button. Also change `primaryButton`/`cancelButton` `height: 40` to `minHeight: 40, paddingVertical: 8` so the label is not vertically clipped.

### src/devices/DeviceManagement.tsx:507
**Issue.** menuRow (507-513) uses a rigid height: 48 while menuLabel (514) and the Text at line 83 carry no flex, flexShrink or numberOfLines. On the device-menu sheet, 'Add device by access key' and 'Remove from account' wrap to two lines at fontScale ~1.5 on a 320dp-wide window (Display size = Largest) and ~1.75 at 360dp; the two-line block is vertically centred in a 48dp box so it is clipped or collides with the neighbouring row. Legibility only — the rows stay tappable.

```
menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    height: 48,
  },
```

**Impact.** 320-360dp-wide phones at Android font size >= 1.5x (and any device at 2.0x). The label Text (line 83: `<Text style={[styles.menuLabel, danger ? styles.menuLabelDanger : null]}>{label}</Text>`) has neither `flex: 1` nor `numberOfLines`, so Yoga wraps it to the ~250-290dp of width left after the 40dp horizontal padding, 18dp icon and 12dp gap. 'Add device by access key' needs ~252dp at 1.5x and ~336dp at 2.0x, and 'Remove from account' ~266dp at 2.0x — both wrap to two ~35dp lines inside a rigid 48dp row, so the user sees 'Add device by' / 'Remove from' with the remainder invisible and no scroll or ellipsis to hint at it.

**Fix.** Replace `height: 48` with `minHeight: 48, paddingVertical: 12`, and give `menuLabel` `flex: 1` (plus `numberOfLines={2}`) so it wraps inside a row that grows.

### src/devices/DeviceManagement.tsx:493
**Issue.** sheet (493-499) has no maxHeight and no internal ScrollView, and overlay (484-488) is justifyContent 'flex-end', so the ~289dp + inset device-menu sheet overflows off the top of any window shorter than about 320dp — taking the device-name header and the 'Connect' row out of reach with no way to scroll them back. Reached in Android split-screen/multi-window, on foldable cover screens and in iPad Split View (portrait lock does not apply to multi-window). ResponsivePanel, used by DevicesTour.tsx:78 in this same folder, already solves this.

```
sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 14,
    paddingBottom: 10,
  },
```

**Impact.** Android split-screen / multi-window (which ignores the manifest's portrait lock) and iPad Split View. The device-menu sheet is ~287dp + bottom inset tall (14 top pad + ~23 title + 5 x 48dp rows + 10 bottom pad); in a ~300dp-tall window that exceeds the overlay, and because `overlay` is `justifyContent: 'flex-end'` the overflow spills off the TOP: the device-name header and the 'Connect' row (the only way to start a session from the sheet) are clipped above the screen edge with no scroll. Every other sheet in the app (ChatThread.tsx:862, BiometricScreen.tsx:125, App.tsx:2110) avoids this by using ResponsivePanel, whose modalMaxHeight = safeHeight - 24 plus an internal ScrollView.

**Fix.** Wrap `renderSheet()` in `ResponsivePanel` (style={styles.sheet}) exactly as ChatThread's action sheet does, or add `maxHeight: modalMaxHeight` from useResponsive() plus an inner ScrollView with keyboardShouldPersistTaps='handled'.

### src/connect/ConnectHome.tsx:100
**Issue.** openMenu (94-107) positions the actions popover purely from measureInWindow with no viewport clamp and no flip-up, ignoring fitPopover in src/lib/responsive.ts:21, and ConnectHome's root (110) carries no zIndex so the whole subtree paints under BottomNav's navWrap (App.tsx:6504, zIndex: 50) regardless of actionsMenu's zIndex: 100 (377). On a 360x640dp phone with 3 recent devices and the list scrolled down, the menu's lower rows fall inside the floating pill's band: the File Share row is partly buried on gesture-nav devices and fully buried on 3-button-nav devices, and taps landing there hit a nav tab instead.

```
setMenu({
          device,
          top: y - rootY + rowHeight + 8,
          left: x - rootX + rowWidth - MENU_WIDTH,
        });
```

**Impact.** Mainstream 360x640dp phones (720x1280 hardware) and anything shorter, with 3 recent devices and the list scrolled to the bottom. ConnectHome's usable height there is ~508dp; the third row's bottom lands around 368dp, so the 74dp menu spans ~376-450dp while the Android nav pill (App.tsx:2384, `bottom: 12 + insets.bottom`, height 56 + a 26dp raised halo) occupies the last ~68-94dp. `navWrap` has `zIndex: 50` (App.tsx:6504) and is a sibling of ConnectHome's root, which has no zIndex — so the nav paints above everything inside ConnectHome regardless of `actionsMenu`'s `zIndex: 100`, and Android hit-tests in reverse draw order. Result: the 'File Share' row is visually hidden behind the pill and tapping it presses a nav tab instead. src/lib/responsive.ts:21 already exports `fitPopover(x, y, w, h, boundsWidth, boundsHeight)` for exactly this and is never called here.

**Fix.** Measure the root's height in `openMenu` (measureInWindow already gives it) and run the coordinates through `fitPopover` from '../lib/responsive', reserving the nav clearance; when the menu would land in the bottom strip, flip it above the row (`top: rowTop - menuHeight - 8`). Also re-close or re-measure the menu on a Dimensions/orientation change, since the stored top/left go stale.

### src/connect/ConnectHome.tsx:268
**Issue.** outlineButton (268-278) hard-codes height: 40 while outlineButtonText (279-284) and the label at line 123 have no flexShrink and no numberOfLines. On a 320dp-wide window (small phone, or any phone at Display size = Largest) with Android font size at 200%, 'Search and connect' needs ~252dp against 236dp of usable width and wraps to two ~35dp lines inside a 38dp content box, rendering as one horizontally sliced line. recentHeader (296-302, height: 38) with buttonLeft (285-289) breaks the same way for 'Recent connections'. Localised strings hit both thresholds earlier than English.

```
outlineButton: {
    alignItems: 'center',
    borderColor: BORDER,
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: 'row',
    height: 40,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    width: '100%',
  },
```

**Impact.** 320dp-wide phones (or any phone at Display size = Largest) with Android font size at 2.0x. Usable label width is 288 - 32 padding - 20 icon = 236dp, while 'Search and connect' at 28px measures ~262dp, so it wraps to two ~35dp lines inside a 38dp content box: the CTA renders as one horizontally-cut line of text with the rest invisible. `recentHeader` (line 296, `height: 38`) has the same shape with 'Recent connections' and breaks at the same settings. Localised strings (the app ships a language picker) hit this earlier than English does.

**Fix.** Use `minHeight: 40, paddingVertical: 8` instead of `height: 40` on `outlineButton` and `recentHeader`, and add `flexShrink: 1` + `numberOfLines={1}` to `outlineButtonText` so it truncates rather than wrapping into a rigid box.

### src/connect/ServiceQueueScreen.tsx:126
**Issue.** The empty state is a non-scrollable centred flex box with a fixed 260dp text column, and it is not inset for the floating bottom nav, so its copy is clipped on short windows and can slide under the nav pill at large font sizes.

```
empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 32,
  },
```

**Impact.** Android split-screen / iPad Split View definitively: in a ~300dp-tall window the empty box is only ~170dp while the icon (56) + title + 5-6 wrapped lines of 'When someone sends you a session invite in chat…' measure ~280dp, and because this branch renders no ScrollView (unlike the populated branch at line 47) the title and the tail of the copy are clipped top and bottom with no way to reach them. On a normal 360x640dp phone at font size 2.0x the copy grows to ~6-7 lines and its last line lands in the bottom ~94dp strip that the absolutely-positioned nav pill paints over (the flex box is not shortened by it, unlike `listContent`'s paddingBottom:130) — again unscrollable. `emptyText`'s `maxWidth: 260` is also a fixed dp value that never widens on tablets/foldables.

**Fix.** Render the empty branch inside a `<ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32, paddingBottom: navClearance }}>` using `navClearance` from useResponsive(), and replace `maxWidth: 260` with `maxWidth: Math.min(320, contentWidth)`.

### src/connect/ServiceQueueScreen.tsx:117
**Issue.** The Join button — the only actionable control in a queue row — is a rigid 34dp-tall box, below the minimum touch target at every setting, and its label crops at the largest font size.

```
joinButton: {
    height: 34,
    paddingHorizontal: 16,
    borderRadius: 10,
    ...
  },
  joinText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
```

**Impact.** All devices for the target-size half: 34dp is under Android's 48dp and iOS's 44dp minimum, and unlike ConnectHome's icon buttons there is no hitSlop to compensate — mis-taps are frequent on small/high-density phones, and the row itself is a plain View (line 52) so a missed tap does nothing. At fontScale 2.0 (Android 14 non-linear scaling, or iOS accessibility sizes) 'Join' renders at 26sp whose line box plus Android font padding runs ~36-39dp inside the 34dp box, so the label is vertically cropped. Nothing in this file sets allowFontScaling={false}, so the scaling is live.

**Fix.** Change `height: 34` to `minHeight: 44` with `paddingVertical: 8`, or add `hitSlop={{ top: 8, bottom: 8 }}` to the Pressable at line 62 and let the button grow with its content.

### src/connect/ConnectHome.tsx:185
**Issue.** The kebab trigger that is the only route to Control / File Share for a recent device is a 36x36dp touch target.

```
<Pressable hitSlop={10} onPress={() => openMenu(device)}>
  <Feather name="more-vertical" size={16} color="#111315" />
</Pressable>
```

**Impact.** All phones, worst on small (320-360dp) and high-density screens. A 16dp glyph with hitSlop 10 gives a 36x36dp target, below Android's 48dp and iOS's 44dp minimums, and it sits 16dp from the `shuffle` glyph at line 184 which is a bare Feather with no Pressable at all — so a near-miss to the left lands on dead pixels. Because recentRow (312-317) is a plain View with no onPress, missing this 36dp target is the difference between starting a session and nothing happening. The row's own minHeight is 28 (line 316), so there is no vertical slack to absorb the miss either.

**Fix.** Raise hitSlop to at least {top: 16, bottom: 16, left: 12, right: 12} (the app already uses {top:14,bottom:14,...} on nav tabs, App.tsx:2437-ish), and either make recentRow itself pressable or give the shuffle glyph its own Pressable so the row has a forgiving primary target.

### App.tsx:2383
**Issue.** The floating bottom nav double-counts the bottom safe-area inset — it is an absolutely positioned child of a SafeAreaView that already pads by insets.bottom — so on 3-button-nav phones the pill floats ~108dp above the screen edge instead of ~60dp. This is the App.tsx-side cause of the ConnectHome popover collision in verdict 5.

```
<View style={[styles.navWrap, { bottom: 12 + insets.bottom }]} pointerEvents="box-none">   // rendered directly inside  <SafeAreaView style={styles.homeScreen} edges={['left', 'right', 'bottom']}>  and homeScreen is { backgroundColor: 'transparent', flex: 1 } — no padding of its own
```

**Impact.** Every Android device using 3-button navigation in edge-to-edge mode (android/gradle.properties edgeToEdgeEnabled=true), where insets.bottom is the ~48dp nav-bar height. react-native-safe-area-context's SafeAreaView applies paddingBottom: insets.bottom, and in Yoga an absolutely positioned child is laid out against the parent's PADDING box, so `bottom: 12 + insets.bottom` is measured from a line that is already insets.bottom above the screen — total 12 + 2*insets.bottom. Visible as an oversized dead gap under the pill, it steals ~48dp of usable content height on exactly the short 640dp-class phones where ConnectHome already has to scroll, and it raises the pill into the band where ConnectHome's unclamped popover lands (verdict 5). The same double-count applies wherever this SafeAreaView + BottomNav pairing is used, including ServiceQueueScreen.tsx:37/80.

**Fix.** Pick one owner of the inset: either drop `edges` down to ['left','right'] on the screens that render the floating nav and keep `bottom: 12 + insets.bottom`, or keep the SafeAreaView edge and make navWrap `bottom: 12`. Route it through getResponsiveLayout's navClearance (src/lib/responsive.ts:13) so the content paddingBottom (ConnectHome.tsx:237 hard-codes 140, ServiceQueueScreen.tsx:95 hard-codes 130) is derived from the same number rather than guessed.

### src/components/IosBottomNav.tsx:43
**Issue.** On iOS only, the five nav labels are fixed 11sp single-line text in tabs 42.5dp wide (320pt screen with the FAB) to 65.8dp (375pt without it). 'Connect', 'Devices' and 'Meeting' measure ~41-43dp at 11sp MonaSans-Medium, so they sit on the truncation boundary at default text size on 320pt screens and truncate outright on every iPhone as soon as the user raises Dynamic Type (~1.35x needs ~57dp). Because nothing in the app sets maxFontSizeMultiplier or adjustsFontSizeToFit, at accessibility sizes (fontScale up to ~3.1) every label collapses to one or two characters plus an ellipsis.

```
<Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>  ...  label: { fontSize: 11, fontWeight: '500', color: '#111315' },  ...  row: { width: '92%', maxWidth: 400, gap: 10 }
```

**Impact.** Per-tab width = (min(0.92*W, 400) - 66 (FAB + gap) - 16 (bar padding)) / 5. That is 42.5dp on a 320pt screen (any iPhone 13/14/15 with Settings > Display > View: Zoomed, iPhone SE 1st gen) and 52.6dp on a 375pt iPhone SE2/SE3/13 mini. 'Connect', 'Devices' and 'Meeting' need roughly 45dp at 11sp, so on a 320pt screen the labels already read 'Conn…' / 'Devi…' at default settings; at iOS's default-maximum Dynamic Type (1.35x) they need ~60dp and truncate on every iPhone; at accessibility text sizes every label collapses to two letters and an ellipsis. Worse, labelActive only sets fontWeight '600', which monaFontStyles resolves to the wider MonaSans-SemiBold, so the label visibly truncates at the moment the user taps that tab.

**Fix.** Add maxFontSizeMultiplier={1.3} and adjustsFontSizeToFit minimumFontScale={0.85} to the label, drop the row's maxWidth:400 in favour of a per-tab minWidth (e.g. minWidth: 56 with the bar allowed to use the full 92%), and hide the labels entirely (icon-only tabs) when useResponsive().safeWidth < 360 or fontScale > 1.3.

### src/components/ScreenBackground.tsx:55
**Issue.** On any window at least ~743dp wide the mid-right blob is fully off-screen and past ~838dp the bottom blob is too, because the size is capped at 312/352dp while the offset keeps scaling with width. On an iPad (app.json:16 supportsTablet: true; 820-1024pt portrait) two of three blobs are gone and the top one is a ~13dp sliver, so every screen renders on the flat white appRoot (App.tsx:3383). A Galaxy Z Fold inner display (~673-840dp) loses most of it. The landscape/RemoteControl part of the original claim does not apply: RemoteControl paints an opaque root (`root: { flex: 1, backgroundColor: '#1A1D21' }`, RemoteControl.tsx:1507) over the backdrop, and app.json locks `"orientation": "portrait"` everywhere else.

```
size={Math.min(width * 0.79, 312)}
        position={{ top: height * 0.34, right: -width * 0.42 }}
```

**Impact.** The mid-right blob is fully off-screen once width * 0.42 >= 312, i.e. width >= 743dp; the bottom blob once width * 0.42 >= 352, i.e. width >= 838dp. On an iPad (app.json sets ios.supportsTablet: true; 1024pt portrait) the mid and bottom blobs are gone and the top blob leaves a 13dp sliver (-1024*0.3 + 320 = 13), so the whole screen renders on flat white. The same happens in landscape during remote control (RemoteControl.tsx:337 calls lockAsync(LANDSCAPE) and ScreenBackground is rendered outside that branch at App.tsx:3012, width 844 > 743), and a Galaxy Z Fold inner display at ~673-840dp loses most of it.

**Fix.** Derive the offsets from the blob size, not the window width, so the visible fraction is constant: `const s = Math.min(Math.max(width, height) * 0.8, 520); position={{ top: height * 0.34, right: -s * 0.55 }}` and likewise for the other two, dropping the 320/312/352 caps in favour of a diagonal-relative size.

### src/lib/responsive.ts:14
**Issue.** modalMaxHeight — the only thing ResponsivePanel consumes, in a component documented as keeping content reachable 'with a keyboard' — has no keyboard term at all; it is derived from useWindowDimensions(), which never shrinks for the software keyboard on iOS.

```
modalMaxHeight: Math.max(0, safeHeight - 24),
```

**Impact.** On iOS a panel is permitted to be the full safe height while the keyboard covers roughly 336pt of it, so on a 667pt iPhone SE the bottom half of any panel with an input is under the keyboard unless the caller supplies its own KeyboardAvoidingView. Only 2 of the 10 ResponsivePanel call sites do, and both use `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}` (AddContactModal.tsx:98, App.tsx:3324) — behavior="height" stacked on top of the manifest's android:windowSoftInputMode="adjustResize" is the classic Android double-compensation that squeezes the dialog to a sliver on short phones.

**Fix.** Track the keyboard in useResponsive (Keyboard.addListener('keyboardDidShow'/'keyboardDidHide') or react-native-keyboard-controller) and return `modalMaxHeight: Math.max(0, safeHeight - keyboardHeight - 24)`, then drop behavior="height" on Android at the two call sites since adjustResize already handles it.

### src/components/IosBottomNav.tsx:39
**Issue.** Tab hitSlop expands only vertically, so the horizontal touch target is exactly the flex:1 tab width, which falls below the 44pt iOS / 48dp Android minimum on narrow screens.

```
hitSlop={{ top: 6, bottom: 6 }}
```

**Impact.** With the action FAB present (the Devices tab), each of the 5 tabs is 42.5dp wide on a 320pt screen (iPhone with Display Zoom enabled, iPhone SE 1st gen) — under the 44pt HIG minimum — and the targets are edge-to-edge adjacent with no gap, so mis-taps land on the neighbouring tab. Compare BottomNav in App.tsx:2396, which does pass left/right hitSlop.

**Fix.** Use `hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}` and give the tab a `minWidth: 48`, letting the bar scroll or drop labels rather than compressing below the minimum target.

### src/components/ChatToast.tsx:68
**Issue.** The toast pins itself with fixed 12dp left/right margins and consumes only insets.top, ignoring insets.left/insets.right entirely.

```
wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
```

**Impact.** The toast is rendered outside the screen ternary (App.tsx:3312) so it also appears during remote control, which unlocks landscape (RemoteControl.tsx:337 lockAsync(OrientationLock.LANDSCAPE)). In landscape insets.top drops to 0 and the cutout moves to the side: on a notched iPhone insets.left is 59pt versus the toast's 12pt margin, so the avatar and the first characters of the sender name sit under the notch; on an Android phone in landscape with 3-button navigation the opposite edge sits under the 48dp system bar.

**Fix.** Use `left: 12 + insets.left, right: 12 + insets.right` alongside the existing top offset.

### src/lib/responsive.ts:5
**Issue.** The shared layout helper has a single 600dp breakpoint that only changes the gutter — there is no tablet or foldable branch and no column logic — so every screen ≥600dp gets the same phone layout stretched to a 720dp column.

```
const gutter = safeWidth < 360 ? 12 : safeWidth >= 600 ? 24 : 16;
  const contentWidth = Math.max(0, Math.min(720, safeWidth - gutter * 2));
```

**Impact.** app.json declares ios.supportsTablet: true, so on a 1024pt iPad the app renders a single 720pt-wide phone column with a 400pt-wide nav bar floating at the bottom (IosBottomNav.tsx:74) and, per the ScreenBackground finding, no backdrop at all — roughly 30% of the screen is empty white on either side. A Galaxy Z Fold inner display (~673-840dp) gets the same phone layout when unfolded, so unfolding gains the user nothing but whitespace.

**Fix.** Add a real breakpoint to getResponsiveLayout — e.g. `const size = safeWidth < 360 ? 'compact' : safeWidth < 600 ? 'phone' : safeWidth < 900 ? 'tablet' : 'large'` plus a `columns` value — and have list screens render 2 columns and the nav switch to a side rail at 'tablet' and above.

### src/lib/i18n.tsx:19
**Issue.** Two languages are declared right-to-left but the flag is never read and I18nManager is never imported anywhere in the app, so Arabic and Urdu render RTL text inside an LTR layout.

```
{ code: 'ar', label: 'Arabic', native: 'العربية', rtl: true },
  { code: 'ur', label: 'Urdu', native: 'اردو', rtl: true },
```

**Impact.** A grep for I18nManager / isRTL / writingDirection / .rtl across src and App.tsx returns zero hits, so selecting Arabic or Urdu in the in-app language picker leaves every flexDirection:'row' running left-to-right: labels stay left-aligned, chevrons and back arrows point the wrong way, and the avatar/text order in list rows and in ChatToast is mirrored relative to the script. AndroidManifest already sets android:supportsRtl="true", so the platform is ready and only the JS side is missing.

**Fix.** On setLang, compare LANGUAGES.find(l => l.code === next)?.rtl against I18nManager.isRTL and, when they differ, call I18nManager.allowRTL(true) + I18nManager.forceRTL(rtl) and prompt for a restart; convert the shared primitives' left/right style props to start/end (ChatToast.tsx:68-69, IosBottomNav.tsx:64-65).

### src/lib/i18n.tsx:19
**Issue.** The shared i18n layer declares two right-to-left languages but nothing in the app ever switches layout direction, and the primary navigation is not translated at all

```
{ code: 'ar', label: 'Arabic', native: 'العربية', rtl: true },
  { code: 'ur', label: 'Urdu', native: 'اردو', rtl: true },   // `rtl` is read by no one
// grep over App.tsx + src/: zero hits for I18nManager, writingDirection, paddingStart/marginStart, or start:/end: insets
// App.tsx:2316  const tabs = [{ key: 'chat', label: 'Chat' }, ... ]  // literal English, never passed through t()
```

**Impact.** Any device whose user picks العربية or اردو in the language picker: the strings flip to RTL script but the layout stays hard LTR - every row is `flexDirection: 'row'` with no `start`/`end` logical props, back chevrons still point left, absolutely-positioned close buttons stay pinned with `right: 12` (ChatThread.tsx:1438), and `textAlign: 'right'` (App.tsx:4155, 4884) now means 'wrong end of the line'. Arabic and Urdu glyphs are also ~15-20% taller at the same fontSize, which the fixed-height rows across the app do not budget for. Separately, the five bottom-nav labels are hard-coded English on every device regardless of language.

**Fix.** Consume the `rtl` flag: call I18nManager.forceRTL(isRtl) (with a reload prompt, since RN needs a restart) or set `writingDirection` plus logical `paddingStart/End`, `start/end` insets throughout the shared primitives; and route the `tabs` labels in App.tsx:2316 through t() so the nav is translated - then re-check IosBottomNav's 42.5dp tabs against the longer translations.

### src/lib/responsive.ts:10
**Issue.** The only fontScale-driven reflow signal in the codebase, plus two other outputs of the shared layout hook, are computed but consumed nowhere - the responsive layer looks like it handles accessibility font sizes and does not

```
stackActions: safeWidth < 360 || fontScale > 1.3,
    navHeight: Math.max(72, 42 + 16 * fontScale),
    splashGlowSize: Math.min(450, Math.max(safeWidth, safeHeight)),
// repo-wide grep: `stackActions`, `navHeight` and `splashGlowSize` appear only here, never at a call site
```

**Impact.** Every device with Android font size set to Large/Largest or iOS Dynamic Type above default: no button row, action bar or label+value row anywhere in the app ever switches from side-by-side to stacked, because the one predicate that would trigger it is never read. Combined with the 449 raw-dp font sizes documented in finding 2, growing text collides inside fixed-height rows (e.g. App.tsx:6229 `lockSheetTitleRow: { height: 40, flexDirection: 'row' }`) instead of reflowing. Of the ten values getResponsiveLayout returns, only gutter, contentWidth, compact, headerHeight, navClearance, modalMaxHeight, illustrationHeight and splashWidth are used - and only headerHeight and navClearance are fontScale-aware.

**Fix.** Either wire stackActions into the shared action-row styling (flexDirection: r.stackActions ? 'column' : 'row', alignItems stretch) and have IosBottomNav/BottomNav publish their real measured height into navHeight, or delete the three dead outputs so the module stops advertising adaptivity it does not provide.

### app.json:7
**Issue.** app.json declares a global "orientation": "portrait" while also declaring ios.supportsTablet: true and no UIRequiresFullScreen, producing a portrait-locked app that is nonetheless handed iPad-sized and arbitrarily narrow multitasking windows.

```
"orientation": "portrait",
```

**Impact.** This single key is what generates the Android hard lock (verified: node_modules/@expo/config-plugins/build/android/Orientation.js sets `mainActivity.$['android:screenOrientation'] = orientation`). On iOS it collides with "supportsTablet": true at app.json:16 — the app installs as a native iPad app but refuses landscape, and because UIRequiresFullScreen is not set, iPadOS puts it into Slide Over and Split View where the window can be as narrow as ~320pt and as short as a third of the screen. src/lib/responsive.ts:7 flips `compact` in those windows, and modalMaxHeight (line 14) is computed from a height the app assumed was a full screen. On iPadOS 26 the app is additionally resizable by default.

**Fix.** Set "orientation": "default" and drive orientation from JS via expo-screen-orientation (the app already imports it in RemoteControl.tsx), then verify the top-level tabs at 600-1200dp widths. If iPad multitasking is genuinely out of scope, add "ios": { "requireFullScreen": true } explicitly rather than leaving it implicit — but note that does not help on Android 16 large screens, which ignore the lock regardless.

### android/app/src/main/res/values/styles.xml:6
**Issue.** The launch theme hardcodes a white status bar without ever setting android:windowLightStatusBar, so the system status-bar icons default to white-on-white and vanish during the entire cold-start window.

```
<item name="android:statusBarColor">#FFFFFF</item>
```

**Impact.** Theme.App.SplashScreen (styles.xml:8) inherits AppTheme and is the android:theme on MainActivity, so it paints the system starting window before any RN code runs. windowLightStatusBar is set nowhere in the whole android/ tree (grepped: only this statusBarColor line and the manifest line 30 attributes exist), so it defaults to false = light/white icons over the #FFFFFF bar. On every Android 14-and-below device the clock, battery and signal icons are invisible for the ~1-2s cold start. This value is also orphaned: app.json declares no androidStatusBar block at all, and @expo/config-plugins/build/android/StatusBar.js only emits STATUS_BAR_COLOR when androidStatusBar.backgroundColor is set — so re-running prebuild would delete it, meaning the committed android/ tree and app.json have already silently diverged. Compare apps/android-host/app/src/main/res/values/themes.xml:9-14, which pairs the white splash with android:windowLightStatusBar=true precisely to avoid this.

**Fix.** Add <item name="android:windowLightStatusBar">true</item> to the AppTheme block, and add the matching "androidStatusBar": { "backgroundColor": "#FFFFFF", "barStyle": "dark-content" } to app.json's android section so a future `expo prebuild` regenerates the same result instead of dropping it.

### android/app/src/main/res/values-night/colors.xml:1
**Issue.** The night-mode colour bucket is completely empty while the app theme is DayNight and app.json requests automatic light/dark, so dark-mode users get a full-screen white splash flash on every cold start.

```
<resources/>
```

**Impact.** AppTheme is Theme.AppCompat.DayNight.NoActionBar (styles.xml:2) and app.json:13 sets "userInterfaceStyle": "automatic", so the system does resolve night resources — but this file overrides nothing. Theme.App.SplashScreen's windowBackground is @drawable/ic_launcher_background, whose first layer is @color/splashscreen_background = #FFFFFF (values/colors.xml:2). Every dark-mode user on every Android device therefore gets a full-brightness white screen for the whole cold start before the app renders, which is jarring in low light and is the single most-reported "this app feels unpolished" symptom on OLED phones. The native host solved the same problem deliberately and documented it (apps/android-host/.../themes.xml:5-8).

**Fix.** Either populate values-night/colors.xml with dark equivalents (<color name="splashscreen_background">#0B0F14</color>, <color name="iconBackground">#0B0F14</color>) and ship a light-on-dark splashscreen_logo, or make the deliberate choice the native host made — force the light splash and pair it with windowLightStatusBar=true so it is at least internally consistent.

### src/meetings/MeetingHome.tsx:212
**Issue.** 21 Text nodes across the app hardcode allowFontScaling={false}, opting out of the Android/iOS font-size accessibility setting entirely.

```
<Text allowFontScaling={false} style={styles.timeText}>{formattedTime}</Text>
```

**Impact.** Users who raise Settings > Display > Font size (or iOS Larger Text) — the single most-used accessibility setting — see the rest of the UI grow while these 21 strings stay pinned at their design size. The effect is worst on the Meetings home, where the clock (MeetingHome.tsx:212), date (214) and description (216) are all opted out, so at 1.3x-2.0x font scale the surrounding labels reflow around three frozen strings and the layout reads as broken rather than merely dense. This also cross-cuts finding 1: because `fontScale` is missing from configChanges, changing that setting simultaneously restarts the Activity. The layout engine already anticipates large scales — src/lib/responsive.ts:10-13 branches on fontScale > 1.3 and scales headerHeight/navHeight by it — so these opt-outs actively fight the app's own responsive system.

**Fix.** Remove allowFontScaling={false} from all 21 sites and instead cap growth where overflow is a real risk, e.g. maxFontSizeMultiplier={1.4} plus numberOfLines, which keeps the text responsive to the user's setting without letting it blow the row height.

### android/app/src/main/AndroidManifest.xml:30
**Issue.** The activity never declares android:resizeableActivity, so it defaults to true and Android will place it in split-screen, freeform and desktop windows — window modes the same line's configChanges cannot survive

```
AndroidManifest.xml:30 declares configChanges, launchMode, windowSoftInputMode, theme, exported and screenOrientation but no `android:resizeableActivity`; targetSdk 36 makes the default true
```

**Impact.** Because the activity is implicitly resizeable, any Android 7+ user can drag it into split-screen, and Android 15/16 desktop windowing on tablets and connected displays will freely resize it. Every one of those resizes changes smallestScreenSize, which is not in the configChanges list, so the Activity is recreated and (per verdict 1) the React tree remounts and the user is dumped back at the initial screen. This is the concrete reason ordinary tablet and large-phone users hit the restart today, without owning a foldable. The manifest is internally inconsistent: it opts in to arbitrary window sizes while being portrait-locked, resize-intolerant and free of any landscape or sw600dp resources.

**Fix.** Add smallestScreenSize|density|fontScale|layoutDirection to configChanges on line 30 so resizes are handled in-process, or explicitly set android:resizeableActivity="false" if multi-window is not intended — but not both as they stand.

### src/remote/RemoteControl.tsx:164
**Issue.** The 'Rotate to landscape' action in the gestures sheet is a fixed 40dp button whose label is long enough to wrap once scaled.

```
rotateButton: {
    marginTop: 8,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  rotateButtonText: { fontSize: 13, fontWeight: '600', color: '#111315' },
```

**Impact.** Android at 1.6x and above on 320-400dp phones. 'Rotate to landscape' is 19 characters; at 21sp plus a 15dp icon and 8dp gap it exceeds the sheet width (the sheet is full-width minus 40dp of padding, RemoteControl.tsx:1421), wraps to two lines needing ~56dp, and the second line is clipped by the 40dp button. The surrounding gestures block at line 1421 is a plain `<View>` rather than a ScrollView, so nothing scrolls to compensate.

**Fix.** `minHeight: 40` + `paddingVertical: 10` on `rotateButton`, and wrap the gestures block at line 1421 in a ScrollView like the sibling branch at line 1440 already does.

### src/connect/ConnectHome.tsx:268
**Issue.** The primary 'Search and connect' button is fixed at 40dp and its label has neither `flex`/`flexShrink` nor `numberOfLines`, so it both clips vertically and shoves the trailing icon off the row.

```
outlineButton: {
    alignItems: 'center',
    borderColor: BORDER,
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: 'row',
    height: 40,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    width: '100%',
  },
  outlineButtonText: { color: '#111315', fontFamily: FONT_MEDIUM, fontSize: 14, lineHeight: 20 },
```

**Impact.** 320-360dp Android phones at 1.5x and above. At 2.0x `lineHeight: 20` becomes 40dp — exactly the button height with 1dp of border on each side, so the label is shaved; and 'Search and connect' at 28sp is ~250dp wide plus a 20dp icon plus 32dp of padding, which exceeds a 320dp screen, so the `SortArrowsIcon` (line 124) is pushed outside the button. The same `outlineButtonText` is reused inside `recentHeader { height: 38 }` (line 296) for 'Recent connections', which clips one step earlier.

**Fix.** `minHeight: 40` + `paddingVertical: 10` on `outlineButton` and `minHeight: 38` + `paddingVertical: 8` on `recentHeader`; add `flexShrink: 1` to `outlineButtonText`.

### src/connect/ConnectHome.tsx:379
**Issue.** The device action popover has a fixed 132dp width and 37dp rows, so its 13sp entries cannot grow in either direction.

```
actionMenuRow: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    gap: 8,
    height: 37,
    paddingHorizontal: 16,
  },
```

**Impact.** Android at 1.4x and above, all phone sizes. `MENU_WIDTH = 132` (line 15) minus 32dp of padding minus a 15dp icon and 8dp gap leaves ~77dp of text width; at 1.4x 'File Share' (line 218) at 18sp is ~85dp and wraps to two lines needing ~50dp inside a 37dp row — the second line is cut and the popover's own `width: MENU_WIDTH` (line 376) prevents it from widening. The menu's positioning math at line 103 also assumes the fixed width.

**Fix.** Replace `width: MENU_WIDTH` with `minWidth: MENU_WIDTH` + `maxWidth: 240`, and `height: 37` with `minHeight: 37` + `paddingVertical: 8`.

### src/connect/ServiceQueueScreen.tsx:117
**Issue.** The service-queue Join button is fixed at 34dp — the shortest text button in the app — around 13sp text.

```
joinButton: {
    height: 34,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#FF8A00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
```

**Impact.** Android at 1.6x and above. 13sp becomes 21sp needing ~28dp and 26sp needing ~35dp at 2.0x, so the 'Join' label (line 63) is clipped inside the 34dp pill on the screen whose entire purpose is joining a waiting support request. The row it lives in uses padding (lines 103-104) and grows correctly, which makes the clipped button the only broken element on the row.

**Fix.** Replace `height: 34` with `minHeight: 34` and add `paddingVertical: 8`.

### src/components/IosBottomNav.tsx:113
**Issue.** Bottom-tab labels are 11sp with `numberOfLines={1}` inside `flex: 1` tabs bounded by a fixed `maxWidth: 400`, so at accessibility text sizes every tab name truncates to one or two characters.

```
label: {
      fontSize: 11,
      fontWeight: '500',
      color: '#111315',
    },
```

**Impact.** iOS with Larger Accessibility Sizes (up to ~3.1x) and Android at 2.0x. The row is `width: '92%', maxWidth: 400` (lines 73-74); with five tabs, 16dp of bar padding and a 56dp FAB plus 10dp gap, each tab gets ~63dp. 'Meetings' at 22sp is ~90dp and at 34sp ~140dp, so `numberOfLines={1}` (line 43) truncates it to 'Me…' or 'M…' — the tabs become indistinguishable. At 11sp the label is already below the 12sp floor.

**Fix.** Raise `fontSize` to 12, and either hide the labels above a fontScale threshold (`fontScale > 1.4`) or use `numberOfLines={2}` and let `bar` grow via its existing padding (it has no fixed height).

### src/chat/ChatThread.tsx:763
**Issue.** The chat message composer hard-disables font scaling, so a low-vision user cannot enlarge the message they are composing.

```
<TextInput
            allowFontScaling={false}
            style={styles.messageInput}
            value={input}
            onChangeText={handleInputChange}
            placeholder="Type your message here.."
```

**Impact.** Any device with the system font size raised. Message text stays pinned at 13sp (`messageInput`, line 1774) no matter what the user set, while the messages already in the thread above it scale normally — the user reads large text and types tiny text in the same screen. The wrapper's `maxHeight: 120` (line 1772) shows this was done to stop the composer growing; the correct fix is a proportional cap.

**Fix.** Remove `allowFontScaling={false}` and change `messageInputWrap`'s `maxHeight: 120` to a fontScale-derived cap (e.g. `maxHeight: 120 * Math.min(fontScale, 2)`).

### src/chat/ChatThread.tsx:1508
**Issue.** The @-mention suggestion rows are fixed at 38dp, and the device name inside them is truncated to one line with no ellipsis mode set.

```
mentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    height: 38,
  },
  mentionName: { fontSize: 13, color: '#111315', flex: 1 },
```

**Impact.** Android at 1.7x and above. 13sp becomes 22sp needing ~30dp and 26sp needing ~35dp inside a 38dp row that has no vertical padding — device names are shaved. Because `numberOfLines={1}` is set at line 747 and no `ellipsizeMode` is specified anywhere in the app (0 occurrences), long device names are tail-truncated by default, so on a 320dp phone at 2x the user sees only the first few characters and cannot distinguish two similarly-named machines.

**Fix.** `minHeight: 38` + `paddingVertical: 8`, and add `ellipsizeMode="middle"` to the mention name so the distinguishing tail of a device name survives truncation.

### src/lib/responsive.ts:10
**Issue.** The only font-scale-aware layout decision in the shared responsive helper is computed but consumed by nothing — every screen that should stack its actions at large font sizes still lays them out in a row.

```
stackActions: safeWidth < 360 || fontScale > 1.3,
```

**Impact.** Android at >1.3x on every screen with a side-by-side button pair — App.tsx:2034-2041 (feedback Cancel/Send), src/devices/DeviceManagement.tsx:601-623 (Cancel/Add), src/meetings/MeetingPreview.tsx:142-149 (Cancel/Join). A grep across App.tsx and src/ finds zero readers of `stackActions`, so those rows stay horizontal, each button keeps its fixed height, and both labels clip instead of stacking into two full-width buttons.

**Fix.** Consume it: `<View style={[styles.actions, stackActions && { flexDirection: 'column' }]}>` in each of the three action rows above, and give those buttons `minHeight` instead of `height`.

### App.tsx:3625
**Issue.** 198 style objects hardcode `lineHeight` next to `fontSize` at a fixed ~1.43 ratio in dp, with no derivation from fontScale — every one of them is a text box with zero slack sitting inside a dp-measured container.

```
topTitle: {
    color: '#111315',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 23,
    flexShrink: 1
  },
```

**Impact.** All Android and iOS devices at any raised font setting. Because the ratio is baked in at design time (16/23, 14/20, 12/17, 10/14 — all ≈1.43) there is no headroom for the taller ascender/descender box MonaSans needs at large sizes, so wherever the parent is a fixed-dp box the glyphs are cropped rather than merely tight. The 277 total `lineHeight:` occurrences make this the dominant text-styling idiom in the app, not an exception.

**Fix.** Introduce a `src/lib/type.ts` that derives the pair together — `export const type = (size: number) => ({ fontSize: size, lineHeight: Math.round(size * 1.45) })` — and replace the hardcoded pairs so the two values can never drift and can be capped centrally.

### App.tsx:4031
**Issue.** There is no typography module at all: 437 numeric `fontSize` literals are scattered across 29 files, 55 of them below the 12sp readability floor, and none of the 546 `<Text>` elements sets `maxFontSizeMultiplier` to bound the growth.

```
chatChipText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '400',
    lineHeight: 14,
  },
```

**Impact.** Two-sided failure on every device. At the default scale the 55 sub-12sp values (36 at 10sp, 12 at 11sp, 4 at 9sp, 3 at 8sp) are hard to read on high-density small phones. At the other end, with zero occurrences of `maxFontSizeMultiplier` in the codebase, Android 14's 200% setting doubles all 437 sizes inside containers laid out for 100% — the mechanical cause of every clipping finding above. `src/lib/responsive.ts` centralises spacing but deliberately owns no type scale.

**Fix.** Add a typography scale beside `getResponsiveLayout` with a 12sp floor and a shared `maxFontSizeMultiplier` (≈1.6 for chrome, unbounded for body copy), export a thin `<AppText>` wrapper that applies it, and migrate the 437 literals onto the scale.

### src/chat/ChatThread.tsx:763
**Issue.** The chat composer opts out of font scaling while the message bubbles it produces scale normally, so the text you type and the text you read render at different sizes.

```
<TextInput allowFontScaling={false} style={styles.messageInput}  // ChatThread.tsx:762-764, messageInput: { fontSize: 13, ... } (:1774) — while bubbleText: { fontSize: 12, lineHeight: 16 } (:1655) has no such opt-out. Same pattern in the meeting chat: MeetingRoom.tsx:1204 allowFontScaling={false} on chatInput (fontSize 14, :2075).
```

**Impact.** Any Android/iOS user with an enlarged system font. At 2.0x a received message renders at 24sp in the bubble while the composer directly below it is frozen at 13sp — roughly half the size — so a low-vision user can read the conversation but cannot read what they are typing. It also makes the composer look broken next to the scaled 'Type your message here..' placeholder neighbours.

**Fix.** Drop allowFontScaling={false} from ChatThread.tsx:763 and MeetingRoom.tsx:1204 and instead cap growth with maxFontSizeMultiplier (e.g. 1.6); the composer wrapper already uses maxHeight:120 (ChatThread.tsx:1772) so a taller line box is handled.

### src/lib/responsive.ts:10
**Issue.** There is no typography scale at all, and the one font-scale-aware helper the codebase does have is dead code — nothing in the app reflows when the OS font size changes.

```
stackActions: safeWidth < 360 || fontScale > 1.3,   // responsive.ts:10 — grep for 'stackActions' across App.tsx and src/ returns this definition only, zero consumers. The only other fontScale uses are headerHeight: Math.max(60, 24 * fontScale + 24) (:11) and navHeight (:12).
```

**Impact.** Across the app there are 446 hardcoded `fontSize:` values and 276 hardcoded `lineHeight:` values with no shared type module (src/lib/monaSans.ts only injects a font family), and allowFontScaling appears in just 21 places — 15 of them on one screen. useAppStyles (App.tsx:6641-6656) rebuilds only content padding, image heights and inset-dependent offsets from useResponsive; not one text container height is derived from fontScale. So on every device with an enlarged font, containers keep their design-time heights while the text inside them grows — which is the mechanism behind every genuine clipping finding in this slice (App.tsx:3744, 4184, 4104, MeetingRoom.tsx:2015, RemoteControl.tsx:1555).

**Fix.** Introduce a typography module (size + lineHeight tokens) and, for containers that wrap text, replace `height:` with `minHeight:` — the codebase already does this correctly in a few places (deviceListRow App.tsx:3759-3765, managedDeviceRow :3827-3836, quickRowTall :3717-3724, each with a comment explaining the OS-font-size reason), so the pattern just needs to be applied to the rest. Then either consume `stackActions` or delete it.

### src/remote/RemoteControl.tsx:1580
**Issue.** toolbarRow (RemoteControl.tsx:1580) hard-codes a 344dp chain (5x40 + 64 + 12 + 24 + 2x22) with no flexShrink and no flexWrap. It fits every stock phone width (320dp overflows only into its own padding), but breaks once the usable width drops under ~298dp - i.e. a 360dp phone at Android Display size = Largest (~277dp), where the Hide chevron is entirely off-screen and untappable and the red End-session pill is clipped by ~9dp. Fix: flexShrink:1 on toolButton/endButton or replace space-between with flex:1 tabs.

```
toolbarRow: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  toolButton: { height: 40, width: 40, alignItems: 'center', justifyContent: 'center' },
  toolbarEndGroup: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  endButton: {
    height: 44,
    width: 64,
...
  hideButton: { height: 40, width: 24, alignItems: 'center', justifyContent: 'center' },
```

**Impact.** The JSX at line 1383-1407 renders exactly 5 toolButtons (command, gesture-tap, keyboard, zap, settings) plus toolbarEndGroup (endButton + gap 12 + hideButton). Required width = 5*40 + 64 + 12 + 24 + 2*22 = 344dp. React Native's default flexShrink is 0, so nothing shrinks and there is no flexWrap. Breaks below 344dp: 320dp small Android phones (Galaxy J/A0x, Android Go) lose the 24dp Hide chevron entirely; a 411dp Pixel at Android Display size = Largest reports ~316dp and loses the chevron plus part of the red End-session pill; a 360dp phone at Largest reports ~277dp and loses the chevron and roughly two-thirds of the End button. Those controls are simply painted past the viewport and are untappable — on the screen where ending the session matters most.

**Fix.** Make the row shrinkable instead of additive: give toolbarRow `flexWrap: 'nowrap'` plus `paddingHorizontal: 12`, change `toolButton` to `{ flex: 1, minWidth: 40, maxWidth: 56, height: 40 }`, give `toolbarEndGroup` `flexShrink: 0`, and change `endButton` to `{ height: 44, minWidth: 44, paddingHorizontal: 10 }`. Alternatively wrap the five tool buttons in a horizontal ScrollView and keep only endButton/hideButton pinned.

### app.json:7
**Issue.** The activity is portrait-locked (app.json:7 + AndroidManifest.xml:30) while ios.supportsTablet is true and no resizeableActivity is declared, so tablets/open foldables get compat letterboxing and iPad gets a portrait-only window; and because RemoteControl.tsx:322 unlocks orientation at runtime, landscape is reachable in exactly the one screen whose sheets were never sized for it.

```
"orientation": "portrait",
...
"ios": { "supportsTablet": true,

(android/app/src/main/AndroidManifest.xml:30) <activity android:name=".MainActivity" ... android:screenOrientation="portrait">
```

**Impact.** On tablets and open foldables — whose natural orientation is landscape — Android force-rotates the activity and, on Android 12L+ large-screen devices, applies compat letterboxing: the app renders as a portrait strip with black pillarboxes. `supportsTablet: true` on iPad produces the same portrait-only window. It also means every landscape-specific layout path in the app is untested except inside RemoteControl, which unlocks orientation at runtime (RemoteControl.tsx:322) and therefore hits the untested path (see the sheet finding above). There is no `resizeableActivity` declaration either, so split-screen/free-form behaviour is undefined.

**Fix.** Drop `android:screenOrientation="portrait"` from AndroidManifest.xml:30 and set `"orientation": "default"` in app.json, then let per-screen `ScreenOrientation.lockAsync` handle the few screens that genuinely need portrait; add `android:resizeableActivity="true"`. At minimum, use `"orientation": "portrait"` only for phones and allow sensor orientation on `sw600dp`.

### App.tsx:3744
**Issue.** App.tsx:3748 pins height: 14 (dp, unscaled) on deviceGroupTitle whose lineHeight: 14 is sp (fontScale-scaled), so the two Devices-tab section headings at App.tsx:664 and :676 are progressively bottom-clipped: ~1dp at fontScale 1.15, ~2.6dp (descenders + x-height) at 1.3, and roughly half the glyph at 2.0. Fix: drop height, or use minHeight.

```
deviceGroupTitle: {
    color: '#111315',
    fontSize: 10,
    fontWeight: '400',
    height: 14,
    lineHeight: 14,
  },
```

**Impact.** Used live at App.tsx:664 and App.tsx:676 for the 'Managed devices' and 'Groups' section headings on the Devices tab. On Android `height` is converted with toPixelFromDIP (never scaled) while `fontSize`/`lineHeight` are converted with toPixelFromSP (scaled by fontScale). At the very first font-size notch (fontScale 1.15) the line box needs 16.1dp inside a 14dp box; at 'Large' (1.3) it needs 18.2dp and the descenders plus part of the x-height are cut; at 'Largest' (2.0) it needs 28dp and only the top half of the letters renders. Both section headings on the main device-management screen become unreadable smudges.

**Fix.** Remove `height: 14` and keep only `lineHeight: 14`; if a minimum box is wanted use `minHeight: 14`. Then audit the same dp-vs-sp mistake in the other fixed-height text containers listed in this report.

### src/meetings/MeetingRoom.tsx:2128
**Issue.** The meeting control bar is a fixed 332dp pill whose seven children are all non-shrinkable, so its content chain overflows the `maxWidth: '94%'` cap on narrow viewports and at raised font sizes.

```
controls: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    flexDirection: 'row',
    height: 60,
    justifyContent: 'space-between',
    marginBottom: 16,
    marginTop: 8,
    maxWidth: '94%',
    paddingHorizontal: 24,
    width: 332,
  },
```

**Impact.** The JSX (lines 1404-1445) puts five 20dp icon glyphs plus a `controlsEndGroup` containing `leavePill { height: 40, width: 60 }` (line 2265), a 12dp gap and a 16dp glyph inside 2*24dp padding — 236dp at default. @expo/vector-icons renders glyphs as Text, so they grow with fontScale: at 1.3 the chain is ~267dp, at 2.0 it is ~352dp, while `maxWidth: '94%'` gives only 338dp on a 360dp phone and 260dp on the ~277dp viewport a 360dp phone reports at Display size = Largest. Nothing has flexShrink, so the right-hand group (red leave button and the ⋮ overflow menu) is painted past the pill's right edge and past the screen — the user cannot leave the meeting or open Settings/Record from the bar. `height: 60` also fixes the pill while the glyphs inside it grow.

**Fix.** Drop `width: 332`, use `{ alignSelf: 'stretch', marginHorizontal: 16, minHeight: 60, paddingHorizontal: 16, justifyContent: 'space-around' }`, give each control `{ flexShrink: 1, minWidth: 40 }`, and replace `leavePill { width: 60 }` with `{ minWidth: 56, paddingHorizontal: 12 }`.

### src/chat/ChatEmpty.tsx:28
**Issue.** The chat empty state is absolutely positioned with a hardcoded 60dp header allowance and a hardcoded 120dp nav clearance, around a content block of fixed heights that cannot shrink to fit a short screen.

```
<View style={[styles.wrap, { top: insets.top + 60 }]}>
...
  wrap: { alignItems: 'center', bottom: 0, justifyContent: 'center', left: 0, paddingBottom: 120, paddingHorizontal: 16, position: 'absolute', right: 0 },
  inner: { alignItems: 'center', alignSelf: 'center', flexShrink: 1, gap: 28, maxWidth: 328, width: '100%' },
  illustration: { height: 200, width: 190 },
...
  button: { alignItems: 'center', borderRadius: 4, height: 40, justifyContent: 'center', overflow: 'hidden', width: '100%' },
```

**Impact.** Content height = 200 (illustration, flexShrink 0) + 28 + textBlock (34 title + 14 + ~40 subtitle) + 28 + 40 button = ~384dp, plus the 120dp pad = 504dp. A 320x568dp 5" phone has 568 − 24 (status) − 60 (header) = 484dp — the 'Add contact' button already lands under the floating nav pill. At font scale 1.3 the block grows to ~432dp (552 with the pad) and the button plus part of the subtitle are behind the pill on most 360x800 phones too. `inner`'s `flexShrink: 1` cannot help because none of its children are shrinkable. Separately, the literal `60` disagrees with the real header, which HeaderFrame sizes as `Math.max(60, 24*fontScale + 24) + insets.top` (src/lib/responsive.ts:11), so at fontScale 2.0 the header is 72dp and overlaps this block by 12dp.

**Fix.** Replace the absolute box with a ScrollView (`contentContainerStyle: { flexGrow: 1, justifyContent: 'center' }`), take the top offset from `useResponsive().headerHeight + insets.top` instead of the literal 60, use `paddingBottom: navClearance` instead of 120, and size the illustration from `illustrationHeight` (already computed in src/lib/responsive.ts:15) instead of the fixed 200x190.

### App.tsx:6647
**Issue.** The runtime nav-clearance patch lists two style keys that do not exist, so the Monitoring list and several other scrollers keep hardcoded bottom padding instead of the font-scale- and inset-aware `navClearance`.

```
...Object.fromEntries(['devicesContent','managedContent','monitoringContent','chatListContent','appsContent','devicesListContent'].filter(key => key in baseStyles).map(key => [key, { ...(baseStyles as any)[key], ...navContent }])),
```

**Impact.** `monitoringContent` and `devicesListContent` are defined nowhere in the file (the Monitoring screen actually uses `monitorContent` and `monitorList`), so `.filter(key => key in baseStyles)` silently drops them and the intended fix never lands. The Monitoring list therefore keeps `monitorList { paddingBottom: 140 }` (App.tsx:4784). The same hardcoded-clearance pattern appears in ConnectHome.tsx:237 (140), ServiceQueueScreen.tsx:95 (130), ChatEmpty.tsx:69 (120) and — worst — MeetingHome.tsx:350 `paddingBottom: s(130)`, which SHRINKS as the screen narrows (108dp on a ~300dp viewport) while the nav pill it must clear stays a fixed 56dp tall. Required clearance is 68dp + insets.bottom (116dp with a 3-button nav bar), so on a 3-button-nav phone at reduced display size the last row of Recent meetings sits under the pill and cannot be tapped.

**Fix.** Fix the key names (`monitorContent`, `monitorList`) or, better, export `navClearance` and apply it directly in each module: `contentContainerStyle={[styles.listContent, { paddingBottom: navClearance }]}` in ConnectHome, ServiceQueueScreen, ChatEmpty and MeetingHome instead of the 120/130/140/s(130) literals.

### src/chat/ChatThread.tsx:1563
**Issue.** The conversation overflow menu is pinned at a hardcoded `top: 96` with a fixed 188dp width, so it overlaps the header/contact bar it is supposed to drop below and its labels wrap in a 130dp text column.

```
actionsMenu: {
    position: 'absolute',
    top: 96,
    right: 12,
    width: 188,
```

**Impact.** The chrome above it is header (`paddingVertical: 12` at line 1273 around a 20dp icon and an 18sp title) plus contactBar (44dp avatar + `paddingBottom: 12`) — roughly 104dp at default font scale and ~160dp at fontScale 2.0. Pinning the menu at 96dp means it already covers the bottom of the contact bar at default size, and at Large/Largest font it sits over the contact name and avatar. Inside, `sessionOptionRow` (2*16 padding) + a 16dp icon + a 10dp gap leaves 130dp for a 14sp label, so 'Unmute notifications' wraps to two lines even at default size.

**Fix.** Anchor the menu from a measured header height (`onLayout` on the contactBar, then `top: headerH + 8`) or clamp it with the unused `fitPopover` helper; change `width: 188` to `minWidth: 188, maxWidth: 260` and add `numberOfLines={1}` to `sessionOptionText`.

### App.tsx:902
**Issue.** DeviceListRow's label has numberOfLines={1} but no flex/minWidth:0, so a long group or device name consumes the whole row and pushes the 'N in session' pill past the right edge

```
<Text style={styles.deviceListLabel} numberOfLines={1}>{label}</Text>  ...  deviceListLabel: { color: '#111315', fontSize: 14, fontWeight: '500', lineHeight: 20 }  (App.tsx:3777-3782, no flex, no flexShrink)  inside  deviceListInner: { flexDirection: 'row', gap: 12, minHeight: 20, paddingHorizontal: 16 }  (App.tsx:3769-3776)
```

**Impact.** numberOfLines={1} makes RN report the FULL single-line width (clamped only by the AtMost available width), and with flexShrink defaulting to 0 nothing gives. Row inner width on a 360dp phone is 296dp, so any label wider than ~176dp (about 25 characters at 14sp, e.g. 'Zain's Windows 11 Workstation' or 'Engineering Workstations (14)') makes the content 16+12+296+12+80 = 416dp: the orange 'N in session' pill is laid out entirely outside the row and the label's own ellipsis lands past the screen edge, so the row looks truncated with no '...'. The threshold drops to ~19 characters at Android font scale 1.3 and to ~13 at 2.0. This is on the primary Devices tab (rendered at App.tsx:667 and :681 for 'Managed devices' and every group).

**Fix.** Add flex: 1 and minWidth: 0 to deviceListLabel and flexShrink: 0 to inSessionPill - the same shape App.tsx already uses correctly for the chat list (chatRowBody flex:1/minWidth:0 at App.tsx:4130, chatContactName flex:1 at :4142).

### App.tsx:1039
**Issue.** managedDeviceNameRow lets the device name push the 'In session' pill out of its flex column and over the row's action icons

```
managedDeviceNameRow: { alignItems: 'center', flexDirection: 'row', gap: 8 }  (App.tsx:3854-3858)  with  <Text style={[styles.managedDeviceName, ...]} numberOfLines={1}>{device.name}</Text>  (App.tsx:1039-1044) and no flex/flexShrink on either the Text or the pill
```

**Impact.** The parent managedDeviceText is flex:1 (App.tsx:3853) so the column width is fixed, but the name Text inside it is measured AtMost that full column width and does not shrink. Any device name long enough to fill the column (~28 chars at 12sp on a 360dp phone; ~21 at fontScale 1.3) makes the name row 8+pillWidth wider than its column, so the 'In session' badge is drawn on top of the connect / more-vertical icons at the right of the row (RN Android does not clip by default) or off-screen. That is on the Managed devices list - the screen where knowing which machine is in session matters most.

**Fix.** flex: 1 + minWidth: 0 on managedDeviceName, flexShrink: 0 on inSessionPill.

### src/chat/ChatThread.tsx:1565
**Issue.** The chat overflow menu is pinned at a hardcoded top: 96, which is less than the header + contact bar height once the OS font is enlarged, so the menu opens on top of the bar that spawned it

```
actionsMenu: {
    position: 'absolute',
    top: 96,
    right: 12,
    width: 188,
```

**Impact.** The menu's containing block is the KeyboardAvoidingView, whose top is the safe-area content top, so absolute Y = 96 regardless of how tall the chrome above it actually is. header (paddingVertical 12 + an 18sp title, ChatThread.tsx:1277 region) plus contactBar (44dp avatar + 12 paddingBottom) already measure ~103dp at fontScale 1.0, so the menu overlaps the contact bar by ~7dp out of the box; at 1.3 the overlap is ~15dp and at 2.0 the chrome is ~151dp tall and the menu covers the contact name, the online status and the very search / more-vertical buttons used to open it. Worst on small-and-tall phones where users most often raise the font size. It also ignores the searchBar row when search is open.

**Fix.** Measure the contact bar (onLayout) and position the menu from that, or render it in the normal flow right under the bar instead of at a magic offset.

### App.tsx:824
**Issue.** The monitoring list is unvirtualized (ScrollView + .map at App.tsx:824-825) so the whole fleet mounts on every tab switch; the per-row `new Date(...).toLocaleDateString()` at App.tsx:840 adds avoidable work in the render body but is a minor contributor, and it only runs for offline rows.

```
824:  <ScrollView style={styles.monitorListScroll} contentContainerStyle={styles.monitorList}>
825:    {visibleDevices.map((device) => (
...
840:      : `Offline${device.lastSeen ? ` · last seen ${new Date(device.lastSeen).toLocaleDateString()}` : ''}`}
```

**Impact.** Mid/low-end phones with a large fleet. Every render of the Monitoring screen does N Date allocations plus N Hermes `Intl.DateTimeFormat` formats — Intl formatting is one of the slowest operations available on Hermes. Because the screen also re-renders whenever the parent's presence/typing/toast state changes, this runs repeatedly while the user is just looking at the list, and the tab feels sticky when switching All/Offline/In session.

**Fix.** Use a FlatList as above, and precompute the last-seen label once when devices are mapped (in `mapDeviceItem`, App.tsx:283) instead of formatting in render. If it must stay in render, hoist a module-level `const DATE_FMT = new Intl.DateTimeFormat()` and call `DATE_FMT.format(...)` so the formatter is constructed once rather than per row.

### App.tsx:6647
**Issue.** useAppStyles rebuilds a 499-key style object plus ~12 fresh override objects on every call, and it is called once per list row (ChatContactRow App.tsx:1269, DeviceQuickRow :720, DeviceListRow :893, SettingsRow :2301), so a 50-row list does 50x499 property copies and 600 allocations per render — avoidable GC churn on scroll frames, worth hoisting behind a useMemo keyed on the responsive layout.

```
6641: function useAppStyles() {
6642:   const r = useResponsive();
...
6646:     ...baseStyles,
6647:     ...Object.fromEntries(['devicesContent','managedContent','monitoringContent','chatListContent','appsContent','devicesListContent'].filter(key => key in baseStyles).map(key => [key, { ...(baseStyles as any)[key], ...navContent }])),
6648:     loginGateContent: { ...baseStyles.loginGateContent, ...navContent, paddingTop: r.compact ? 16 : 32 },

(baseStyles is StyleSheet.create'd at App.tsx:3381 with 499 top-level keys; useAppStyles() is called at App.tsx lines 392, 403, 434, 478, 512, 550, 598, 720, 744, 893, 938, 1113, 1269, 1320, 1380, 1428, 1487, 1513, 1597, 1638, 1691, 1774, 1821, 1884, 1917, 1969, 2049, 2156, 2180, 2276, 2301, 2365, 2436)
```

**Impact.** Mid/low-end phones on any list screen. `DeviceQuickRow` (720), `DeviceListRow` (893), `ChatContactRow` (1269), `PermissionRow` (2156), `AccountInfoRow` (2276) and `SettingsRow` (2301) each call it, so a 50-conversation chat list performs 50 × 499 property copies plus 600 fresh object allocations per render, and a group list with 20 groups does the same per group. The 12 overridden keys are also plain objects rather than registered StyleSheet ids, so they defeat referential-equality fast paths and guarantee a style diff on every render even when nothing changed. This is GC pressure on exactly the frames where the user is scrolling.

**Fix.** Memoize the result and only recompute when the responsive inputs change: `const overrides = useMemo(() => ({ devicesContent: {...}, ... }), [r.gutter, r.navClearance, r.compact, r.insets.top, r.insets.bottom, r.illustrationHeight, r.contentWidth, r.splashWidth]); return useMemo(() => ({ ...baseStyles, ...overrides }), [overrides]);`. Better still, hoist it to a module-level cache keyed by the responsive signature so all 33 call sites share one object, and register the overridden entries with `StyleSheet.create` so they keep stable ids.

### App.tsx:2611
**Issue.** swipeNavigator is rebuilt by PanResponder.create on every AppContent render and spread onto the root View, so a re-render landing mid-swipe discards the accumulated gestureState.dx and the tab swipe silently fails to cross its 42px release threshold — the 'swiping between tabs only works sometimes' symptom.

```
2611:   const swipeNavigator = PanResponder.create({
2612:     onMoveShouldSetPanResponder: (_, gestureState) => (
...
(spread onto the root at App.tsx:3010)
3010:       <View style={styles.appRoot} {...swipeNavigator.panHandlers}>
```

**Impact.** All phones, worst on mid/low-end where re-renders take longer. Every AppContent re-render (chat-typing push, incoming message, presence flip, 30s poll) allocates a new PanResponder with a fresh internal gesture-state object and pushes six changed function props onto the root native View. If a re-render lands mid-swipe — which is likely, since typing pushes arrive continuously — the accumulated `dx` is thrown away and the swipe-between-tabs gesture silently fails to register. Users experience this as "swiping between tabs only works sometimes".

**Fix.** Create it once and read the changing values from a ref: `const screenRef = useRef(screen); screenRef.current = screen; const swipeNavigator = useRef(PanResponder.create({ onMoveShouldSetPanResponder: (_, g) => screenRef.current === 'connect' && Math.abs(g.dx) > 22 && ..., onPanResponderRelease: (_, g) => { ... } })).current;` — same for `goToAdjacentTab`, which should be read through a ref or a `useCallback` with stable deps.

### src/remote/RemoteControl.tsx:386
**Issue.** The connecting-screen progress sweep is an infinite `Animated.loop` with `useNativeDriver: false`, and its effect has no condition or cleanup tied to the connection state — it keeps running on the JS thread for the entire remote session.

```
381:   useEffect(() => {
382:     const loop = Animated.loop(Animated.timing(sweep, {
383:       toValue: 1,
384:       duration: 1600,
385:       easing: Easing.inOut(Easing.ease),
386:       useNativeDriver: false,
387:     }));
388:     loop.start();
389:     return () => loop.stop();
390:   }, [sweep]);

(`sweep` is consumed only on the connecting cover, RemoteControl.tsx:1215, which is unmounted once streaming starts)
```

**Impact.** Mid/low-end phones, both while connecting and for the whole session afterwards. During connect the bar animates on the JS thread while that same thread is doing SDP/ICE work, so the progress bar visibly stutters. After the stream starts the cover is unmounted but the loop never stops, so a requestAnimationFrame-driven timing loop keeps ticking on the JS thread alongside touch dispatch and the 30Hz cursor updates — it competes with exactly the work that makes remote control feel immediate.

**Fix.** Drive it natively and stop it when it is not on screen: change to `useNativeDriver: true` (a `translateX` transform is natively supported) and gate the effect: `useEffect(() => { if (streamUrl || status === 'error' || status === 'lost') return; const loop = Animated.loop(...); loop.start(); return () => loop.stop(); }, [sweep, streamUrl, status]);` — matching the guard the rotating-status effect at line 372 already uses.

### src/meetings/MeetingRoom.tsx:164
**Issue.** A 1Hz interval forces a full re-render of the 1,540-line MeetingRoom component (42 useState hooks, zero useMemo/useCallback/React.memo) purely to advance an elapsed-time label.

```
164:     const timer = setInterval(() => setElapsedSeconds((value) => value + 1), 1000);

(consumed only at MeetingRoom.tsx:958-962 to build the `elapsed` string; the unmemoized tiles are rebuilt at 987-1016)
1006:    <MeetingTile
1010:      onFullscreen={() => setIsImmersive(true)}
1011:      onPress={() => toggleFocus(participant.connectionId)}
```

**Impact.** Mid/low-end phones in a multi-participant meeting. Every second the whole meeting screen re-renders: `sharerIds` and `rosterRows` are rebuilt, `participant.stream?.toURL?.()` is called per participant, and every `MeetingTile` — none of which is memoized and all of which receive fresh inline arrow props — re-reconciles along with its RTCView. On a 6-person call this is a per-second reconciliation hitch that reads as the controls being sluggish to tap.

**Fix.** Isolate the clock into its own leaf: `function MeetingTimer() { const [s, setS] = useState(0); useEffect(() => { const t = setInterval(() => setS(v => v + 1), 1000); return () => clearInterval(t); }, []); return <Text style={styles.timer}>{format(s)}</Text>; }` and render `<MeetingTimer />` where `elapsed` is used, so the tick never leaves that component. Separately, wrap `MeetingTile` in `React.memo` and give it stable `useCallback` handlers keyed by connection id.

### src/meetings/MeetingHome.tsx:119
**Issue.** A 1Hz interval stores a whole `Date` object in state to display an hour:minute clock, re-rendering the 536-line meetings home screen every second and running two Intl formatters each time.

```
119:     const timer = setInterval(() => setCurrentTime(new Date()), 1000);
...
192:   const formattedTime = currentTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
193:   const formattedDate = currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
```

**Impact.** Mid/low-end phones sitting on the Meetings tab. 59 out of every 60 ticks produce an identical visible string, and each one costs a full screen re-render plus two Hermes Intl formats (the date one with weekday+month+day is the expensive variant). Scrolling the meetings list stutters roughly once a second.

**Fix.** Extract the clock into its own tiny component so the tick is scoped to it, and tick on the minute boundary instead of every second: compute `msToNextMinute` and `setTimeout` to it, then `setInterval(..., 60_000)`. Hoist the two formatters to module scope as `Intl.DateTimeFormat` instances so they are constructed once.

### App.tsx:689
**Issue.** An O(groups × devices × groupsPerDevice) nested scan runs in the DevicesScreen render body, once per group, on every render.

```
683:            visibleGroups.map((group) => (
...
689:                sessionCount={devices.filter((d) => d.inSession && d.groups.some((g) => g.id === group.id)).length}
```

**Impact.** Mid/low-end phones on a real fleet. With 99 devices and 20 groups this is ~2,000 device visits each running an inner `.some` over that device's groups — every render, and DevicesScreen re-renders on every parent state change as well as on every keystroke in its own group-search box (`onChangeText={setQuery}`, App.tsx:634). Typing in the group search visibly lags the keyboard.

**Fix.** Build the counts once per device-list change: `const sessionCountByGroup = useMemo(() => { const m = new Map<string, number>(); for (const d of devices) if (d.inSession) for (const g of d.groups) m.set(g.id, (m.get(g.id) ?? 0) + 1); return m; }, [devices]);` then pass `sessionCount={sessionCountByGroup.get(group.id) ?? 0}`. Also memoize `ungroupedCount`, `offlineCount`, `inSessionCount` and `visibleGroups` (App.tsx:574-578).

### App.tsx:2951
**Issue.** `scopedDevices` performs a nested lookup over the group list for every device, unconditionally, on every AppContent render — even when the managed-devices screen is not on screen.

```
2951:   const scopedDevices = devices.filter((device) => {
2952:     if (deviceScope.type === 'mine') return device.groups.length === 0;
2953:     if (deviceScope.type === 'group') {
2954:       return device.groups.some((group) => group.id === deviceScope.groupId)
2955:         || deviceGroups.find((group) => group.id === deviceScope.groupId)?.deviceIds.includes(device.id);
2956:     }
2957:     return true;
2958:   });
```

**Impact.** Mid/low-end phones with a large fleet. Because AppContent re-renders on every typing push, presence flip and toast, this runs constantly in the background while the user is on the Chat or Meetings tab, doing devices × groups × deviceIds work for a screen that isn't visible. It also produces a new array identity every time, which would defeat any `React.memo` later added to `ManagedDevicesScreen`.

**Fix.** `const scopedDevices = useMemo(() => { if (deviceScope.type === 'all') return devices; const target = deviceScope.type === 'group' ? deviceGroups.find(g => g.id === deviceScope.groupId) : null; const ids = target ? new Set(target.deviceIds) : null; return devices.filter(d => deviceScope.type === 'mine' ? d.groups.length === 0 : d.groups.some(g => g.id === deviceScope.groupId) || ids?.has(d.id)); }, [devices, deviceGroups, deviceScope]);` — hoisting the group lookup out of the per-device loop and adding an early return for the common 'all' case.

### android/gradle.properties:31
**Issue.** All four ABIs — including the emulator-only x86 and x86_64 — are built into a single universal artifact, with no `splits { abi }` block and no `enableSeparateBuildPerCPUArchitecture` anywhere in the project.

```
31: reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64

(grep for `splits`/`abiFilters`/`enableSeparateBuildPerCPUArchitecture` across android/**/*.gradle and *.properties returns nothing; eas.json's `development` and `preview` profiles both set `"buildType": "apk"`, so those are universal APKs)
```

**Impact.** Low-storage phones installing the APK profiles directly (the same distribution channel this repo already uses for the Android host). react-native-webrtc's libjingle plus the Hermes and Fabric .so files are duplicated across four architectures, two of which no real phone can execute — roughly doubling the download and install footprint for nothing.

**Fix.** For the store path keep the AAB (the `production` profile already omits `buildType`, so Play splits per-ABI automatically). For the APK profiles, drop x86/x86_64 (`reactNativeArchitectures=armeabi-v7a,arm64-v8a`) and add an ABI split in android/app/build.gradle: `splits { abi { enable true; reset(); include 'armeabi-v7a', 'arm64-v8a'; universalApk false } }`.

### app.json:60
**Issue.** The React Compiler is explicitly disabled, in an app that has no manual memoization at all to fall back on.

```
58:     "experiments": {
59:       "reactCompiler": false
60:     },
```

**Impact.** Mid/low-end phones everywhere in the app. This is the one-line lever that would auto-memoize the ~4,200-line AppContent, the 1,540-line MeetingRoom, the unmemoized MessageBubble/ChatContactRow/DeviceListRow rows and the fresh inline arrow props they all receive — every cascade described in the findings above. With it off and zero React.memo/useMemo/useCallback in the codebase, nothing at all stops a re-render from propagating to the leaves.

**Fix.** Set `"reactCompiler": true` in app.json's `experiments` block (the project is already on React 19.1.0 / RN 0.81.5 / Expo 54, which support it), install `babel-plugin-react-compiler`, then profile the chat list and the devices list before/after. Treat it as a complement to — not a replacement for — virtualizing the lists, since the compiler cannot fix an unvirtualized ScrollView.

### src/remote/RemoteControl.tsx:881
**Issue.** The video surface's touch-responder handlers are an object literal rebuilt in the render body, so all six responder callbacks change identity on every render — including renders driven by 30Hz cursor pushes from the host.

```
881:   const surfaceResponder = {
882:     onStartShouldSetResponder: () => true,
883:     onMoveShouldSetResponder: () => true,
884:     onResponderGrant: (e: any) => {

(spread onto the surface at RemoteControl.tsx:1251 `{...surfaceResponder}`; the 30Hz driver is at 607-625)
620:               cursorPos.setValue({
624:               setCursorVisible(Boolean(data.visible));
```

**Impact.** Mid/low-end phones during an active remote session. The host reports its pointer at ~30Hz (the code's own comment at line 608 says so); each message does a JS-driven `Animated.ValueXY.setValue` plus a `setCursorVisible`, and any render that results replaces every responder prop on the video surface. Drags across the remote desktop can lose their responder mid-gesture, which shows up as a drag that stops tracking or a click that lands in the wrong place.

**Fix.** Build the handlers once with `useRef`/`useMemo` (all the mutable state they read already lives in refs — `gestureRef`, `liveRectRef`, `contentRectRef`, `surfaceOriginRef` — so `useMemo(() => ({...}), [])` is safe after moving the remaining `fitMode`/`hostIsMobileDevice` reads into refs). Separately, guard the cursor visibility write: `setCursorVisible(v => v === next ? v : next)` is unnecessary, but do skip the update entirely when `Boolean(data.visible) === cursorVisibleRef.current`.

### assets/no-sign.png:1
**Issue.** Illustration PNGs ship at 1,254-1,920 px and up to 703 KB while being displayed at 200-230 dp, with no @2x/@3x variants and no resizeMethod hint.

```
recent.png  1394x1128  703KB   → ConnectHome.tsx:119 <Image source={heroImage} .../> (styles.heroImage: width '100%', height '100%')
no-sign.png 1254x1254  628KB   → App.tsx:1620 <Image source={noSignImage} style={styles.loginGateImage} .../>
                                  App.tsx:6649 loginGateImage: { ...baseStyles.loginGateImage, height: r.illustrationHeight, width: Math.min(200, r.contentWidth) }
wait.png    1920x1633  179KB   → RemoteControl.tsx:1196 <Image source={waitImage} style={styles.connectingImage} .../>
                                  RemoteControl.tsx:1743 connectingImage: { width: 230, height: 190 }
```

**Impact.** Low-RAM phones (2-3 GB). wait.png alone is ~12.5 MB of ARGB_8888 bitmap for a 230x190 dp view, no-device.png ~9.2 MB, no-sign.png ~6.3 MB; recent.png and no-sign.png together are 1.3 MB of the ~2 MB assets directory. The connecting cover in particular decodes wait.png at the exact moment WebRTC setup is competing for CPU, so the connect screen appears late and janky on entry-level hardware.

**Fix.** Downscale the sources to roughly 3x the largest displayed size (about 700x600 for wait.png, 600x600 for no-sign.png, 600x520 for no-device.png) and re-export as optimised PNG or WebP — webp support is already enabled in gradle.properties (`expo.webp.enabled=true`). Also add `resizeMethod="resize"` to these `<Image>` calls so Fresco downsamples at decode time rather than allocating the full bitmap.

### src/remote/RemoteControl.tsx:382
**Issue.** An infinite JS-driven Animated.loop (useNativeDriver: false) is started on mount of the remote-control screen and is never stopped when the stream connects — it keeps ticking on the JS thread for the entire remote session, the one screen where JS-thread latency is the product.

```
381: useEffect(() => {
382:   const loop = Animated.loop(Animated.timing(sweep, {
383:     toValue: 1,
384:     duration: 1600,
385:     easing: Easing.inOut(Easing.ease),
386:     useNativeDriver: false,
387:   }));
388:   loop.start();
389:   return () => loop.stop();
390: }, [sweep]);   // sweep is a useRef value -> deps never change -> only stops on unmount

(`sweep` is consumed at exactly one place, RemoteControl.tsx:1215, inside the connecting cover: `translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-140, 280] })`)
```

**Impact.** Mid/low-end phones (Snapdragon 4xx / 665-class) during an active remote-control session. Because useNativeDriver is false, the animation is driven by a requestAnimationFrame callback on the JS thread at display refresh rate — the same thread that must dispatch onResponderMove for the surface responder (RemoteControl.tsx:919) and serialise every mousemove/wheel JSON over the data channel. The connecting cover unmounts as soon as streamUrl arrives, so the loop is invisible work for the whole session and it can never be seen to be running.

**Fix.** Gate the loop on the cover being visible — start it only while `!streamUrl && status !== 'error' && status !== 'lost'` (the same guard the sibling effect at RemoteControl.tsx:371-377 already uses for the rotating status text) and add those to the dependency array, so `loop.stop()` runs the moment the stream connects. Switching to a transform-only animation with useNativeDriver: true would additionally take it off the JS thread while it is visible.


## LOW

### App.tsx:3637
**Issue.** styles.iconButton (App.tsx:3637-3642) is a fixed 28x28dp target used without hitSlop at App.tsx:520, 614, 617, 620, 769, 772, 966, 969, 972, 1137, 1391, 1445 and 1614, below the 48x48dp Android Material / 44x44pt iOS minimum, and on ManagedDevices three of them sit only 18dp apart (managedActions, App.tsx:3808-3812) so a miss triggers the neighbouring action. It fails the Android accessibility scanner. It is however identical on every device class - dp is density-independent - so it is a touch-target bug, not a screen-adaptation bug. Fix: add hitSlop={10} (cheapest) or raise iconButton to 44x44 with a negative margin.

```
App.tsx:3637-3642  iconButton: { alignItems: 'center', height: 28, justifyContent: 'center', width: 28 },
used with no hitSlop at App.tsx:520, 614, 617, 620, 769, 772, 966, 969, 972, 1137, 1391, 1445, 1614
```

**Impact.** All phones, worst on small (320-360dp) and very high-density displays where 28dp is roughly 5mm — under the ~9mm finger target. Settings, search, refresh and the Devices tour '?' button are frequently mis-tapped or miss entirely; the three Managed-devices buttons sit only 18dp apart (App.tsx:3808-3812) so a miss often triggers the neighbouring action instead. It also fails the Android accessibility scanner's touch-target check.

**Fix.** Either raise the style to `height: 44, width: 44` (the header already grows via `minHeight` in HeaderFrame so it will not clip) or add `hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}` to each Pressable. `ChatContactRow`'s clear button already uses hitSlop (App.tsx:1161) so the pattern exists in the file.

### App.tsx:3748
**Issue.** styles.deviceGroupTitle (App.tsx:3744-3750) sets height:14 on a Text whose fontSize and lineHeight both scale with the OS font setting, used for the 'Managed devices' and 'Groups' section labels (App.tsx:664, 676). At Android font size >= 130% / iOS Larger Text the glyph box exceeds the 14dp container and the label is vertically clipped (descenders cut); at 200% only the top half of the label is visible. It does not overlap the row below - Text clips to its own bounds. Fix: replace height:14 with minHeight:14 as every neighbouring style in this list already does.

```
App.tsx:3744-3750  deviceGroupTitle: { color: '#111315', fontSize: 10, fontWeight: '400', height: 14, lineHeight: 14 },
used at App.tsx:664 <Text style={styles.deviceGroupTitle}>Managed devices</Text> and App.tsx:676 <Text style={styles.deviceGroupTitle}>Groups</Text>
```

**Impact.** Any device with Android font size >= 130% or iOS Larger Text. At 1.3x the glyph box becomes ~18dp inside a 14dp container, at 2.0x ~28dp inside 14dp: the 'Managed devices' and 'Groups' section labels are clipped at the baseline (descenders in 'g' cut off) and the text overlaps the first `DeviceListRow` under it, since the parent `deviceGroup` (App.tsx:3741) has no gap.

**Fix.** Replace `height: 14` with `minHeight: 14` (and drop the fixed `lineHeight: 14`, or scale it), matching the fix already applied to `quickRowTall` (App.tsx:3720-3721: `height: undefined, minHeight: 48`) and `deviceListRow` (App.tsx:3762).

### App.tsx:819
**Issue.** The status filter tabs are equal-width flex:1 cells with only 4dp of horizontal padding whose labels are locked to numberOfLines={1} (App.tsx:813/816/819 on Monitoring, 1004/1010/1017 on ManagedDevices), contradicting monitorTab's own comment at App.tsx:4753 that minHeight:40 exists so a wrapped label is never clipped. On a 360dp phone at default font the longest label already renders as 'In sessio…' (~101dp cell vs ~112dp needed), and at font size >= 130% both 'Offline (n)' and 'In session (n)' lose their counts. The short 'All (n)' tab is unaffected. Fix: drop numberOfLines={1} (or set it to 2) so the label wraps into the minHeight the style already reserves.

```
App.tsx:819  <Text numberOfLines={1} style={styles.monitorTabText}>In session ({inSessionDevices.length})</Text>
App.tsx:4750-4757  monitorTab: { alignItems: 'center', backgroundColor: '#FFFFFF', flex: 1, minHeight: 40, justifyContent: 'center', paddingHorizontal: 4 }
same markup reused on ManagedDevicesScreen at App.tsx:1017
```

**Impact.** 320dp phones at default font, and 360-412dp phones at font size >= 130%. Each cell is width/3; on a 320dp screen (minus the 32dp screen gutter) that is ~96dp usable, while 'In session (12)' at 14sp needs ~105dp — the label renders as 'In sessio…'. At 1.3x on a 360dp phone all three read 'All (1…', 'Offlin…', 'In ses…', so the user cannot tell the filters apart or read the counts.

**Fix.** Drop `numberOfLines={1}` (the cell already has `minHeight: 40` and centres content, so two lines fit and grow), raise `paddingHorizontal` to 8, and add `textAlign: 'center'` to `monitorTabText` (App.tsx:4764). For very narrow/large-font cases, use the existing `r.stackActions` flag (src/lib/responsive.ts:10) to switch the row to a wrapping layout.

### App.tsx:3685
**Issue.** The device/group search box and its input are locked to 42dp / 40dp tall around a 14sp input that DOES scale with the OS font setting (unlike the two fields above, these have no allowFontScaling opt-out).

```
App.tsx:3679-3688  deviceSearchBox: { ... height: 42, paddingHorizontal: 12, width: '100%' }
App.tsx:3689-3696  deviceSearchInput: { color: '#111315', flex: 1, fontSize: 14, fontWeight: '500', height: 40, padding: 0 }
used at App.tsx:633-640 (Devices, 'Search groups') and App.tsx:987-995 (Managed devices, 'Search devices')
```

**Impact.** Android font size 175-200% (reachable in Settings > Display > Font size on Android 14+) or iOS accessibility text sizes: 14sp becomes 24-28dp with a ~34-39dp line box inside a 40dp input with `padding: 0`, so the typed device name is vertically clipped — ascenders/descenders are cut and on some OEM ROMs the text baseline slides out of the box entirely.

**Fix.** Change both `height` values to `minHeight` and add a small `paddingVertical` so the box grows with the text, as the file already does for `deviceListRow` (3762) and `managedDeviceRow` (3826).

### App.tsx:5130
**Issue.** The login-gate buttons are fixed at `height: 44` around 14sp labels that scale with the OS font setting.

```
App.tsx:5126-5133  loginGatePrimary: { alignItems: 'center', backgroundColor: '#FF8A00', borderRadius: 4, height: 44, justifyContent: 'center', width: '100%' }
App.tsx:5140-5148  loginGateSecondary: { ... height: 44, ... }
rendered at App.tsx:1623-1628 ('Sign in' / 'Create an account')
```

**Impact.** Android font size >= 175%: 'Create an account' renders at ~25sp inside a 44dp pill and is clipped top and bottom; at 200% the label is also wider than the 360dp button on a small phone and wraps to a second line that is entirely outside the button. This is the only route to sign in from the Chat/Devices/Meeting/Apps gate, so it is a hard stop for those users.

**Fix.** Replace `height: 44` with `minHeight: 44` plus `paddingVertical: 10, paddingHorizontal: 12` on both styles, and let the label wrap.

### App.tsx:552
**Issue.** The app is hard-locked to portrait, so no landscape layout exists — yet the shell contains several non-scrollable, vertically-centred containers that only fit in a tall viewport. On large screens the OS ignores the lock.

```
app.json:7  "orientation": "portrait"
android/app/src/main/AndroidManifest.xml:30  android:screenOrientation="portrait" ... android:configChanges="keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode"
non-scrollable shell containers: App.tsx:1074 <View style={styles.noDeviceContent}> (flex:1, justifyContent center), App.tsx:778 <View style={styles.monitorContent}>, App.tsx:491 SplashScreen
```

**Impact.** Tablets and unfolded foldables (>= 600dp smallest width), where Android 14+/16 ignores per-activity `screenOrientation` and lets the user rotate anyway, plus iPad (`ios.supportsTablet: true`, app.json:16). In a ~800x600dp landscape window the usable height under the header is ~500dp minus the nav clearance; `noDeviceContent` (needs ~525dp) clips its 'Add' button with no scroll, and `monitorContent`'s endpoint summary + filter tabs leave the device list a ~100dp slit. Nothing in the shell caps or re-flows for a wide, short viewport — `monitorContent` also misses the maxWidth 720 cap (see the useAppStyles typo finding), so rows stretch the full tablet width.

**Fix.** Make the shell survive a short viewport rather than relying on the lock: wrap `noDeviceContent` and the Monitoring body in ScrollViews with `flexGrow: 1` content containers, and use the existing `r.compact` flag (src/lib/responsive.ts:7, true when safeHeight < 600) to drop the large illustration and shrink the vertical gaps. If landscape genuinely must never render, that is a product decision — but the current code neither supports it nor is protected from it on large screens.

### src/chat/ChatEmpty.tsx:28
**Issue.** The chat empty state hardcodes a 60dp header height instead of the responsive headerHeight, so it slides under the header at large font scale

```
ChatEmpty.tsx:28  <View style={[styles.wrap, { top: insets.top + 60 }]}>
vs App.tsx:395 HeaderFrame's real height: minHeight: headerHeight + insets.top, where src/lib/responsive.ts:11 defines headerHeight: Math.max(60, 24 * fontScale + 24)
```

**Impact.** Any phone at Android font size >= 160% (fontScale 1.6 makes headerHeight 62.4dp, 2.0 makes it 72dp), on the first-run Chat tab (App.tsx:1144). The absolutely-positioned empty-state wrapper starts up to 12dp above the real bottom of the header, so the top of the 200dp illustration is drawn behind the header bar. The header can also exceed headerHeight when its own content grows, which this constant cannot track at all.

**Fix.** Take headerHeight from useResponsive() inside ChatEmpty and use top: insets.top + headerHeight, or accept the header height as a prop from the caller.

### App.tsx:3181
**Issue.** `iconButton` (App.tsx:3637-3642) is a fixed 28x28dp target with no hitSlop, used at 14 header call sites including 3181 and 1614 — below the 48dp Material minimum on every device equally, and it does not scale with the OS font/display settings.

```
3181 `<Pressable style={styles.iconButton} onPress={openSettings}>` with `iconButton: { alignItems: 'center', height: 28, justifyContent: 'center', width: 28 }` (3637-3642). The neighbouring nav tabs correctly compensate with `hitSlop={{ top: 14, bottom: 14, left: 6, right: 6 }}` (2396); this one has none.
```

**Impact.** 28dp is ~4.4 mm of physical glass regardless of density, versus the 9 mm / 48dp Material minimum. On small 5" phones (320-360dp) it sits hard against the screen edge inside a 16dp-padded header, so thumb presses land on the header background and do nothing; users with reduced motor precision miss it repeatedly. The same `iconButton` style is reused for the header gear on the login-gate screen (1614), so the defect is fleet-wide, not screen-specific.

**Fix.** Add `hitSlop={10}` to the Pressable at 3181 (and 1614), or change the style to `iconButton: { alignItems: 'center', justifyContent: 'center', minWidth: 44, minHeight: 44 }` — the icon stays 20dp, only the touch box grows.

### App.tsx:3346
**Issue.** On a ≤360dp phone at fontScale ≳1.6 the non-wrapping, non-shrinking action row overflows the 235dp available inside `passwordCard`; because ResponsivePanel sets `overflow: 'hidden'`, the Cancel button is clipped off the left edge of the dialog and becomes unreachable. `responsive.ts:10` already computes `stackActions` for exactly this case and is never consulted here.

```
3346 `<View style={styles.passwordActions}>` → `passwordActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 }` (6616) — no `flexWrap`, and neither child sets `flexShrink` (`passwordCancel: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 }` 6617, `passwordConnect: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: '#FF8A00' }` 6619-6624). Card is `passwordCard: { width: '86%', maxWidth: 380, … padding: 20 }` (6596-6601).
```

**Impact.** On a 320dp phone the card is 275dp wide and, after the 20dp padding that ResponsivePanel moves into the scroll content, leaves 235dp for the row. The two buttons already consume 72dp of fixed horizontal padding plus a 10dp gap; the labels ('Cancel' and the wider connecting state 'Connecting…') exceed the remaining 153dp once fontScale reaches ~1.5. React Native's default `flexShrink` is 0, so nothing shrinks — with `justifyContent: 'flex-end'` the row overflows to the LEFT and the Cancel button is drawn outside the white card on the dim backdrop, where it looks disabled and taps land on the dismiss overlay behind it. `responsive.ts:10` already computes a `stackActions` flag for exactly this case (`safeWidth < 360 || fontScale > 1.3`) but this dialog never consults it.

**Fix.** Add `flexWrap: 'wrap'` and `rowGap: 8` to `passwordActions` (6616), and give both buttons `flexShrink: 1` plus `alignItems: 'center'`; or consume the existing flag — `const { stackActions } = useResponsive()` and apply `stackActions && { flexDirection: 'column', alignItems: 'stretch' }` to the row, which is what the helper was written for.

### App.tsx:6647
**Issue.** Two of the six whitelist entries are dead (`monitoringContent` is a typo for `monitorContent`, `devicesListContent` does not exist), so MonitoringOverviewScreen keeps its raw literals and never gets the 720dp content cap on wide screens. The meetingContent/chatContent evidence is void — those styles are unreferenced dead code.

```
6647 `...Object.fromEntries(['devicesContent','managedContent','monitoringContent','chatListContent','appsContent','devicesListContent'].filter(key => key in baseStyles).map(key => [key, { ...(baseStyles as any)[key], ...navContent }])),` — `monitoringContent` and `devicesListContent` appear nowhere else in App.tsx (the real key is `monitorContent`, defined at 4684 and used at 778); the `.filter(...)` discards them with no warning.
```

**Impact.** Anything outside the whitelist keeps its raw literals — e.g. `meetingContent: { gap: 48, paddingBottom: 120, paddingHorizontal: 16, paddingTop: 30, width: '100%' }` (4347-4352) and `chatContent: { … paddingBottom: 120, paddingHorizontal: 16 … }` (4605-4613), both mounted live from this slice (MeetingScreen at App.tsx:3256, ChatScreen at 3240). On a 10" tablet or an unfolded foldable (900-1280dp) those screens stretch a 16dp gutter across the full width, so 14px body text runs 1250dp long lines while the nav pill stays a 420dp island at the bottom — the classic 'blown-up phone app' look. Their `paddingBottom: 120` literals also repeat the clearance bug in finding 7 on 3-button-nav devices.

**Fix.** Fix the two names (`monitoringContent` → `monitorContent`, remove or correct `devicesListContent`), then replace the silent filter with a dev-time assertion so a typo fails loudly: `if (__DEV__) keys.forEach(k => { if (!(k in baseStyles)) console.warn('useAppStyles: unknown style key', k); })`. Add `meetingContent`, `chatContent` and `noDeviceContent` to the list so the tablet layout is capped like the others.

### App.tsx:2402
**Issue.** The nav's white 'puzzle slot' halo is 44dp wide but the orange circle it is meant to frame is 46dp, so the circle is 1dp wider than its own backdrop on each side and the intended white gap does not exist horizontally.

```
2402 `<Svg width={46} height={46} style={StyleSheet.absoluteFill}>` with `Circle cx={23} cy={23} r={23}` (2409) inside `navRaised: { width: 46, height: 46, borderRadius: 23, … }` (6574-6579), nested in `navHalo: { backgroundColor: '#FFFFFF', … width: 44, height: 52, borderRadius: 26 }` (6570-6572). The comment at 6563-6564 states the intent: 'leaves a white gap around the orange button (the "puzzle" slot)'.
```

**Impact.** Visible on every device, and increasingly so with density: on a 3x/4x screen the 1dp spill is 3-4 physical pixels of orange touching the grey pill, so the active tab reads as a lozenge jammed into the bar rather than the designed floating circle. It is most obvious on small phones where the tab slot is already tight (see finding 2), because the halo is then also clipped laterally by its neighbours.

**Fix.** Set `navHalo.width` to at least `navRaised.width + 2 * gap` — e.g. width 52, height 52, borderRadius 26 at 6570-6572 — or shrink `navRaised`/the `<Svg>` to 40 and the `Circle` to `cx={20} cy={20} r={20}`. Keep the two in one shared constant so they cannot drift again.

### App.tsx:2391
**Issue.** Every icon in the shell is a hardcoded dp size that never consults `fontScale`, so icons and the text beside them drift apart as the user raises the OS font size.

```
2391 `const icon = <NavTabIcon tabKey={tab.key} color={iconColor} size={21} />;`, 2411 `<NavTabIcon tabKey={tab.key} color="#FFFFFF" size={18} />`, 2423 `<Ionicons name="add" size={26} color="#FFFFFF" />`, 3182 `<Feather name="settings" size={20} color="#111315" />` — none derived from `useWindowDimensions().fontScale`, while the adjacent `<Text>` elements have no `allowFontScaling={false}` and do scale.
```

**Impact.** At fontScale 2.0 (Android 'Largest' font size, iOS Larger Text) the settings title next to the 20dp gear doubles to 32sp while the gear stays 20dp, and on the iOS nav bar an 11px label becomes 22px under a still-22dp icon — the icon reads as a decorative dot beside oversized text. Purely cosmetic, but it is the visual tell that separates this app from the native Kotlin host, whose Compose icons are sized in sp-aware units.

**Fix.** Add an `iconScale` to `getResponsiveLayout` (src/lib/responsive.ts) — `iconScale: Math.min(1.4, Math.max(1, fontScale))` — and multiply icon sizes by it at the call sites: `size={Math.round(21 * iconScale)}`. Cap it so nav icons cannot outgrow the 56dp pill.

### App.tsx:1727
**Issue.** Lines 1668-2314 are a complete, unreachable duplicate of eight settings screens plus their row primitives — a second, unmaintained set of layout rules that any responsiveness fix would be silently applied to instead of the live code.

```
1727 `<SettingsRow icon="bar-chart-2" title="Upgrade Remote 365" onPress={onUpgradePress} />` inside `function SettingsScreen({ … })` (1668). Grepping App.tsx for `<SettingsScreen`, `<AccountScreen`, `<UpgradePlanScreen`, `<PrivacyPolicyScreen`, `<PermissionsScreen`, `<TrustedDevicesScreen`, `<FeedbackScreen`, `<BiometricScreen` returns zero JSX usages; AppContent mounts the imported versions instead — 3106 `<RemoteSettingsScreen`, 3098 `<SettingsAccountScreen`, 3091 `<SettingsUpgradePlanScreen`, 3046 `<SettingsPrivacyPolicyScreen`, 3054 `<SettingsPermissionsScreen`, 3052 `<SettingsTrustedDevicesScreen`, 3050 `<SettingsFeedbackScreen`, 3048 `<SettingsBiometricScreen` (all from `./src/settings/*`).
```

**Impact.** No runtime impact today — none of it renders on any device. The hazard is process: ~650 lines of JSX and ~90 style keys (`settingsContent` 5503, `accountContent` 6328, `upgradeContent` 5627, `privacyContent` 5763, `permissionsContent` 5864, `trustedContent` 5937, `feedbackContent` 6054, `biometricContent` 6177 — none of them in the responsive whitelist at 6647) look live to anyone auditing this file, so a fix for a small-screen or font-scale bug lands here and changes nothing on the device, while the real `src/settings/*` copy keeps the defect. That is a plausible reason the app still feels unresponsive despite responsive helpers being present.

**Fix.** Delete lines 1668-2314 (`SettingsScreen`, `UpgradePlanScreen`, `PrivacyPolicyScreen`, `PermissionsScreen`, `TrustedDevicesScreen`, `FeedbackScreen`, `BiometricScreen`, `PermissionRow`, `AccountScreen`, `AccountInfoRow`, `SettingsRow`) and the style keys only they reference, then re-run the audit against `src/settings/*`, which is what users actually see.

### src/connect/ServiceQueueScreen.tsx:117
**Issue.** Service Queue row's Join button has a hardcoded 34dp height around text that scales with the OS font setting

```
`joinButton: { height: 34, paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#FF8A00', alignItems: 'center', justifyContent: 'center' }` (117-124) with `joinText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' }` (125); the row itself (`row`, 96-105) is `flexDirection: 'row'` with no `flexWrap`.
```

**Impact.** Mounted live from App.tsx:3165. 13sp text needs ~18dp at fontScale 1 but ~33-36dp at Android's 200% font setting, which exceeds the 34dp box: the 'Join' label is vertically clipped or spills outside the orange pill. The button is also below the 48dp touch-target minimum at every font size, and because the row cannot wrap, the growing button squeezes `rowCopy` (flex:1) so the already `numberOfLines={1}` name and metadata truncate earlier than necessary on 320-360dp phones.

**Fix.** Swap `height: 34` for `minHeight: 44` with `paddingVertical: 8`, and let the row wrap (or stack the Join button under the copy) once `fontScale > 1.3`.

### App.tsx:4750
**Issue.** monitorTab (4750) truncates its longest label ('In session (n)') to 'In sess…' on 320dp phones and on 360dp at fontScale >= 1.3, because the label is numberOfLines={1} with no adjustsFontSizeToFit and the minHeight:40 slack is never used for wrapping. Cosmetic only — the counts are lost from view, the filters still work.

```
monitorTab: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flex: 1,
    // minHeight so a wrapped/scaled label is never clipped.
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
```

**Impact.** 320dp-wide phones, and 360dp at fontScale ≥ 1.3. Used in two places with three tabs: Monitoring Overview (804-820) and Managed Devices (1001-1019, where the tab strip sits inside `managedContent`'s 12dp gutters, so each tab is only ~91dp). "In session (12)" needs ~108dp at the default font size and ~140dp at 1.3, so it renders as "In sess…" or "In s…" — the user cannot tell the third filter from the second. The `numberOfLines={1}` on the label means it truncates rather than wrapping into the `minHeight: 40` slack that the comment above it deliberately reserved.

**Fix.** Drop `numberOfLines={1}` so the label can use the two lines `minHeight: 40` already allows, or add `adjustsFontSizeToFit minimumFontScale={0.8}`; on `safeWidth < 360` fall back to icon-only or a horizontally scrollable strip.

### App.tsx:4782
**Issue.** `monitorList` hardcodes `paddingBottom: 140` for nav clearance instead of the computed `r.navClearance`, and the `useAppStyles` override list that would have fixed it names `monitoringContent`, a key that does not exist in `baseStyles`, so that entry is filtered out and does nothing.

```
monitorList: {
    paddingTop: 4,
    // Clears the floating nav pill so the last device can scroll fully into
    // view instead of being cut off at the bottom.
    paddingBottom: 140,
    gap: 2,
  },
```

**Impact.** Monitoring Overview (ScrollView at 824) on 3-button-nav Android phones: the pill's raised active-tab halo (navHalo `translateY: -26`, 6569) tops out exactly 140dp above the scroll viewport's bottom, so the last monitored device row sits flush against it with zero margin and is visually touched by the halo; every other list on the app gets 152dp from `navClearance` at the same settings. `Object.fromEntries(['devicesContent','managedContent','monitoringContent',...].filter(key => key in baseStyles)...)` at 6647 silently drops both `monitoringContent` and `devicesListContent`, so this list never receives the responsive padding the other five do.

**Fix.** Either rename the key to a real one and add `monitorList` to the override list at 6647, or set `paddingBottom: r.navClearance` directly; also delete the two dead key names so the list stops lying about its coverage.

### App.tsx:3979
**Issue.** The chat list sections cap themselves at `maxWidth: 440` with `width: '100%'` and no `alignSelf`, while their scroll content container is widened to `maxWidth: 720` and centred by the `useAppStyles` override — so the sections left-align inside a wider centred column.

```
chatTopControls: {
    gap: 12,
    maxWidth: 440,
    width: '100%',
  },
```

**Impact.** Tablets (`"supportsTablet": true` in app.json) and unfolded foldables at ~700-840dp: `chatListContent` becomes a 720dp centred column, but `chatTopControls` (1148), `directMessagesSection` (4068, used at 1194) and `groupMessagesSection` (4073, used at 1218) render 440dp wide and flush left, leaving a 280dp empty gutter down the right of the chat list while the section titles and rows hug the left edge. Invisible on phones, where 440 exceeds the screen width.

**Fix.** Add `alignSelf: 'center'` to the three section styles (or raise their `maxWidth` to match the 720 content cap) so they stay centred in the wider column.

### App.tsx:3555
**Issue.** `noConnectButtons` combines `justifyContent: 'space-between'` with two `flex: 1` children capped at `maxWidth: 158`, so past ~340dp of content width the buttons stop growing and instead separate to opposite edges; the `stackActions` breakpoint that exists for this row is never consumed.

```
noConnectButtons: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12
  },
```

**Impact.** Tablets and unfolded foldables: on an 800dp-wide screen the NoConnect action bar (rendered at 1565-1578) shows a 158dp "Cancel" pinned to the far left and a 158dp "Connect" pinned to the far right with ~450dp of white space between them, so the primary action is nowhere near the thumb or the search field it belongs to. `getResponsiveLayout` already exports `stackActions: safeWidth < 360 || fontScale > 1.3` (src/lib/responsive.ts:10) for exactly this row, and nothing in the repo reads it.

**Fix.** Wrap the row in the shared centred content style (`maxWidth: 420, alignSelf: 'center'`) or use `justifyContent: 'center'` with the existing 12dp gap; consume `stackActions` to switch to a stacked full-width layout below 360dp / above fontScale 1.3.

### App.tsx:3898
**Issue.** `noDeviceImage` fixes the illustration at 171dp tall while only constraining its width responsively, so the art keeps its full height on short screens where `illustrationHeight` was designed to shrink it.

```
noDeviceImage: {
    height: 171,
    maxWidth: '70%',
    width: 200,
  },
```

**Impact.** Short screens — 568dp-tall phones, and any device once the keyboard or a large font scale eats the vertical budget. 171dp is 30% of a 568dp screen and is the single largest contributor to the empty-state overflow described above; `getResponsiveLayout` computes `illustrationHeight = max(80, min(240, contentWidth*0.65, safeHeight*0.3))` which would return ~150dp there, and `useAppStyles` applies it to `loginGateImage` and `launchImage` (6649, 6651) but not to this one or to `chatImage` (4615).

**Fix.** In `useAppStyles`, add `noDeviceImage: { ...baseStyles.noDeviceImage, height: r.illustrationHeight, width: Math.min(200, r.contentWidth) }` alongside the two existing illustration overrides.

### App.tsx:4013
**Issue.** chatChip / chatChipWide filter pills pin height:22 around font-scaled label text

```
chatChip: { ... borderRadius: 32, height: 22, justifyContent: 'center', paddingHorizontal: 8 } with chatChipText lineHeight: 14 (4033)
```

**Impact.** Android font size 'Largest' (x1.3) and the accessibility scales: the All/Unread chips on the Chat list (1169-1180) keep a 22dp pill while their labels grow to 21dp (x1.5) and 28dp (x2.0), so the text overflows the grey/black pill background and the active-state pill stops reading as a pill. Purely visual, but it makes the filter row look broken exactly where the rest of the row (chatFilterRow minHeight:25) is allowed to grow.

**Fix.** Replace height: 22 with minHeight: 22 + paddingVertical: 2 so the chip grows with its label.

### App.tsx:4104
**Issue.** chatAvatar is a fixed 40x40 circle containing font-scaled initials

```
chatAvatar: { ... borderRadius: 200, height: 40, justifyContent: 'center', width: 40 } with chatAvatarText: { fontSize: 16, ... lineHeight: 24 }
```

**Impact.** Accessibility font sizes (x1.7 and above) on every phone: the two-letter initials rendered at 1274-1277 grow to 27dp/40dp lineHeight inside a circle that stays 40dp, so the letters touch or exceed the circle edge while the row itself (chatRow minHeight:58, 4093) grows around them — the avatars look mis-sized rather than scaled. The online dot (chatOnlineDot, 4119) is likewise pinned at 8dp bottom/right of an unscaled circle.

**Fix.** Derive the avatar size from fontScale (e.g. 40 * Math.min(fontScale, 1.3)) or cap the initials with allowFontScaling={false}.

### App.tsx:4060
**Issue.** Primary icon actions use 18-28dp touch targets with no hitSlop, well under Android's 48dp minimum

```
chatSmallAdd: { ... borderRadius: 12, height: 18, justifyContent: 'center', width: 18 } — used as the add-contact button at 1187; iconButton: { alignItems:'center', height: 28, justifyContent:'center', width: 28 } (3637-3642) is every header action
```

**Impact.** All phones, worst on small/high-density devices (a 18dp target is ~2.9mm on a 400ppi 5" screen, 28dp is ~4.5mm; Android's guideline is 48dp). 'Add contact' on the Chat tab (1187) and the header search/refresh/settings buttons (614-622, 966-974, 769-774, 1137) miss reliably for larger fingers and for anyone with a motor impairment, and unlike the rest of the file they carry no hitSlop — the same file gets it right at 1066 (hitSlop={10}), 1161 and 2396 (nav tabs).

**Fix.** Add hitSlop={{top:12,bottom:12,left:12,right:12}} to iconButton/chatSmallAdd presses, or raise the boxes to a 44-48dp minimum while keeping the 18-20dp glyph.

### App.tsx:6100
**Issue.** `feedbackInput` is a `multiline` TextInput pinned to a fixed `height: 80` with 10sp text, so the visible line count collapses as the font scale rises.

```
feedbackInput: {
    ...
    fontSize: 10,
    height: 80,
    lineHeight: 14,
```

**Impact.** At scale 1.0 the box shows ~5 lines; at Android font size 2.0 (20sp/28dp lines) it shows 2, so a user writing feedback sees a two-line porthole that scrolls internally while 40dp of empty screen sits below it. On a 320dp-wide screen the 80dp box also makes the placeholder 'Write your feedback here...' the only visible content.

**Fix.** Use `minHeight: 80` (RN grows a multiline TextInput to fit when height is unset) or `minHeight: 80 * Math.min(r.fontScale, 1.6)`, together with the ScrollView fix for feedbackContent.

### App.tsx:6177
**Issue.** `biometricContent` is another non-scrolling `<View>` (render site 2071) with `paddingTop: 24` and no `paddingBottom` and no maxWidth.

```
biometricContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    width: '100%',
  },
```

**Impact.** Only two rows today, so it fits on a phone — but the rows use `minHeight: 51` and grow with font scale, and there is no scroll path, so any future row (or a long localized 'Unlock with biometrics' subtitle at font scale 2.0 in landscape) is clipped with no recovery. It is also the third screen in this file that omits the pattern its siblings use, which is how the Upgrade and Feedback screens broke.

**Fix.** Make it `<ScrollView contentContainerStyle={styles.biometricContent}>` and add `paddingBottom: 36` for consistency with settingsContent (5505) / accountContent (6330).

### App.tsx:5477
**Issue.** Roughly 970 lines of this slice (baseStyles 5477-6445: settings*, upgrade*, privacy*, permissions*, trusted*, feedback*, biometric*, lockSheet*, account*) plus ~230 lines of 5001-5400 (recent*, actionsMenu/actionMenu*, signIn*/auth*/or*/google* form styles) belong to screens that are no longer mounted. I confirmed by resolving every `styles.<key>` reference in the file: those keys are referenced only from App.tsx:1668-2350, and none of those components appear in JSX — the router at 3046-3106 renders the src/settings/* imports instead, and recent*/actionsMenu*/signIn* are referenced nowhere at all.

```
5477 `settingsScreen: {` … 6445 `accountActionText:` are reached only from the unmounted App.tsx:1668-2350 block; the router uses `<SettingsUpgradePlanScreen` (3091), `<SettingsAccountScreen` (3098), `<RemoteSettingsScreen` (3106), `<SettingsPrivacyPolicyScreen` (3046), `<SettingsBiometricScreen` (3048), `<SettingsFeedbackScreen` (3050), `<SettingsTrustedDevicesScreen` (3052), `<SettingsPermissionsScreen` (3054). Only `<LaunchingScreen onContinue={…} />` (3044) survives from the App.tsx-local family.
```

**Impact.** No direct on-device symptom — that is precisely the hazard. Every fixed height:40 row, fixed 68x28 button, absolute footer and un-scrolled container in this range reads as a live responsiveness bug to a reviewer, and five of the eight findings in this audit slice landed here. Any responsiveness fix applied to these styles ships zero behaviour change, while the real screens in src/settings/ (which already use SettingsPage's gutter + maxWidth 720 + ScrollView) silently diverge. It also inflates the RN bundle and makes the 6.6k-line App.tsx harder to reason about.

**Fix.** Delete App.tsx:1668-2350 (SettingsScreen, UpgradePlanScreen, PrivacyPolicyScreen, PermissionsScreen, TrustedDevicesScreen, FeedbackScreen, BiometricScreen, PermissionRow, AccountScreen) and the style keys only they reference, then re-run the responsiveness audit against src/settings/*.tsx, which is where the shipped settings UI actually lives. Keep launch*/signInFooter/loginGate*/nav*/password*, which are live.

### src/auth/AuthScreen.tsx:196
**Issue.** The two account-type tabs are forced side-by-side with flex:1 regardless of font scale or width; the app's own layout helper exports a `stackActions` flag for exactly this case and it is never used.

```
segment: { flex: 1, minHeight: 52, padding: 8, borderRadius: 4, borderWidth: 1, borderColor: '#babcbd', justifyContent: 'center' },
```

**Impact.** Small screens plus Android Font size = Largest. src/lib/responsive.ts:10 defines `stackActions: safeWidth < 360 || fontScale > 1.3` precisely so paired actions stack vertically, but AuthScreen never reads fontScale. Because `flex: 1` sets flex-basis to 0, the flexWrap on s.row (L192) can never trigger — the two tabs always split the row. On a 316dp-effective screen (Display size Largest) each tab gets ~114dp of text width; 'Sign Up Personal Account' at fontScale 1.3 (18.2sp) wraps to 4-5 lines, producing two ~110dp-tall stacked-word blocks that read as broken buttons. s.segment also omits alignItems, so the wrapped lines are left-aligned inside a control that otherwise looks centred.

**Fix.** Drive the row from the helper: `const { stackActions } = useResponsive();` then `<View style={[s.row, stackActions && { flexDirection: 'column', alignItems: 'stretch' }]}>` at line 137, and add `alignItems: 'center'` to `s.segment`. Optionally cap runaway growth with `maxFontSizeMultiplier={1.6}` on the tab labels.

### src/auth/AuthScreen.tsx:188
**Issue.** The logo is the only fixed-height element on the screen and never shrinks on short viewports, even though the app's layout helper exposes `compact` and a clamped `illustrationHeight` for this purpose.

```
logo: { width: 180, height: 50, alignSelf: 'center' },
```

**Impact.** Short screens with the keyboard open. src/lib/responsive.ts:7 defines `compact = safeWidth < 360 || safeHeight < 600` and line 15 clamps illustration heights against `safeHeight * 0.3`; neither is consulted. On a 640dp-tall device with the keyboard up the KeyboardAvoidingView's viewport is roughly 320dp, and the logo (50) + title (28) + subtitle (18) + the two 16dp gaps consume 128dp — 40% of the visible area — before the first input, so the focused field is pushed to the very bottom of the visible band on the verify/2FA screens where there is no scroll range to recover it.

**Fix.** Hide or shrink the hero when compact: `const { compact } = useResponsive();` then `<Image ... style={[s.logo, compact && { height: 34, width: 122 }]} />` at line 135, and optionally drop the subtitle (line 136) when compact.

### src/auth/AuthScreen.tsx:186
**Issue.** The back button positions itself with the physical `marginLeft` rather than the direction-aware `marginStart`, while its sibling `alignSelf: 'flex-start'` IS direction-aware, so the two disagree under RTL.

```
back: { padding: 12, alignSelf: 'flex-start', marginLeft: 12 },
```

**Impact.** Devices whose system locale is Arabic, Urdu or Hebrew — the app ships Arabic and Urdu in src/lib/i18n.tsx:18-19 with `rtl: true`, and android/app/src/main/AndroidManifest.xml:26 sets android:supportsRtl="true", so RN's I18nManager.isRTL is true on those devices and Yoga mirrors flex-start to the right edge. The 12dp offset stays on the physical left, so the back arrow is flush against the right screen edge with no margin (and a stray 12dp gap on its inner side); on a device with a curved panel the 46dp hit area is partly off the touchable region. The Feather 'arrow-left' glyph at line 131 also does not mirror.

**Fix.** Use `marginStart: 12` instead of `marginLeft: 12`, and mirror the glyph: `<Feather name={I18nManager.isRTL ? 'arrow-right' : 'arrow-left'} size={22} />` at line 131.

### src/auth/AuthScreen.tsx:56
**Issue.** The country/state picker modal has no keyboard handling of its own — no KeyboardAvoidingView wraps the search field and result list — so the list keeps its full height while the keyboard overlays its bottom half.

```
<ScrollView keyboardShouldPersistTaps="handled">{options.filter(x => x.toLowerCase().includes(search.toLowerCase())).map(x =>
```

**Impact.** Short screens (640dp tall). Once the search Field at line 55 is focused, the visible list band is only ~210dp after the 24dp status inset, the 44dp Close row, the ~70dp search field, two 16dp gaps and a ~260dp keyboard — about 4.7 rows of the 44dp `linkButton` options. The list still scrolls, but the user is reading matches through a four-row slot while typing, and on the Address step of Business sign-up that is the only way to reach 'United States' (geo.ts sorts ~250 entries alphabetically). Every other keyboard surface in the file is wrapped in a KeyboardAvoidingView; this one is not.

**Fix.** Wrap the modal body in the same avoider used by the main screen: `<SafeAreaView style={s.page}><KeyboardAvoidingView style={s.flex} behavior="padding"><View style={[s.card, s.modalCard]}> ... </View></KeyboardAvoidingView></SafeAreaView>` at lines 53-58. While there, swap the plain ScrollView for a FlatList so the ~250 Pressables are not all mounted at once on low-RAM devices.

### src/auth/AuthScreen.tsx:138
**Issue.** Business sign-up step tabs are bare Pressables with no style, giving ~17dp-tall touch targets — the only tappables in the file without a 44dp minimum

```
`{['Company', 'Address', 'Account'].map((label, i) => <Pressable key={label} disabled={i + 1 >= step} onPress={() => { setStep(i + 1); setError(''); }}><Text style={step === i + 1 ? s.link : s.subtitle}>{i + 1}. {label}</Text></Pressable>)}` — no style prop at all, so the hit rect is the text box of a 13sp label (s.link/s.subtitle, L189/L193).
```

**Impact.** All phones, worse on small/high-density screens and for users with reduced dexterity: the step-back control in the business sign-up flow is a ~17dp-tall strip, well under Android's 48dp guidance, while every other control in this file explicitly reserves it (s.linkButton minHeight 44 L193, s.check minHeight 44 L192, s.button minHeight 44 L194, s.google minHeight 44 L195, s.segment minHeight 52 L196, s.eye minHeight 44 L191). At Font size = Largest the row (s.row, flexWrap:'wrap' + justifyContent:'space-between') also wraps to two lines with one label orphaned hard-left.

**Fix.** Give the step Pressables `style={s.linkButton}` (or a dedicated style with minHeight 44 and horizontal padding), matching every other tappable in the file.

### src/auth/AuthScreen.tsx:169
**Issue.** Google/Microsoft button labels have no flexShrink and no numberOfLines in a centred row — the same defect as the SelectField chevron, but on the primary sign-in screen

```
L169 `<Text style={s.label}>{mode === 'signup' ? 'Sign Up' : 'Sign In'} With {provider === 'google' ? 'Google' : 'Microsoft'}</Text>` inside `google: { ..., minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }` (L195); `label: { fontFamily: 'MonaSans-Regular', fontSize: 14, color: '#111315' }` (L190) declares no flexShrink and the file never sets maxFontSizeMultiplier or allowFontScaling anywhere.
```

**Impact.** Small phones combined with the top accessibility font steps (fontScale ~1.8-2.0 on Pixel/Samsung). RN's default flexShrink is 0, so the label is measured at the full inner width and wraps; the 20dp provider logo plus the 12dp gap then no longer fit, and because the row is justifyContent:'center' the overflow spills out BOTH sides — the Google/Microsoft mark is drawn off the button's left border and the text past its right border, on the two most prominent controls of the sign-in screen. Same root cause as the confirmed SelectField finding, so a single convention fix covers both.

**Fix.** Add `flexShrink: 1, minWidth: 0` (and `numberOfLines={2}`) to the label Text in both the OAuth buttons (L169) and the SelectField value (L50) — mirroring what s.input already does at L191.

### src/auth/AuthScreen.tsx:56
**Issue.** The 250-row country/state picker has no keyboard handling at all: no KeyboardAvoidingView, no keyboardDismissMode, no bottom content padding

```
L56 `<ScrollView keyboardShouldPersistTaps="handled">{options.filter(...).map(...)}</ScrollView>` is the whole list; the modal subtree (L52-L58) contains no KeyboardAvoidingView, unlike src/settings/SettingsScaffold.tsx:65 and src/chat/AddContactModal.tsx:96 which both wrap their content in one.
```

**Impact.** Short phones (~640dp tall) during Business sign-up step 2. The search Field sits above the list, so the IME is open while the user browses. The ScrollView's viewport stays the full modal height, so its maximum scroll offset places the last rows at the bottom of the screen — i.e. behind the keyboard — and they can never be scrolled above it. keyboardDismissMode is unset (default 'none' on Android) and keyboardShouldPersistTaps="handled" means a tap on a row selects rather than dismisses, so there is no gesture that frees the tail of the list except clearing focus via the hardware back key. Whether the tail is 4 rows or 12 depends on the device's keyboard height, and on Android 15+ with edgeToEdgeEnabled the dialog may not resize for the IME at all.

**Fix.** Wrap the modal card in the same `<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>` used elsewhere, and/or give the list `keyboardDismissMode="on-drag"` plus a contentContainerStyle bottom padding.

### src/auth/AuthScreen.tsx:186
**Issue.** Back button uses the physical-direction property marginLeft and a non-mirrored arrow, so it breaks on RTL-locale devices

```
L186 `back: { padding: 12, alignSelf: 'flex-start', marginLeft: 12 }` paired with L131 `<Pressable ... style={s.back} onPress={onBack}><Feather name="arrow-left" size={22} /></Pressable>`. android/app/src/main/AndroidManifest.xml sets `android:supportsRtl="true"` and the app ships RTL locales (src/lib/i18n.tsx:19-20: `{ code: 'ar', ..., rtl: true }`, `{ code: 'ur', ..., rtl: true }`).
```

**Impact.** Any device whose system locale is Arabic or Urdu (RN honours the device locale for layout direction and the app never calls I18nManager.allowRTL(false)). `alignSelf: 'flex-start'` is direction-aware and moves the button to the RIGHT edge, but `marginLeft` is not, so the 12dp gutter stays on the left and the back control sits flush against the right screen edge — directly under the curved glass / camera cutout on many devices — while the chevron still points left, away from the direction of travel.

**Fix.** Use `marginStart: 12` instead of `marginLeft`, and pick the icon by `I18nManager.isRTL ? 'arrow-right' : 'arrow-left'`.

### src/settings/SettingsScaffold.tsx:229
**Issue.** The back affordance is a flex:1 Pressable with only minHeight: 40, so the tappable strip is 40dp tall inside a >=60dp header, leaving dead zones above and below it and falling under Android's 48dp minimum target.

```
  headerTitle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 40,
    minWidth: 0,
    flex: 1
  },
```

**Impact.** styles.header (line 219-224) sets alignItems: 'center', so headerTitle does not stretch to the header's height — it is a 40dp band centred in a header of at least 60dp + insets.top, giving ~10dp of unresponsive space above and below the arrow. On a 5" high-density phone 40dp is ~3.6mm of vertical target, under the 48dp Android accessibility minimum, and taps in the dead band near the status bar silently do nothing — noticeable on tall 20:9 phones where the user reaches for the top of the screen with a thumb. Secondary issue: because the Pressable is flex:1 and wraps the title, the entire header row is 'go back', which makes an accidental swipe/tap on the title navigate away.

**Fix.** Change minHeight: 40 to minHeight: 48 and add alignSelf: 'stretch' to headerTitle so it fills the header's full height, or drop flex:1 and give the arrow its own 48x48 Pressable with the title as a non-interactive sibling.

### src/settings/AccountScreen.tsx:144
**Issue.** The hand-rolled toggle positions its knob with alignSelf flex-start/flex-end on the cross axis of a column container, which Yoga resolves against the layout direction — so the knob renders on the wrong side under RTL and the switch reads inverted.

```
  toggleKnob: { alignSelf: 'flex-start', backgroundColor: '#FFFFFF', borderRadius: 8, height: 16, width: 16 },
  toggleKnobOn: { alignSelf: 'flex-end' },
```

**Impact.** The app ships Arabic and Urdu with rtl: true (src/lib/i18n.tsx:19-20) and android:supportsRtl="true" is set (AndroidManifest.xml:26), while nothing in the app calls I18nManager — so on a device whose system locale is Arabic or Urdu, Android puts the app in RTL and Yoga resolves the cross axis of the toggle's column container right-to-left. flex-start then means the right edge, so 'off' draws the knob right and 'on' draws it left: a user in Saudi Arabia or Pakistan sees the Notifications switch showing the opposite of its actual state (the background colour still changes, but the knob position — the primary affordance — lies). The shared SettingsToggleRow does not have this problem because React Native's native <Switch> handles RTL itself.

**Fix.** Replace the row with SettingsToggleRow (see the touch-target finding above), which removes the hand-rolled knob entirely. If it must stay, drive the knob with a transform instead of alignSelf: style={[styles.toggleKnob, { transform: [{ translateX: notificationsEnabled ? 16 : 0 }] }]} and give it position-independent layout.

### src/settings/SettingsScaffold.tsx:285
**Issue.** The shared SettingsRow caps its right-hand detail at maxWidth '45%' with numberOfLines={1}, a percentage that does not react to fontScale, so detail values collapse to a few characters at accessibility font sizes instead of reflowing under the title.

```
rowRight: { alignItems: 'center', flexDirection: 'row', gap: 8, maxWidth: '45%', flexShrink: 1 }  — consumed at line 99: {detail ? <Text style={styles.rowMeta} numberOfLines={1}>{detail}</Text> : null}
```

**Impact.** Small phones (320-360dp) at fontScale 1.6-2.0. On a 320dp screen the row is ~296dp, so rowRight gets 133dp; subtract the 16dp chevron and the 8dp gap and the detail has ~109dp. SettingsScreen.tsx:118 passes the native language name ('Portugues (Brasil)') and line 122 the streaming quality — at 24sp that is roughly four characters before the ellipsis, so the Language row reads 'Por...' and the user cannot see which language is selected without opening the sub-page. The row title next to it wraps freely, so the row is tall and mostly empty while the informative half is truncated.

**Fix.** At large fontScale (the repo already computes `stackActions`/`compact` in lib/responsive.ts:7,10) switch SettingsRow to a stacked layout — detail as a second line under the title — instead of a fixed 45% side column.

### src/settings/PrivacySecurityScreen.tsx:57
**Issue.** The 'Clear local cache' row rebuilds the scaffold row but drops the flex:1 / minWidth:0 / flexShrink that make the shared row shrinkable, and React Native's default flexShrink is 0 — so the label cannot shrink and pushes the chevron off the right edge instead of truncating.

```
dangerLeft: { alignItems: 'center', flexDirection: 'row', gap: 12 },  // vs SettingsScaffold.tsx:269-275 rowLeft: { flex: 1, minWidth: 0, ... } and rowTitle: { flexShrink: 1 } at 288-294; dangerText (line 62) has no flexShrink either
```

**Impact.** Narrow screens (a folded Galaxy Fold at ~280dp, or 320dp phones) at Android font size max. The row is justifyContent:'space-between' with a 16dp chevron; at fontScale 2.0 'Clear local cache' is ~248dp of text plus a 16dp icon and 12dp gap = 276dp, which exceeds the 256dp of content width on a 280dp device. Because neither dangerLeft nor dangerText can shrink, the text is laid out at full intrinsic width and the trailing chevron is pushed past the parent bound and clipped, so the row loses its 'tap me' affordance. Every other row in Settings (which uses the scaffold) degrades gracefully here.

**Fix.** Give dangerLeft `flex: 1, minWidth: 0` and dangerText `flexShrink: 1` (matching SettingsScaffold.tsx:269-294), or simply compose SettingsRow instead of re-implementing it.

### src/settings/SettingsScaffold.tsx:60
**Issue.** The scaffold funnels the caller's `contentStyle` straight into a ScrollView's contentContainerStyle, so a caller passing `flex: 1` silently pins the content to exactly the viewport height and disables scrolling — the classic RN contentContainerStyle trap, and a caller already does it.

```
const content = [styles.content, contentStyle, { paddingHorizontal: gutter }];  ...  <ScrollView style={{ flex: 1 }} contentContainerStyle={content} ...>   // caller: ConnectionLogsScreen.tsx:24-27 — center: { flex: 1, justifyContent: 'center' }
```

**Impact.** Short viewports — a 5" phone in portrait, or any phone in landscape (~360dp of height) — at raised font sizes. With flex:1 on the content container the content can never exceed the ScrollView height, so on Connection logs the centred empty state (30dp icon + a 15sp title + an 18dp-line body, all font-scaling) is clipped at the container edge with no scrollbar and no way to reach the cut-off text. The same prop shape is available to every future page that passes contentStyle, so the trap will recur.

**Fix.** Either strip `flex` from contentStyle before merging (or merge it as `flexGrow: 1`), or type contentStyle so callers cannot pass flex; ConnectionLogsScreen.tsx:24 should use `flexGrow: 1, justifyContent: 'center'`.

### src/settings/AccountScreen.tsx:156
**Issue.** The delete dialog's action pair is hard-wired to a single row and never stacks, even though lib/responsive.ts exports a `stackActions` flag computed for exactly this condition and this file imports neither it nor useResponsive.

```
dialogButtons: { flexDirection: 'row', gap: 10, marginTop: 20 },  // vs lib/responsive.ts:10 — stackActions: safeWidth < 360 || fontScale > 1.3
```

**Impact.** Narrow screens (folded foldable ~280dp, 320dp phones) at fontScale >= 1.6. The dialog's inner width there is 280 - 48 (backdrop padding) - 40 (dialog padding) = 192dp, so each flex:1 button gets ~91dp; 'Cancel' at 28sp needs ~84dp and the Spanish 'Cancelar' ~112dp, so the labels wrap to two lines inside a 12dp-padded button or are squeezed against the 6dp radius. The two destructive/neutral actions stop reading as parallel choices at the moment the user most needs clarity.

**Fix.** Read `stackActions` from useResponsive() and switch dialogButtons to flexDirection 'column' (full-width buttons, destructive last) when it is true.

### src/settings/TwoFactorScreen.tsx:204
**Issue.** Latent: on 320x480-class screens (Android Go / very old hardware) at fontScale 2.0 the dialog exceeds the backdrop and, being centred with no ScrollView and no maxHeight, is clipped at both ends with the Cancel / Turn off row unreachable. Cheap fix: reuse ResponsivePanel here as BiometricScreen.tsx:125 already does.

```
dialogBackdrop: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', flex: 1, justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: '#FFFFFF', borderRadius: 16, maxWidth: 360, padding: 20, width: '100%' },
```

**Impact.** Small/short phones (320x480-class, or any phone with Android Display size + Font size both at maximum). The stack — 44dp icon + title + a 2-line body that becomes ~5 lines at fontScale 2.0 + the button row + 40dp of padding — exceeds the 480dp-minus-48dp backdrop. Because the backdrop is justifyContent:'center', the overflow is split top and bottom, so the Cancel / Turn off buttons are pushed off the bottom of the screen with no way to scroll to them: the user cannot disable 2FA at all and must force-close the dialog.

**Fix.** Swap the raw <View style={styles.dialog}> at line 154 for the repo's own <ResponsivePanel style={styles.dialog}> (components/ResponsivePanel.tsx), which applies `maxHeight: modalMaxHeight` (safeHeight - 24) and an internal ScrollView. Import it the same way BiometricScreen.tsx:1 does.

### src/settings/ConnectionLogsScreen.tsx:25
**Issue.** Latent anti-pattern: `flex: 1` in a ScrollView contentContainerStyle pins the content to the viewport and kills scrolling; today it is masked because the empty state is short, but it will clip silently the moment this screen gains real log entries. Fix: delete `flex: 1` from styles.center - flexGrow:1 is already inherited from SettingsScaffold.tsx:248 and justifyContent:'center' keeps working.

```
<SettingsPage title="Connection logs" onBack={onBack} contentStyle={styles.center}>
...
  center: {
    flex: 1,
    justifyContent: 'center',
  },
```

**Impact.** Short screens (320x480-class devices, and any phone once Android Display size + Font size are both raised). SettingsScaffold.tsx:60 merges this into the ScrollView contentContainerStyle at line 68, so flexBasis:0 + flexShrink:1 forces the container to the scroll viewport's height — the ScrollView can never scroll. Because it is also justifyContent:'center', content taller than the viewport overflows at BOTH ends, so the icon and the top of "No recent connection issues" are clipped off the top while the explanatory body is clipped off the bottom, with no gesture that can reveal either.

**Fix.** Use `flexGrow: 1` instead of `flex: 1` (SettingsScaffold's base `content` already sets flexGrow: 1, so `center` only needs `justifyContent: 'center'`). React Native's own ScrollView docs call out flex:1 in contentContainerStyle as the anti-pattern here.

### src/settings/TrustedDevicesScreen.tsx:136
**Issue.** Cosmetic crowding on <=320dp phones and at fontScale >= ~1.3: the wrapped device label butts directly against the red 'Sign out' text with zero gutter, inconsistent with every other settings row. Fix: add `gap: 12` to styles.row, as SettingsScaffold.tsx:267 does.

```
row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 51, paddingVertical: 10 },
  rowLeft: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 12, minWidth: 0 },
```

**Impact.** Narrow phones (<=360dp) and any device at fontScale >= 1.3. `rowLeft` grows to consume all free space, so justifyContent:'space-between' has nothing left to distribute: the wrap point of "Remote 365 mobile app" / "Chrome on Windows" lands exactly on the left edge of the red "Sign out" text. The user sees the device name literally touching the destructive action, and the two adjacent tap zones have no dead space between them, making it easy to hit "Sign out" while trying to read the row. The shared row in SettingsScaffold.tsx:267 sets `gap: 12` and does not have this problem, so Trusted Devices looks visibly wrong next to every other settings list.

**Fix.** Add `gap: 12` to the `row` style at line 136, matching settingsSharedStyles.row.

### src/settings/UpgradePlanScreen.tsx:114
**Issue.** Bottom spacing is counted three times: the SafeAreaView applies the bottom inset, the pinned footer adds its own padding, and the scroll content adds `insets.bottom + 72` on top of both.

```
<ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 72 }]} showsVerticalScrollIndicator={false}>
// ...footer is a sibling OUTSIDE the ScrollView, inside the same SafeAreaView:
  footer: { alignItems: 'center', alignSelf: 'center', gap: 2, paddingHorizontal: 16, paddingVertical: 12, width: '100%' },
```

**Impact.** Short screens — 320x568-class phones, and any phone once Android Display size is raised (which shrinks the logical viewport). The footer already occupies its own space below the scroll area and the SafeAreaView already pads `insets.bottom`, so the extra `insets.bottom + 72` inside the scroll content produces roughly 105-110dp of empty white below the last plan card, about a fifth of the visible list area. The user scrolls to the bottom and sees a large void where they expect the next plan, which reads as a loading failure.

**Fix.** Since the footer is outside the ScrollView and the SafeAreaView already handles the inset, reduce this to a plain `paddingBottom: 24` (or drop the inline override entirely and keep the static `paddingBottom: 80` at line 241 trimmed to 24).

### src/settings/UpgradePlanScreen.tsx:242
**Issue.** The screen bypasses SettingsPage and hard-codes its outer gutter at 16, then spends another 24dp per side on the plan card's internal padding.

```
    gap: 16,
    paddingBottom: 80,
    paddingHorizontal: 16,
// and planCard:
    paddingHorizontal: 24,
    paddingVertical: 12,
```

**Impact.** <=360dp phones lose 80dp (25% of a 320dp screen) to padding before any content is drawn: 320 - 32 outer - 48 card = 240dp of usable row, of which the Upgrade button takes ~78dp, leaving ~150dp for the plan name, seat count, localised Play price and 2-line description. At Android Font size Large the plan title wraps and the "Popular" badge drops to its own line, making the cards ragged and inconsistent in height. On >=600dp tablets/foldables the outer gutter stays 16 while every SettingsPage screen uses 24, so content misaligns as the user navigates between them.

**Fix.** Use the shared hook: `const { gutter } = useResponsive();` and apply `{ paddingHorizontal: gutter }` to the ScrollView contentContainerStyle (as SettingsScaffold.tsx:59-60 does), and make the card padding width-aware, e.g. `paddingHorizontal: gutter < 16 ? 14 : 24`.

### src/settings/SystemLogsScreen.tsx:20
**Issue.** Unbounded device/runtime strings are fed into SettingsRow's `detail` slot, which is capped at 45% of the row width and forced to a single line.

```
<SettingsRow icon="smartphone" iconColor="#14AE5C" title="Device" detail={String(deviceName)} />
// SettingsScaffold.tsx:281-287 → rowRight: { ... maxWidth: '45%', flexShrink: 1 }
// SettingsScaffold.tsx:99      → <Text style={styles.rowMeta} numberOfLines={1}>{detail}</Text>
```

**Impact.** <=360dp phones, and worse at any raised font scale. On a 320dp screen the detail column is capped at ~133dp; a real Android device name ("Samsung Galaxy S23 Ultra", "Xiaomi Redmi Note 12 Pro+ 5G") renders as "Samsung Galaxy S2…" at 12px and as "Sams…" at fontScale 2.0. Since this screen exists purely so a user can read back diagnostics to support, the one value that matters is the one that is unreadable, and there is no long-press-to-copy or wrap fallback.

**Fix.** For this screen use a stacked layout rather than the 45%-capped row — e.g. render Device/Platform with SettingsToggleRow-style `rowLabelGroup` (title on line 1, value as a wrapping subtitle on line 2), or add an optional `detailNumberOfLines`/`wrapDetail` prop to SettingsRow that drops `numberOfLines={1}` and the `maxWidth: '45%'` cap.

### src/settings/BiometricScreen.tsx:123
**Issue.** Both settings Modals omit statusBarTranslucent / navigationBarTranslucent even though the app opts into Android edge-to-edge, so their dim backdrop stops at the system bars while other modals in the same app cover them.

```
<Modal animationType="slide" transparent visible={lockSheetOpen} onRequestClose={...}>   // and TwoFactorScreen.tsx:151 `<Modal transparent animationType="fade" ...>` — versus chat/AddContactModal.tsx:95 `<Modal visible={visible} transparent animationType="fade" statusBarTranslucent ...>` and meetings/MeetingRoom.tsx:1663. app.json declares "edgeToEdgeEnabled": true.
```

**Impact.** All Android devices (the app targets edge-to-edge, so the activity draws under both bars). The dialog window is inset by the status and navigation bars, so opening the Lock-app sheet or the Turn-off-2FA dialog leaves an undimmed bright strip behind the status bar and the sheet stops short of the screen edge - visibly different from the chat and meeting modals on the same device, and the reason the sheet's missing bottom inset is invisible on Android during review.

**Fix.** Add statusBarTranslucent and navigationBarTranslucent to both Modals, then add the bottom safe-area padding to the sheet (they must ship together - turning on translucency without the inset is what would actually push the buttons under the gesture pill).

### src/settings/TrustedDevicesScreen.tsx:116
**Issue.** The destructive 'Sign out' control is a bare Pressable around 12sp text with only hitSlop 6, giving a ~29dp-tall target for the one irreversible action on the screen.

```
<Pressable hitSlop={6} onPress={() => handleRevoke(session.id)}><Text style={styles.revoke}>Sign out</Text></Pressable>   // revoke: { color: '#D92D20', fontSize: 12, fontWeight: '600' } (line 144) — no padding, no minHeight
```

**Impact.** All devices, worst on 'Display size: Small' and for imprecise touch: the target is roughly 64x29dp against the 48dp Android / 44pt iOS minimum, and it sits in a list where the neighbouring rows are 51dp tall - so users either miss it repeatedly or, combined with the missing row gap (finding 8), aim at the label and hit nothing.

**Fix.** Give the Pressable `paddingVertical: 12, paddingHorizontal: 8` (or hitSlop={{top:14,bottom:14,left:12,right:12}}) so the destructive action clears 44dp.

### src/settings/FeedbackScreen.tsx:60
**Issue.** The bottom safe-area inset is counted twice - the SafeAreaView already pads the bottom edge, and the scroll content adds insets.bottom again.

```
<SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}> (line 52) ... contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} (line 60)   // same pattern in UpgradePlanScreen.tsx:110 + :114 with insets.bottom + 72
```

**Impact.** Every device with a non-zero bottom inset (iPhone X and later ~34pt, Android gesture nav ~24-48dp): the scroll content ends ~92dp above the screen edge on an iPhone and ~150dp on the Upgrade screen, so on short phones a whole button-row's worth of viewport is dead space and the Send / plan list looks stranded high with an empty band beneath it.

**Fix.** Pick one owner of the inset: either drop 'bottom' from the SafeAreaView edges, or use a plain constant (24 / 72) in contentContainerStyle.

### src/chat/ChatThread.tsx:1650
**Issue.** The bubble cap has no absolute maximum, so on tablets and unfolded foldables single-line bubbles stretch to 411-655dp of 12dp text and the screen reads as a blown-up phone layout. Fix is an added `maxWidth` ceiling (e.g. Math.min(0.64*W, 420)); the narrow-phone half of the original claim does not hold.

```
  bubbleWrap: { maxWidth: '64%' },
  bubbleText: { fontSize: 12, lineHeight: 16, color: '#111315' },   // line 1655
```

**Impact.** On a 360dp phone the bubble's text box is 0.64*328 - 22 = 188dp. At Android 'Font size = Largest' (fontScale 1.3-2.0) the 12dp body text renders at 16-24px, giving roughly 7-11 characters per line — a 40-character message becomes a 5-6 line tower of two-word lines, which is precisely the 'not responsive' complaint. In the other direction, on an unfolded Galaxy Fold (674dp) or an iPad (app.json sets `"supportsTablet": true`) the same rule produces 411-655dp single-line bubbles, well past the ~70ch comfortable measure, and the layout reads as a stretched phone app.

**Fix.** Bound both ends against live width: `const { width } = useWindowDimensions();` then `style={[styles.bubbleWrap, { maxWidth: Math.min(Math.max(width * 0.78, 240), 520) }]}`. Raise `bubbleText.fontSize` to 15 at the same time — 12dp body text is below the 14sp platform minimum on both OSes.

### src/chat/ChatThread.tsx:1226
**Issue.** The bubble timestamp is `numberOfLines={1}` inside a `metaRow` that has no width bound of its own, so at large font scale on a narrow phone the timestamp itself gets ellipsized.

```
          <Text numberOfLines={1} style={[styles.bubbleTime, isMine && styles.bubbleTimeMine]}>
            {time}
            {message.editedAt && !message.pending ? ' · edited' : ''}
          </Text>
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end' },   // line 1658
```

**Impact.** On a 360dp phone the bubble's inner width is ~188dp. At fontScale 2.0 the 10dp timestamp renders at 20px, so '10:24 AM · edited' plus the 16dp double-tick and the 4dp gap needs ~200dp and truncates to '10:24 AM · edi…'. The user sees a chopped timestamp on every edited message they sent, and the seen/delivered ticks are crowded against it.

**Fix.** Split the metadata so only the mutable part truncates: keep the time in its own unbounded Text and render ' · edited' as a sibling with `flexShrink: 1`, or add `maxFontSizeMultiplier={1.4}` to `bubbleTime` and raise its base size from 10 to 11-12.

### src/chat/ChatThread.tsx:1397
**Issue.** The reaction-picker buttons are a fixed 36x36 holding an emoji with `fontSize: 19` and `lineHeight: 24`, which scales with the OS setting while the button does not.

```
  reactionPickerButton: {
    ...
    borderRadius: 18,
    height: 36,
    width: 36,
  },
  reactionPickerEmoji: {
    fontSize: 19,
    lineHeight: 24,
  },
```

**Impact.** At Android 'Font size = Largest' (fontScale 1.3) the emoji renders at ~25px with a ~31dp line box inside a 36dp circle — already touching the edges; at iOS accessibility text sizes the glyph exceeds the circle and is clipped, so the six-emoji reaction row on the long-press sheet shows partial emoji. The row is `justifyContent: 'space-between'` over 6 fixed buttons, so it also does not reflow on a 277dp effective-width screen (Display size = Largest) where 6*36 + padding leaves almost no gap.

**Fix.** Let the buttons scale with the text: `const { fontScale } = useWindowDimensions();` then `style={[styles.reactionPickerButton, { width: 36 * Math.min(fontScale, 1.5), height: 36 * Math.min(fontScale, 1.5), borderRadius: 18 * Math.min(fontScale, 1.5) }]}`, and add `flexWrap: 'wrap'` + `gap: 8` to `reactionPickerRow`.

### src/chat/ChatThread.tsx:1686
**Issue.** Non-image attachment filenames are truncated at a fixed 150dp regardless of how much room the bubble actually has.

```
  fileName: { fontSize: 12, fontWeight: '500', color: '#111315', maxWidth: 150 },
```

**Impact.** On a 412dp Pixel the bubble's text box is ~221dp but the filename still truncates at 150dp, so 'quarterly-report-final.pdf' shows as 'quarterly-report-f…' with 70dp of unused bubble beside it; on a 674dp unfolded foldable ~280dp goes unused. In the other direction, at fontScale 2.0 the 150dp cap holds about six characters, so every attachment reads as 'quarte…' and the user cannot tell two files apart.

**Fix.** Let the name fill the bubble instead of a constant: `fileChip: { ..., flexShrink: 1 }` and `fileName: { fontSize: 12, fontWeight: '500', flexShrink: 1 }` (drop `maxWidth`) — the bubble's own max width already bounds it.

### src/chat/ChatThread.tsx:1317
**Issue.** The in-thread message search field is a fixed 40dp-tall pill whose TextInput has `paddingVertical: 0` and scales with the OS font setting.

```
  searchBar: {
    ...
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F2F5',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111315', paddingVertical: 0 },
```

**Impact.** At fontScale 2.0+ the 14dp text renders at 28px with a ~34dp line box and zero vertical padding inside a 40dp pill — descenders and the caret clip against the pill's rounded edge on Android. Note the inconsistency: the chat-list search box at App.tsx:1158 sets `allowFontScaling={false}` on the same kind of field, so the two search inputs behave differently on the same device.

**Fix.** Replace `height: 40` with `minHeight: 40` on `searchBar` and give `searchInput` `paddingVertical: 6` plus `maxFontSizeMultiplier={1.4}`, and resolve the divergence with App.tsx:1158 one way or the other.

### src/chat/ChatThread.tsx:961
**Issue.** The photo bubble's height is capped at a fixed 240dp and floored at 110dp with `resizeMode="cover"`, so extreme aspect ratios are silently cropped rather than fitted.

```
  const MAX_H = 240;
  const [ratio, setRatio] = useState(1);
  const width = MAX_W;
  let height = Math.round(MAX_W / ratio);
  if (height > MAX_H) height = MAX_H;
  if (height < 110) height = 110;
  ...
        resizeMode="cover"
```

**Impact.** A phone screenshot (9:19.5) sent from an Android host is 210dp wide by 455dp tall by aspect, clamped to 240dp and then centre-cropped by `cover` — roughly half the screenshot is invisible in the thread, which matters because screenshots are the common attachment in a remote-support product. A panorama or a wide code snippet hits the 110dp floor and is cropped top and bottom. On a 640dp-tall device the 240dp cap is a reasonable 37% of the screen; on a 915dp Pixel 8 Pro or an iPad it is a needlessly small thumbnail.

**Fix.** Scale the cap with the viewport and stop cropping: `const { height: screenH } = useWindowDimensions(); const MAX_H = Math.min(320, Math.round(screenH * 0.38));` and switch to `resizeMode="contain"` (or keep `cover` but drop the 110dp floor) so the whole image is legible before the user taps into the gallery.

### src/chat/ChatThread.tsx:1565
**Issue.** The conversation overflow menu is anchored at a hard-coded top: 96 that does not track the header + contact bar height

```
actionsMenu: {
    position: 'absolute',
    top: 96,
    right: 12,
    width: 188,   // lines 1563-1567
```

**Impact.** The two rows it is supposed to hang below are ~104dp tall at fontScale 1.0 (header paddingVertical 12 + an 18dp title, line 1266-1272, plus contactBar's 44dp avatar + paddingBottom 12, lines 1276-1291), so the dropdown already overlaps the contact bar by ~8dp on a default phone. At Android fontScale 2.0 those rows grow to ~156dp and the menu lands 60dp up, covering the avatar and contact name it belongs to. The fixed 188dp width also forces 'Unmute notifications' (line 594) to wrap at default font size (~137dp of text + 58dp of icon/gap/padding = 195dp).

**Fix.** Measure the header block with onLayout (or derive it from useResponsive().headerHeight) and pass the anchor as an inline top; give the menu a minWidth instead of a fixed width.

### src/chat/ChatThread.tsx:960
**Issue.** Chat photos are capped at an absolute 210x240dp, so they never grow with the window on large screens

```
const MAX_W = Math.min(210, Math.round(screenW * 0.58));
  const MAX_H = 240;    // lines 960-961
```

**Impact.** This is the opposite failure to the clipping bug on the same line. On an unfolded Galaxy Fold (674dp) or an iPad (app.json sets "supportsTablet": true) the bubble is allowed 411-655dp wide but every photo stays a 210dp postage stamp in the corner of it, with resizeMode 'cover' cropping the picture to a 240dp-tall letterbox. The screen reads as a stretched phone layout, which is the user's stated complaint about this app.

**Fix.** Make the cap a fraction of the bubble's own box rather than a constant: derive it from the same 64% rule the bubble uses (e.g. Math.min(0.64*(W-32) - 8, 420)) and scale MAX_H with it.

### src/meetings/MeetingRoom.tsx:2202
**Issue.** The header meta row lays out two full-length Texts plus a Live pill in a single non-wrapping row where the Texts have no flexShrink and no numberOfLines, so at raised font scale they overflow and collide with the pill.

```
headerMetaGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: 8,
  },
  headerMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
```

**Impact.** React Native defaults flexShrink to 0 on children, so only the *group* shrinks — the two Texts inside it ("Meeting Time 00:00" and "N Participants", lines 1070-1075) keep their intrinsic width and spill out of it. At Android font size = Largest (fontScale 1.3) on a 360dp phone the meta text needs ~249dp against ~249dp of available width once the Live pill (~60) and the 12dp gap and 32dp of horizontal padding are removed, so it is already at the limit; at accessibility scales (1.5–2.0, and iOS AX sizes up to ~3.1) the text draws straight over the red Live/Recording pill, which is also the tap target that opens the recording menu (line 1077).

**Fix.** Add `flexShrink: 1, minWidth: 0` to `headerMeta` (line 2197) and `numberOfLines={1}` to both Texts, or switch to the project's own signal: `const { stackActions } = useResponsive();` and render the meta group above the pill in a column when `stackActions` is true (it already fires at `fontScale > 1.3`).

### src/meetings/MeetingRoom.tsx:2484
**Issue.** The list-view action row places two variable-width text buttons side by side with no flexWrap and no flex on the children, so at raised font scale the second button is pushed outside the stage.

```
rosterActions: {
    flexDirection: 'row',
    gap: 8,
  },
```

**Impact.** "Invite people" and "Mute all" (lines 1099-1104) each carry `paddingHorizontal: 16` and 14sp text. Available width inside the stage on a 360dp phone is 360 - 32 (stage margin) - 16 (stage padding) - 16 (rosterContent padding) = 296dp. At fontScale 1.5 the two buttons need ~366dp; the row does not wrap and the buttons do not shrink, so "Mute all" is clipped at the right edge of the grey stage and cannot be tapped. This is the only way to mute everyone from list view.

**Fix.** Add `flexWrap: 'wrap'` to `rosterActions` and `flexShrink: 1` to `rosterActionButton`, or set `flex: 1` on both buttons with `numberOfLines={1}` on their labels so they split the row evenly and truncate instead of overflowing.

### src/meetings/MeetingHome.tsx:350
**Issue.** The scroll clearance for the app's floating bottom nav is width-scaled (`s(130)`), but the nav it has to clear is a fixed 56dp pill positioned by `insets.bottom`, so the two shrink and grow on unrelated axes.

```
content: {
      paddingBottom: s(130),
      paddingHorizontal: s(16),
      paddingTop: s(28),
    },
```

**Impact.** App.tsx renders the nav as `navWrap` with `position: 'absolute'` and `bottom: 12 + insets.bottom` (line 2383, style at 6504-6510) inside a SafeAreaView that already applies `paddingBottom: insets.bottom`, over a 56dp `navPill` — so the obstruction reaches `68 + insets.bottom` above the ScrollView's own bottom edge. On a 320dp-wide device with Android 3-button navigation (insets.bottom = 48 under edge-to-edge) the required clearance is 116dp while `s(130)` yields 115.6dp, i.e. zero margin: the last "Recent meetings" row sits flush under the nav pill and its copy/share buttons are unreachable. The project already exposes the correct number as `navClearance` in src/lib/responsive.ts:13 and MeetingHome does not use it.

**Fix.** Replace the magic number with the shared helper: `const { navClearance } = useResponsive();` and set the padding at the JSX level — `contentContainerStyle={[styles.content, { paddingBottom: navClearance }]}` — dropping `paddingBottom: s(130)` from makeStyles.

### src/meetings/MeetingRoom.tsx:2232
**Issue.** The invite buttons in the People panel have a fixed `height: 44` while their labels use scaling 14sp text and two of the three labels have no numberOfLines, so at large accessibility font sizes the wrapped label is clipped inside the fixed box.

```
inviteButton: {
    alignItems: 'center',
    borderColor: 'rgba(26,29,33,0.2)',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    height: 44,
    paddingHorizontal: 12,
  },
```

**Impact.** `inviteButtonText` (line 2240) has `flexShrink: 1` so it wraps rather than overflows, but the parent's height is hard-pinned at 44dp. "Copy meeting link" and "Mute all" (lines 1287-1295) carry no numberOfLines, so on iOS at Larger Accessibility Sizes (fontScale ~2.5–3.1) or Android accessibility font size 2.0 the label becomes two 28–34px lines totalling 56–68dp inside a 44dp box — the second line is cut off mid-glyph and the button reads as truncated garbage. The same pattern applies to `emailInput` (line 2151, `height: 44`, fontSize 14).

**Fix.** Swap the fixed heights for floors: `minHeight: 44` plus `paddingVertical: 10` on `inviteButton`, and `minHeight: 44` with `textAlignVertical: 'center'` on `emailInput`. Add `numberOfLines={1}` to the "Mute all" and "Copy meeting link" labels for parity with the meeting-code one.

### src/remote/RemoteControl.tsx:1777
**Issue.** The connecting screen's footer is absolutely positioned at bottom: 16 with no safe-area inset, and the screen renders no SafeAreaView at all, so on an edge-to-edge Android build the copyright line is drawn underneath the gesture/navigation bar.

```
connectingFooter: {
    position: 'absolute',
    bottom: 16,
    fontSize: 8,
    color: 'rgba(26,29,33,0.45)',
  },
```

**Impact.** app.json sets "edgeToEdgeEnabled": true, so on Android 15+ the app draws behind the system bars and insets.bottom is 24-48dp for gesture navigation or 48dp for 3-button navigation. An 8pt line placed 16dp from the window bottom therefore sits entirely inside the navigation bar region and is overdrawn by it (or by the gesture pill on a light background), rendering it unreadable on every modern Android phone. The whole screen also ignores insets.top, so on devices with a tall status bar the centred stack is optically pushed down.

**Fix.** Change to `bottom: insets.bottom + 16` using the useSafeAreaInsets value already in scope, or wrap connectingRoot (and lostRoot) in `<SafeAreaView edges={['top','bottom','left','right']} style={{ flex: 1 }}>`.

### src/remote/RemoteControl.tsx:1777
**Issue.** The connecting and connection-lost screens have zero safe-area handling, and the footer is pinned to a raw bottom: 16

```
connectingFooter: {
    position: 'absolute',
    bottom: 16,
    fontSize: 8,
    color: 'rgba(26,29,33,0.45)',
  },   // lines 1777-1782
  connectingRoot: { flex: 1, ... padding: 24 },   // line 1735
  lostRoot: { flex: 1, ... padding: 24 },   // line 1784
```

**Impact.** Both full-screen states are plain Views, not SafeAreaView, and neither consults useSafeAreaInsets even though the component already holds `insets` (line 212). With edgeToEdgeEnabled: true in app.json the app draws under the system bars, so on a gesture-navigation Android phone (bottom inset ~24dp) the 8pt copyright line at bottom: 16 is drawn underneath the gesture pill, and on a landscape device with a display cutout the centred content of both screens can run under the notch on the leading side. Every other screen in this file is inset-aware, so this is an inconsistency, not a design choice.

**Fix.** Wrap both roots in SafeAreaView (or add paddingTop/paddingBottom/paddingLeft/paddingRight from insets) and change the footer to bottom: insets.bottom + 16.

### src/remote/RemoteControl.tsx:848
**Issue.** Any viewport-size change silently throws away the user's pinch zoom — including simply showing or hiding the toolbar

```
const base = baseRect(surfaceSize, fitMode);
    resetPinchTransform();
    liveRectRef.current = base;
    setContentRect(base);
    setIsZoomed(false);
  }, [surfaceSize, fitMode, streamUrl, streamDims]);   // lines 848-854
  const bottomInset = toolbarCollapsed ? insets.bottom : TOOLBAR_HEIGHT + insets.bottom;   // line 791
```

**Impact.** surfaceH is derived from bottomInset, which changes by a full 64dp whenever the toolbar is expanded or collapsed (line 791), so surfaceSize changes and this effect resets contentRect to baseRect and clears isZoomed. Practical effect: zoom into a small control on the remote desktop, open the toolbar to reach Keyboard or Actions, and the zoom is gone. The same reset fires on every rotation and, on Android builds where the IME resizes the window, every time the software keyboard opens — precisely the moments a zoomed-in user is mid-task. Only the rotation case is deliberate (comment at lines 329-331).

**Fix.** Rescale the existing contentRect proportionally to the new surfaceSize instead of resetting to baseRect, or skip the reset when the change comes only from the toolbar/keyboard band rather than a real orientation change.

### src/connect/ConnectHome.tsx:249
**Issue.** heroFrame (246-255) hard-codes height: 240 and its flexShrink: 1 is inert inside the flexGrow ScrollView content container, so the illustration never yields on short windows even though src/lib/responsive.ts:15 already computes a viewport-relative illustrationHeight. In split-screen / foldable-cover windows the art plus paddingTop 40, the 20dp label and the 28dp gap consume ~328dp, so 'Search and connect' opens below the fold — reachable by scrolling, and with showsVerticalScrollIndicator={false} (114) there is no cue that it is there. Cosmetic first-paint issue, not a blocker; the fixed height is also a deliberate workaround (see the comment at 247-249), so any fix must keep aspectRatio out of it.

```
borderRadius: 4,
    flexShrink: 1,
    height: 240,
    overflow: 'hidden',
    width: '100%',
```

**Impact.** Short viewports: Android split-screen/multi-window, foldable cover screens, and phones with Display size = Largest. `flexShrink: 1` is inert here because the box lives in a ScrollView content container (which is free to grow), so the height is effectively fixed. With 40dp of top padding plus a 20dp label plus 28dp gap, the art alone consumes ~328dp; in a ~236dp-tall content area the user opens the Connect tab to a screen that is nothing but a picture — 'Search and connect' and 'Recent connections' are entirely below the fold on first paint, with no visual cue to scroll. src/lib/responsive.ts:15 already computes `illustrationHeight = max(80, min(240, contentWidth * 0.65, safeHeight * 0.3))` and App.tsx:6649-6651 uses it for the other two illustrations in the app.

**Fix.** `const { illustrationHeight } = useResponsive();` and apply `[styles.heroFrame, { height: illustrationHeight }]`. resizeMode is already 'contain', so a shorter box just scales the art down — no distortion.

### src/devices/DevicesTour.tsx:108
**Issue.** The tour overlay's own 28dp padding is not accounted for by ResponsivePanel's modalMaxHeight, so on devices that report small safe-area insets the card's height cap exceeds the space that actually exists and the card is trimmed top and bottom.

```
overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    zIndex: 90,
  },
```

**Impact.** Android tablets and emulators/devices where insets.top + insets.bottom < 32dp (e.g. a status bar only, no gesture inset). ResponsivePanel caps the card at `modalMaxHeight = safeHeight - 24` (src/lib/responsive.ts:14), but the overlay only offers `windowHeight - 56`, so the cap is up to 32dp too generous; a tour card at full height (largest font size on the longest step, 'Inside a list, press and hold a device (or tap ⋮)…') then overflows the centred container and is clipped ~16dp at each end, shaving the icon circle and the Skip/Done row. On a normal phone with a 24dp status inset plus a gesture inset the numbers happen to work out, which is why it has not been noticed.

**Fix.** Either drop the overlay padding to a token derived from `gutter` and subtract it in the panel, or pass an explicit `maxHeight: modalMaxHeight - 56` on `styles.card`; simplest is to teach ResponsivePanel to subtract its container's vertical padding (or use `insets`-aware padding on the overlay instead of a flat 28).

### src/connect/ConnectHome.tsx:185
**Issue.** The only control that opens a recent device's actions menu is a 16dp icon with hitSlop 10, giving a 36dp touch target — below the 48dp Android / 44pt iOS minimum.

```
<Pressable hitSlop={10} onPress={() => openMenu(device)}>
                            <Feather name="more-vertical" size={16} color="#111315" />
                          </Pressable>
```

**Impact.** High-density small phones (a 16dp glyph is ~2.9mm on a 5" 1080p panel) and users with Display size = Largest, where rows sit closer together (`recentRow` minHeight is only 28dp and `recentBody` gap is 14dp). Taps land next to the target and nothing happens; the row itself is not pressable and the adjacent 'shuffle' glyph (line 184) is not a Pressable at all, so there is no fallback path to Control / File Share from this screen.

**Fix.** Give the Pressable an explicit `minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center'` (or hitSlop {top:14,bottom:14,left:14,right:14}) and raise `recentRow`'s minHeight to 44 so adjacent targets do not overlap.

### src/devices/DeviceManagement.tsx:493
**Issue.** The action sheet has no maxWidth while the dialog card next to it correctly caps at 360dp, so on tablets and unfolded foldables the sheet stretches the full window width.

```
sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    ...   // no maxWidth, no alignSelf
  },  vs.  card: { width: '100%', maxWidth: 360, maxHeight: '82%', ... }
```

**Impact.** Tablets (app.json sets ios.supportsTablet: true) and unfolded foldables, 600-1280dp wide. The add-menu / device-menu / group-menu sheet spans the entire window, so each 48dp menuRow puts a lone 18dp Feather and a short label at the far left of a 700-1200dp expanse with the rest empty — the touch targets end up nowhere near the thumb on a large screen. The dialog branch three lines below already solves this with maxWidth: 360 (line 524), so the inconsistency is within one file.

**Fix.** Add `maxWidth: 480, width: '100%', alignSelf: 'center'` to `sheet` (and matching borderRadius on all four corners once it is inset), mirroring the card's treatment.

### src/components/ChatToast.tsx:86
**Issue.** The toast avatar is a fixed 40x40 circle containing text that does scale, with no maxFontSizeMultiplier, so the initials outgrow the disc at accessibility font sizes.

```
avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  ...
  avatarText: { fontSize: 15, fontWeight: '600', color: '#FF8A00' },
```

**Impact.** At iOS Dynamic Type AX3 (≈2.35x) or Android font size Largest combined with Display size Large, the 15sp initials render at 30-35sp — roughly 40-46dp wide for two capitals — inside a 40dp circle whose overflow is visible by default, so the letters spill over the orange disc and collide with the sender name to their right.

**Fix.** Add maxFontSizeMultiplier={1.3} to the avatarText and size the avatar from the font scale: `{ width: 40 * Math.min(fontScale, 1.3), height: ..., borderRadius: ... }` via useResponsive().

### src/components/FadeInView.tsx:27
**Issue.** Every page's content is wrapped in an unconditional 380ms fade + 16dp slide with no reduce-motion check; AccessibilityInfo is never used anywhere in the app.

```
const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
```

**Impact.** Users who have enabled iOS Settings > Accessibility > Motion > Reduce Motion, or Android Settings > Accessibility > Remove animations, still get a slide-and-fade on every single navigation (FadeInView wraps the Devices, Chat, Connect and Apps page bodies at App.tsx:626/1146/1397/1451), which is the exact motion class those settings exist to suppress.

**Fix.** Read AccessibilityInfo.isReduceMotionEnabled() once (plus its 'reduceMotionChanged' listener) in a useReducedMotion hook and, when true, call progress.setValue(1) instead of starting the timing animation.

### src/components/IosBottomNav.tsx:42
**Issue.** The tab icon size is hard-coded at the call site and never scales, while the label beneath it does scale with the system font setting.

```
{renderIcon(tab.key, '#111315', 22)}
```

**Impact.** At Android font size Largest or iOS AX text sizes the 11sp label grows to 15-34sp while the icon stays 22dp, so the icon/label pair inverts visually — the label becomes larger than the glyph it is meant to caption — and the bar grows only on the text axis, unbalancing the pill. The same call also passes a hard-coded '#111315' for both active and inactive tabs, so once the label truncates (see the label finding) the only remaining active affordance is the pale grey pill.

**Fix.** Pass a scaled size — `renderIcon(tab.key, active ? '#111315' : '#6B7280', Math.round(22 * Math.min(fontScale, 1.3)))` using useResponsive().fontScale — so the icon and label grow together.

### src/components/ChatToast.tsx:66
**Issue.** The app-wide toast is the only shared surface with no maximum width, so it stretches edge-to-edge on tablets while its avatar and type stay phone-sized

```
wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 200,
  },   // no maxWidth / alignSelf, unlike IosBottomNav.tsx:74 (maxWidth 400) and every ResponsivePanel card (maxWidth 281-560)
```

**Impact.** iPad (app.json:16 supportsTablet: true, 820-1024pt portrait) and foldable inner displays: an incoming chat message renders as a ~1000dp-wide, ~64dp-tall white bar across the top of the screen holding a 40dp avatar and two single-line 13-14sp strings, with the message text ending after ~10% of the bar's width. It also ignores insets.left/right, so on any surface with side insets the card runs under them.

**Fix.** Give wrap the same treatment the nav already has - `alignSelf: 'center', width: '100%', maxWidth: 480` plus left/right padding derived from insets - and cap the text with maxFontSizeMultiplier so the fixed 40dp avatar and the two text lines stay proportional at large font scales.

### android/app/src/main/AndroidManifest.xml:26
**Issue.** The app opts out of predictive back navigation while targeting SDK 36 and relying on legacy BackHandler interception for its full-screen session UI.

```
android:enableOnBackInvokedCallback="false"
```

**Impact.** With targetSdkVersion 36 confirmed, Android 16 runs the predictive-back system animations (back-to-home, cross-activity) by default and this legacy opt-out no longer suppresses them. src/remote/RemoteControl.tsx:344 and App.tsx:2596 both intercept `hardwareBackPress` and return true to keep the user in the session / show the disconnect confirm. On gesture-navigation devices the user therefore sees the app peel away under their finger and snap back when the callback returns true — a visible flicker during every back swipe on the remote-control screen, which is the app's most latency-sensitive surface. It also means the swipe-from-edge gesture and the app's own back handling are competing rather than cooperating. Generated by app.json:29 "predictiveBackGestureEnabled": false.

**Fix.** Verify the behaviour on an Android 16 device first. If the flicker reproduces, migrate off the manifest opt-out: set app.json "predictiveBackGestureEnabled": true, remove android:enableOnBackInvokedCallback="false", and replace the return-true BackHandler interception with RN 0.81's predictive-back-aware handling so the disconnect confirm is driven by the gesture rather than fighting it.

### App.tsx:2432
**Issue.** SafeAreaProvider is mounted at the root but without initialMetrics, and react-native-safe-area-context v5 renders nothing at all until the first native inset event arrives

```
App.tsx:2432 `return <SafeAreaProvider><LanguageProvider><AppContent /></LanguageProvider></SafeAreaProvider>;` — and node_modules/react-native-safe-area-context/src/SafeAreaContext.tsx renders `{insets != null ? (...children...) : null}` with insets seeded from `initialMetrics?.insets ?? initialSafeAreaInsets ?? parentInsets ?? null`
```

**Impact.** With no initialMetrics the whole app tree renders null until NativeSafeAreaProvider fires onInsetsChange, giving a blank frame on cold start on every device. It matters more than usual here because it compounds the configChanges gap: every Activity recreation on a fold/unfold, split-screen resize or Display-size change replays that blank frame before the remounted tree appears, which is what makes the recreation read as a full app relaunch rather than a flicker. Slowest on low-end devices where the first native layout pass is late.

**Fix.** Import initialWindowMetrics from react-native-safe-area-context and pass it: `<SafeAreaProvider initialMetrics={initialWindowMetrics}>`.

### src/chat/ChatEmpty.tsx:69
**Issue.** Four screens hardcode the floating-nav clearance in dp instead of using the font-scale-aware `navClearance` helper, but the iOS nav bar's height is driven by its label font size.

```
paddingBottom: 120,
```

**Impact.** iOS with Larger Accessibility Sizes and Android at 2.0x. `IosBottomNav` has no fixed height — it grows with its 11sp label (src/components/IosBottomNav.tsx:107, 113) — so at 2.0x the bar occupies roughly 87dp plus `bottom: 10 + insets.bottom` (~34dp) ≈ 131dp, more than the 120dp reserved here, more than the 130dp in src/connect/ServiceQueueScreen.tsx:95, and more than `s(130)` (which shrinks to 115dp on a 320dp phone) in src/meetings/MeetingHome.tsx:350. The last list item or CTA sits under the floating pill and cannot be tapped.

**Fix.** Use the existing `navClearance` from `useResponsive()` (src/lib/responsive.ts:13) in these files, exactly as App.tsx:6644 already does for its six scroll containers.

### App.tsx:5416
**Issue.** Legal/footer copy is set at 8sp — below any legible minimum — and sits in a position:absolute footer that reserves no layout space.

```
signInFooterSub: { color: 'rgba(26, 29, 33, 0.5)', fontSize: 8, fontWeight: '400', lineHeight: 11, textAlign: 'center' },  // App.tsx:5414-5419, rendered live at App.tsx:1662 inside signInFooter: { alignItems: 'center', bottom: 16, position: 'absolute' } (:5402-5406). Same class at src/settings/UpgradePlanScreen.tsx:386 footerSub fontSize 9.
```

**Impact.** On any high-density small phone the 'Copyright 2026 (c) Remote 365...' line on the Launching screen renders around 8sp (~5.5pt) at default settings — effectively unreadable, and the smallest type in the app by 2sp. Because the footer is position:absolute with no left/right and no reserved height, once the user raises the font size the wrapped copyright grows upward from bottom:16 and rides over the 'Open Remote 365' CTA above it instead of pushing it up.

**Fix.** Raise the footer sizes to >= 11sp and make the footer a normal flow child at the end of the launchContent container (with marginTop:'auto') rather than position:absolute, so its height is reserved as the text scales.

### src/meetings/MeetingRoom.tsx:2015
**Issue.** In-session unread badges are even tighter than the chat-list badge the auditor found: 15dp and 16dp boxes around 9sp text on the two screens that matter most during a live session.

```
chatUnreadBadge: { ... height: 15, ... minWidth: 15, paddingHorizontal: 3, position: 'absolute', right: -7, top: -6 }  // MeetingRoom.tsx:2015-2025 with chatUnreadText fontSize 9 (:2026-2030), live at MeetingRoom.tsx:1426-1427. Same shape at RemoteControl.tsx:1555-1566 (height 16) / unreadBadgeText fontSize 9 (:1568), live at RemoteControl.tsx:1310-1311.
```

**Impact.** 9sp text needs a ~10.5dp line box at 1x, so these overrun at 15/10.5 = 1.43x (meeting room) and 16/10.5 = 1.52x (remote session). At Android's largest accessibility steps the '9+' unread counter on the meeting toolbar and on the remote-control chat tab is sliced, and because both badges are position:absolute with negative offsets (right:-7, top:-6) the overrun draws over the icon they sit on.

**Fix.** Replace height with minHeight (keep minWidth) on both badges, or pass allowFontScaling={false} / maxFontSizeMultiplier={1.3} to the two counter Texts, which is defensible for a numeric badge.

### src/meetings/MeetingRoom.tsx:2321
**Issue.** The in-meeting notice toast is absolutely positioned at a hardcoded `top: 96` while the header above it is inset-aware, so on devices with a tall status-bar inset the toast lands on top of the header.

```
noticeToast: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#FFB347',
...
    position: 'absolute',
    top: 96,
    zIndex: 40,
  },
```

**Impact.** The header is rendered with `paddingTop: insets.top + 10` (line 1066) and contains a 20dp title row plus a 4dp gap and the meta row, so its bottom edge is roughly `insets.top + 60`. On a phone with a 48dp top inset (punch-hole/edge-to-edge devices, and the app sets `edgeToEdgeEnabled: true` in app.json:28) that is ~108dp — the toast at 96dp overlaps the participant-count line. Compare App.tsx:6655, where the equivalent `connectToast` is patched at runtime to `top: r.insets.top + 12`.

**Fix.** Apply the inset inline the way connectToast does: `<View style={[styles.noticeToast, { top: insets.top + 56 }]}>` at line 1458, and drop the literal from the stylesheet.

### src/devices/DeviceManagement.tsx:585
**Issue.** Group chips have a fixed 32dp height together with a 180dp maxWidth and no line limit on their label, so a long group name wraps inside a box that cannot grow and the second line is clipped.

```
chip: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(17,19,21,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 180,
  },
...
  chipText: { fontSize: 13, color: '#111315' },
```

**Impact.** `maxWidth: 180` forces any group name longer than ~24 characters at 13sp to wrap, and the fixed `height: 32` then clips the second line — at Android font scale 1.3 the wrap point drops to ~18 characters, so ordinary names such as 'Warehouse Floor Terminals' render as a half-line of text inside the pill. The pill also never grows on a tablet, where there is room for the full name.

**Fix.** Change to `minHeight: 32, paddingVertical: 6` and add `numberOfLines={1}` to the chipText element so it ellipsizes at the 180dp cap instead of wrapping into a clipped box.

### src/settings/TwoFactorScreen.tsx:193
**Issue.** The 2FA code field pairs a 22sp font with a fixed 52dp dp height, so the digits are clipped at high OS font scales.

```
codeInput: { backgroundColor: '#F8FAFC', borderColor: 'rgba(26,29,33,0.15)', borderRadius: 8, borderWidth: 1, color: '#111315', fontSize: 22, height: 52, letterSpacing: 6, paddingHorizontal: 16, textAlign: 'center' },
```

**Impact.** `height` is dp and never scales; `fontSize` is sp and does. At fontScale 1.9-2.0 ('Largest' on Android, or the largest Dynamic Type steps on iOS) a 22sp glyph needs a ~52-53dp line box with no room for the 1dp border, so the tops and bottoms of the six digits are cut inside the field. Users on Largest font — the population most likely to need a big code field — cannot read what they typed while enrolling in two-factor.

**Fix.** Replace `height: 52` with `minHeight: 52, paddingVertical: 10` (the same pattern already used for `inputWrap` in src/auth/AuthScreen.tsx:190).

### src/chat/ChatThread.tsx:763
**Issue.** `allowFontScaling={false}` is applied unevenly across the app — 21 occurrences concentrated in Meetings and on the chat composer — so parts of a single screen honour the OS font-size setting and parts do not.

```
          <TextInput
            allowFontScaling={false}
            style={styles.messageInput}
            value={input}
```

**Impact.** On the chat thread, message bubbles scale with the OS font setting but the composer the user types into stays at a fixed 13dp, so on a phone set to Large/Largest the sent message is legible and the draft is not. The same flag appears 15 times in src/meetings/MeetingHome.tsx (lines 212-298), once in src/meetings/MeetingRoom.tsx, and four times in App.tsx (498, 503, 1158, 1542, including the support-ID search field on the Connect screen). Low-vision users see a UI that only half-responds to their accessibility setting.

**Fix.** Remove `allowFontScaling={false}` everywhere and instead cap growth where layout genuinely cannot absorb it, using `maxFontSizeMultiplier={1.4}` on those specific nodes — and pair it with `minHeight` (not `height`) on their containers.

### src/remote/RemoteControl.tsx:1379
**Issue.** The session toolbar applies the horizontal safe-area insets twice - once as SafeAreaView padding and again as an explicit margin

```
<SafeAreaView
          edges={['bottom', 'left', 'right']}
          style={[
            styles.toolbar,
            { marginLeft: insets.left, marginRight: insets.right },
```

**Impact.** react-native-safe-area-context applies edges as padding, so declaring 'left'/'right' already insets the toolbar's content; the extra marginLeft/marginRight shrinks the white bar itself by the same amount again. On a landscape 3-button-navigation phone (insets.left or right ~48dp) the bar stops 48dp short of the screen edge and its buttons stop another 48dp inside - a ~96dp dead band on one side of the in-session control bar. Note this is the double-inset the other audit was looking for, and unlike the BottomNav case it is real, because margin and padding both apply to a non-absolutely-positioned box (this SafeAreaView is a flow child of the absolutely positioned styles.toolbar only in the bottom axis).

**Fix.** Keep the SafeAreaView edges OR the explicit margins, not both.

### src/meetings/MeetingHome.tsx:350
**Issue.** Meetings scroll clearance is a k-scaled constant that ignores insets.bottom, unlike every other screen which uses the responsive navClearance

```
    content: {
      paddingBottom: s(130),   // s = value * min(1, width/360)
```

**Impact.** MeetingHome is rendered above the floating nav pill (App.tsx:1398-1409). The pill's top edge sits 12 + insets.bottom + 56 above the screen bottom - 116dp on a 3-button-navigation phone. The scroll clearance is 130dp at k=1 but shrinks with the screen: 115.6dp on a 320dp phone, which is less than the pill's own 116dp, so the last 'Recent meetings' row (and its copy/share buttons) sits underneath the nav pill and cannot be tapped. Every other list in App.tsx uses useAppStyles' navContent, whose paddingBottom is r.navClearance = max(72, 42 + 16*fontScale) + 32 + insets.bottom (src/lib/responsive.ts:13) and therefore grows with both the inset and the font scale; MeetingHome is the one screen that opted out.

**Fix.** Use useResponsive().navClearance for the contentContainer paddingBottom instead of s(130).

### App.tsx:3012
**Issue.** `ScreenBackground` renders three full-screen react-native-svg radial gradients behind every screen and is not memoized, so it re-reconciles on every AppContent render.

```
3012:         {!showSplash && fontsReady ? <ScreenBackground /> : null}

(ScreenBackground.tsx:38-64 renders three <Blob> children, each an <Svg> with a <Defs><RadialGradient> and a <Circle>)
```

**Impact.** Mid/low-end phones. Because AppContent re-renders on every typing push, presence flip and toast, three SVG subtrees with gradient definitions are re-rendered and diffed each time. The native views usually end up unchanged, so the cost is JS reconciliation rather than repaint — but it is unavoidable work added to every single one of the app's most frequent re-renders.

**Fix.** `export const ScreenBackground = React.memo(function ScreenBackground() { ... })` — it takes no props, so memoizing it makes every one of those re-renders free. Do the same for `HeaderTopGlow` (App.tsx:402), which renders a fourth gradient and is used from the shared header.

### src/lib/i18n.tsx:167
**Issue.** The language context value is a fresh object literal on every provider render, so every `useTranslation()` consumer in the app is forced to re-render together.

```
167:   return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>;
```

**Impact.** All phones, but only at the moment the language changes or the stored language is restored on boot — the provider's only state is `lang`, so it rarely re-renders. The visible effect is a one-off full-tree re-render on cold start when the persisted language loads from AsyncStorage, which lands right in the middle of the splash-to-first-screen transition.

**Fix.** `const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);` and pass `value={value}` — `setLang` and `t` are already `useCallback`'d, so this makes the context identity stable across any incidental provider render.

### android/app/build.gradle:76
**Issue.** R8/minification is disabled for release builds — the property it reads is never set in gradle.properties, so `minifyEnabled` resolves to false in every release APK.

```
76:  def enableMinifyInReleaseBuilds = (findProperty('android.enableMinifyInReleaseBuilds') ?: false).toBoolean()
...
146:            minifyEnabled enableMinifyInReleaseBuilds

`grep -n 'Minify' android/gradle.properties` -> no match, so the fallback `false` always wins.
(For contrast, Hermes and the New Architecture ARE on: android/gradle.properties:42 `hermesEnabled=true`, :38 `newArchEnabled=true`.)
```

**Impact.** All Android devices, most visible on low-end ones at cold start. Without R8 the release APK keeps every unused class and all debug metadata from the ~40 autolinked Expo/RN native modules, which enlarges the DEX, slows class loading and ART verification on first launch, and inflates the download. It does not touch JS-side frame times (Hermes bytecode is unaffected), which is why this is low rather than high.

**Fix.** Add `android.enableMinifyInReleaseBuilds=true` (and, once verified, `android.enableShrinkResourcesInReleaseBuilds=true` for the property read at build.gradle:144) to android/gradle.properties, then smoke-test a release build — proguard-rules.pro already exists and is wired at build.gradle:147.

### android/gradle.properties:31
**Issue.** The release APK is built universal for four ABIs including two x86 variants no phone uses, and there is no `splits` block or bundle configuration anywhere in build.gradle.

```
android/gradle.properties:31  reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64

`grep -n 'splits' android/app/build.gradle` -> no match (no abi splits, no universalApk config).
```

**Impact.** Every user downloading the APK directly — and per this repo's own distribution notes the Android builds are handed out as APKs from the downloads page rather than through Play. Four copies of the RN/Hermes/react-native-webrtc .so payloads land in one file, roughly quadrupling the native portion of the download and the installed footprint. On a low-storage phone that is the difference between installing and not; it has no effect on frame times.

**Fix.** Either narrow gradle.properties:31 to `armeabi-v7a,arm64-v8a` for distribution builds, or add an `splits { abi { enable true; reset(); include 'armeabi-v7a','arm64-v8a'; universalApk false } }` block to android/app/build.gradle and publish the per-ABI APKs.

### App.tsx:2857
**Issue.** `onConversationUpdated` triggers a full four-endpoint account refetch with a loading-state flip and no debounce — sitting directly above an onAccountSync handler in the same object that IS debounced, so the omission is clearly unintentional.

```
2857:    onConversationUpdated: () => { loadAccountData(); },

loadAccountData (App.tsx:2745-2763) does:
  setDataLoading(true);
  const [deviceRows, groupPayload, conversationRows, meetingRows] = await Promise.all([
    apiFetch('/api/devices/mine'), apiFetch('/api/devices/user-groups'),
    apiFetch('/api/chat/conversations'), apiFetch('/api/chat/meetings'),
  ]);
  setDevices(...); setDeviceGroups(...); setConversations(...); setMeetings(...);

versus the immediately following handler, App.tsx:2864-2869:
    onAccountSync: (scope) => { if (scope !== 'devices') return;
      if (deviceSyncTimerRef.current) clearTimeout(deviceSyncTimerRef.current);
      deviceSyncTimerRef.current = setTimeout(() => { refreshDevices(); }, 800); }
```

**Impact.** Any phone on mobile data, worst on a large fleet. The backend publishes `chat-conversation-updated` from eight sites in apps/auth-service/src/routes/chat.ts (accept/reject, rename, mute, block, archive, participant changes), so a burst — accepting several pending contacts, or a group edit that touches multiple participants — fires N x 4 HTTP requests back to back and replaces every device, group, conversation and meeting object with fresh identities each time, reconciling the entire unvirtualized device list on each round. `setDataLoading(true)` also flips the managed-devices screen to its 'Loading devices...' branch (App.tsx:978-981), so the list can visibly blink out and back mid-burst.

**Fix.** Give this handler the same trailing debounce the device path already has (reuse the deviceSyncTimerRef pattern with an ~800ms timer), and refetch only the chat slice — a conversation rename has no reason to re-pull /api/devices/mine and /api/chat/meetings. Skip the setDataLoading flip for socket-driven refreshes, exactly as refreshDevices (App.tsx:2767-2779) deliberately does.

### App.tsx:3012
**Issue.** The app-wide SVG backdrop is rendered unmemoized as the first child of AppContent's render, so its three react-native-svg gradient trees are re-rendered by every one of AppContent's state changes, on every screen.

```
3009:   return (
3010:       <View style={styles.appRoot} {...swipeNavigator.panHandlers}>
3011:         {/* Shared orange gradient backdrop shown on every screen (splash draws its own). */}
3012:         {!showSplash && fontsReady ? <ScreenBackground /> : null}

src/components/ScreenBackground.tsx:39-66 renders three <Blob> children, each of which is a <Svg> containing <Defs><RadialGradient><Stop x3></RadialGradient></Defs> plus a <Circle>, and each Blob's `position` and size props are freshly computed objects (`{ top: 10, left: -width * 0.3 }` etc.). Neither ScreenBackground nor Blob is wrapped in React.memo (grep for React.memo across App.tsx and src/ returns zero hits).
```

**Impact.** Mid/low-end phones, on every screen. Each of the 27 setState calls in AppContent — chat toast, typing flag, presence patch, device refetch, tab change — walks and reconciles three react-native-svg element trees plus their gradient definition nodes before it gets to the screen the user is actually looking at. RN's prop diffing means no native commit results (the recomputed numbers are identical), so this is pure wasted JS-thread reconciliation rather than a redraw — which is why it is low and not medium, but it is on the critical path of literally every state update in the app.

**Fix.** Wrap the export in React.memo (`export const ScreenBackground = React.memo(function ScreenBackground() {...})`) — it takes no props, so memo makes every parent re-render a no-op for it. Do the same for Blob, or lift the three Blobs to module-scope constants keyed on width/height via a single useMemo.
