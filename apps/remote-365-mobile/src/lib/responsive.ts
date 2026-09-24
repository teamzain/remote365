// All dimensions are React Native logical pixels (dp), never physical pixels.

/**
 * Ceiling applied to the OS font-scale setting.
 *
 * Android 14+ allows up to 2.0x and iOS accessibility sizes go higher still. This UI is dense
 * (toolbars, badges, chat rows), and at 2.0x it cannot reflow without becoming unusable, so text
 * is allowed to grow to this multiple and then stops. Pass it to every <Text>/<TextInput> as
 * `maxFontSizeMultiplier` so the cap and the space we reserve below agree.
 *
 * Raise or lower this ONE constant to change the app-wide policy.
 */
export const MAX_FONT_SCALE = 1.3;

/** Minimum touch target. Android's guideline is 48dp; iOS' is 44pt. */
export const MIN_TOUCH = 48;

/**
 * The reference width the UI is sized against: an iPhone 15 (393dp).
 *
 * This is deliberately the iOS width, not a typical Android one. React Native uses the same dp
 * values on both platforms, so the design occupies a LARGER fraction of a narrower screen — which
 * is why the app reads as "bigger" on Android. Most Android phones report 339-384dp (a Galaxy
 * A05s is 384dp by default and only 339dp once its owner raises Display size), against 393dp on a
 * current iPhone. Measuring against 393 makes a narrower screen show the same proportion of the
 * design that iOS does, instead of a zoomed-in slice of it.
 *
 * At or above this width nothing is rescaled at all.
 */
export const DESIGN_WIDTH = 393;

/**
 * How far the UI may shrink to claw back room on a cramped viewport (a small phone, or a phone
 * whose owner raised Android's Display size). 0.85 = at most 15%.
 *
 * It has to sit below 339/393 = 0.863, or the floor would clip exactly the case this is for — a
 * Galaxy A05s one Display-size step up. Lower it further and text starts to get genuinely hard to
 * read; raise it toward 1 and the clamp stops doing anything. Touch targets are unaffected either
 * way — `tappable` floors at MIN_TOUCH after this is applied.
 */
export const UI_SCALE_FLOOR = 0.85;

/** Static spacing scale — spacing is deliberately NOT font-scaled, only text boxes grow. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

// All dimensions are React Native logical pixels (dp), never physical pixels.
export function getResponsiveLayout(width: number, height: number, fontScale = 1, insets = { top: 0, bottom: 0, left: 0, right: 0 }) {
  const safeWidth = Math.max(0, width - insets.left - insets.right);
  const safeHeight = Math.max(0, height - insets.top - insets.bottom);
  const gutter = safeWidth < 360 ? 12 : safeWidth >= 600 ? 24 : 16;
  const contentWidth = Math.max(0, Math.min(720, safeWidth - gutter * 2));
  const compact = safeWidth < 360 || safeHeight < 600;

  // The effective scale after our cap. `fs` may dip below 1 when the user picks a SMALLER system
  // font; `grow` never does, so a box never shrinks below its design size.
  const fs = Math.min(fontScale, MAX_FONT_SCALE);
  const grow = Math.max(1, fs);

  /**
   * Clamp on Android's "Display size" setting.
   *
   * Display size works by raising the device's density, which LOWERS the dp the app sees — a
   * Galaxy A05s goes from 384x853dp at default to 339x753dp one step up, rendering everything
   * ~13% larger and costing 100dp of height (enough to push the sign-up form into scrolling).
   * The app cannot read the device's default density from JS, so it cannot undo the setting —
   * and should not: someone who enlarged their display did so deliberately.
   *
   * Instead we give back a bounded amount of room. Below DESIGN_WIDTH the type and spacing
   * scale down, never past UI_SCALE_FLOOR, so a cramped viewport recovers at most 10% and the
   * user's choice still clearly takes effect. At or above DESIGN_WIDTH this is exactly 1, so
   * every normal phone renders byte-for-byte as before.
   *
   * Touch targets deliberately do NOT use this — see `tappable`, which floors at MIN_TOUCH.
   * An earlier hand-rolled version of this idea in MeetingHome had no floor and no touch-target
   * carve-out, and shrank buttons to 28dp on small screens.
   */
  const uiScale = Math.min(1, Math.max(UI_SCALE_FLOOR, safeWidth / DESIGN_WIDTH));

  /**
   * Type ramp. React Native multiplies `fontSize` by the font scale automatically but leaves
   * `lineHeight` alone, so a hardcoded lineHeight becomes a clipping box the moment text grows.
   * Always spread this instead of writing `fontSize`/`lineHeight` literals:
   *   <Text style={[styles.label, type(14)]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
   */
  const type = (size: number, ratio = 1.4) => {
    const px = Math.round(size * uiScale * 10) / 10;
    return { fontSize: px, lineHeight: Math.round(px * ratio * grow) };
  };

  /**
   * Vertical sizing for anything containing text — rows, inputs, buttons, chips, badges.
   * Returns `minHeight`, never `height`, so the box grows with its content instead of cropping it.
   */
  const control = (base: number) => ({ minHeight: Math.round(base * uiScale * grow) });

  /**
   * Same, for a control that must also stay tappable. Note this floors at MIN_TOUCH AFTER
   * uiScale, so the Display-size clamp can never shrink a button below the 48dp guideline.
   */
  const tappable = (base: number) => ({ minHeight: Math.max(MIN_TOUCH, Math.round(base * uiScale * grow)) });

  /**
   * fontSize ONLY — for text whose style has no `lineHeight`. Use this rather than `type()`
   * there: `type()` always emits a lineHeight, and adding one where the design never had it
   * changes the vertical metrics. This scales the size and touches nothing else.
   */
  const textSize = (size: number) => ({ fontSize: Math.round(size * uiScale * 10) / 10 });

  /** Scale a spacing/size value by the same clamp. Never use this for a touch target. */
  const scale = (value: number) => Math.round(value * uiScale);

  /** A fixed circle/pill (badge, avatar) that must still fit its scaled label. */
  const circle = (base: number) => {
    const d = Math.round(base * grow);
    return { minWidth: d, height: d, borderRadius: d / 2 };
  };

  return {
    safeWidth, safeHeight, gutter, contentWidth, compact,
    fontScale, cappedFontScale: fs, maxFontSizeMultiplier: MAX_FONT_SCALE,
    uiScale, type, textSize, control, tappable, circle, scale, space, minTouch: MIN_TOUCH,
    stackActions: safeWidth < 360 || fontScale > 1.3,
    headerHeight: Math.max(60, 24 * fontScale + 24),
    navHeight: Math.max(72, 42 + 16 * fontScale),
    navClearance: Math.max(72, 42 + 16 * fontScale) + 32 + insets.bottom,
    modalMaxHeight: Math.max(0, safeHeight - 24),
    illustrationHeight: Math.max(80, Math.min(240, contentWidth * 0.65, safeHeight * 0.3)),
    splashWidth: Math.max(0, Math.min(300, safeWidth - gutter * 2)),
    splashGlowSize: Math.min(450, Math.max(safeWidth, safeHeight)),
  };
}

export function fitPopover(x: number, y: number, width: number, height: number, boundsWidth: number, boundsHeight: number) {
  return { left: Math.max(8, Math.min(x, boundsWidth - width - 8)), top: Math.max(8, Math.min(y, boundsHeight - height - 8)) };
}
