# Remote 365 — Android Host: Status Brief

_Last updated: 2026-08-01_

## TL;DR

We have built a **native Android "host" app** that lets a Remote 365 operator view and
fully control an Android phone from the desktop or web app — the equivalent of TeamViewer's
mobile host. It is **working end-to-end on real hardware today**: live screen, tap, scroll,
type, keyboard shortcuts, and two-way clipboard.

The one genuinely hard problem on Android — **unattended access** (connecting to a phone with
nobody standing next to it) — is solved and verified, but it requires a **one-time setup step**
on each phone. There is no way around that step for an app a customer installs themselves; this
is an Android security rule, not a gap in our work. We have a clear plan for making that step as
light as possible, plus a zero-touch route for Samsung fleets.

---

## What works today (verified on real hardware)

Test device: **Samsung Galaxy A05s, Android 15, One UI 7.0** — deliberately a low-end, current
phone, i.e. a hard case.

| Capability | Status | How it's verified |
|---|---|---|
| Builds to an installable APK | ✅ | 52 MB debug APK, WebRTC libs for all 4 CPU types |
| Registers with our backend, appears in device list | ✅ | Device ID `544318290`, live on preprod |
| Live screen streaming to desktop **and** web viewer | ✅ | H.264 over WebRTC |
| **Silent capture — no per-session prompt** | ✅ | System confirms active capture, no dialog shown |
| Tap, swipe, live-drag scrolling | ✅ | Dispatched via accessibility, confirmed on device |
| Mouse-wheel scrolling | ✅ | Tuned so one notch ≈ ¼ screen |
| Typing in normal text fields | ✅ | Companion keyboard injects text |
| Typing in stubborn apps (e.g. calculator) | ✅ | Verified: typed `12+70=82` into the calculator |
| Keyboard shortcuts (Ctrl+A/C/V/X/Z/Y, arrows, etc.) | ✅ | Routed to the focused field |
| Clipboard: PC → phone | ✅ | Paste from desktop lands on phone |
| Clipboard: phone → PC | ✅ | Copy on phone reaches desktop/web clipboard |
| Survives reboot and app-update | ✅ | Auto-restarts and re-arms input |
| Screen wake + lock-screen handling mid-session | ✅ | Re-lights a dozing screen automatically |

**Bottom line:** a fully usable remote-control session works right now, on the hardest device
we could pick.

---

## The central problem: unattended access on Android

"Unattended" = the operator connects and the phone just works, with no one there to approve it.
This is the whole value proposition, and Android is built specifically to make it hard, because
"an app that can silently record your screen forever" is also the definition of spyware.

**The key permission (`PROJECT_MEDIA`, i.e. screen capture) cannot be granted by our app, by our
server, or by any script.** Only three authorities can enable it. This was confirmed by
inspecting **TeamViewer's own app on the test device** — even they have no bypass; they use a
paid Samsung licence.

There are exactly three viable paths, and every product in this space uses one or more:

### Tier A — one-time on-device setup (no PC, no cable) — **RECOMMENDED**
The phone pairs to its **own** debugging channel over localhost and grants itself the permission.
- **User does ~6 taps, once, ~45 seconds.** Then unattended forever.
- **Works on every Android brand.** No licence, no approval, no cost.
- The grant persists across reboots for the life of the install.
- Proven approach (Shizuku, LADB, and others ship it). **Not yet built** — currently the grant is
  applied from a dev machine during testing.
- Honest limit: the user must do those taps once; the app can guide them but cannot tap the
  system toggle for them. Nothing legitimate removes this on Android.

### Tier B — Samsung Knox — zero-touch, Samsung only
Samsung's Knox licence unlocks a privileged remote-control API with **no setup and no prompt** —
true install-and-go. This is exactly how TeamViewer runs unattended on Samsung phones.
- **The licence (KPE Premium) is free**, but requires **Samsung Knox Partner approval** (an
  application, not a purchase).
- **Samsung only.** Other brands still need Tier A.
- **Roadmap risk:** the API is deprecated on Android 15 and reportedly removed on Android 16.
  Works today; longevity must be confirmed with Samsung.

### Tier C — attended — zero setup, works everywhere
The person at the phone taps "Start now" each session. This is literally TeamViewer QuickSupport.
- No setup, every brand, but not unattended.
- **We already have this working.**

---

## How we compare to TeamViewer

We dissected TeamViewer on the test phone. Findings:
- Their unattended Android support on Samsung uses a **Samsung Knox licence** — a commercial
  partnership, not a technical trick.
- On non-Samsung phones, TeamViewer falls back to an **unprivileged add-on that prompts every
  session** — i.e. exactly Tier C.
- They require the user to install **two** apps and enable accessibility.

Our Tier C already matches them with **one** app. Our Tier A would make us **better than
TeamViewer on non-Samsung phones** (they can only do attended there; we could do unattended).

---

## Known limitations & risks (stated plainly)

- **One-time setup is unavoidable** for a self-install app that wants unattended access on any
  brand except licensed-Samsung. This is an OS constraint.
- **Tested on one device so far.** Needs a broader device matrix before shipping.
- **Secure lock screen (PIN):** Android 15 stops screen capture the instant a PIN keyguard
  engages. We auto-recover, but there is a brief gap; this is OS-enforced.
- **Full reinstall** drops the grant (an app *update* keeps it).
- **Very large clipboard copies (>32 KB)** don't yet sync to the web viewer (normal text does).
- **iOS host not started.** iOS only permits *view*, not control — a separate, more limited effort.

---

## Decisions needed

1. **Which brands will customers actually use?** If mostly Samsung, Knox is worth pursuing hard.
   If mixed, Tier A is the priority because it covers everything.
2. **Build the Tier A setup wizard now?** It's the highest-value work that doesn't depend on
   anyone else, and it's the real answer to "unattended without Samsung."
3. **Apply for Samsung Knox Partner status?** Free, parallel, no downside — unlocks zero-touch on
   Samsung. Requires a company application to Samsung.

---

## Recommended next steps

1. **Ship Tier C now** — it works and matches TeamViewer. Immediate usable product.
2. **Build the Tier A wizard** — one-time guided setup → unattended on all brands. ~Few days.
3. **Apply for Knox Partner status in parallel** — free, unlocks Samsung zero-touch later.
4. **Broaden device testing** beyond the single A05s.

The "install it and it works with zero user action, on any phone" product **does not exist on
Android** for a self-install app — not for us, not for TeamViewer, not for anyone. The closest is
Knox on Samsung. Tier A is the honest best-in-class experience for everyone else: 45 seconds once,
then nothing ever again.
