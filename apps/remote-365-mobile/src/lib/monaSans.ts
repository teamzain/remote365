/**
 * Mona Sans design font helpers.
 *
 * React Native 0.81 + React 19 make <Text> a plain function component (no
 * forwardRef `.render` to monkey-patch), so instead of patching the component
 * we inject the correct static weight (Regular / Medium / SemiBold) into the
 * style objects themselves before StyleSheet.create.
 *
 * Wrap every StyleSheet you want in Mona Sans:
 *     const styles = StyleSheet.create(monaFontStyles({ ... }));
 */
export function familyForWeight(weight?: string | number): string {
  let numeric = 400;
  if (typeof weight === 'number') {
    numeric = weight;
  } else if (typeof weight === 'string') {
    if (weight === 'bold') numeric = 700;
    else if (weight === 'normal') numeric = 400;
    else {
      const parsed = parseInt(weight, 10);
      if (!Number.isNaN(parsed)) numeric = parsed;
    }
  }
  if (numeric >= 600) return 'MonaSans-SemiBold';
  if (numeric >= 500) return 'MonaSans-Medium';
  return 'MonaSans-Regular';
}

// A style entry is "text" if it carries any text-only property.
function isTextStyle(style: Record<string, unknown>): boolean {
  return (
    style.fontSize != null ||
    style.fontWeight != null ||
    style.lineHeight != null ||
    style.textAlign != null ||
    style.letterSpacing != null ||
    style.textTransform != null
  );
}

/**
 * Mutates each text style in the given object to use the matching Mona Sans
 * family (unless it already declares a fontFamily), then returns it. Non-text
 * styles are left alone. Icon fonts are unaffected because they set their own
 * fontFamily at runtime, not through these styles.
 */
export function monaFontStyles<T extends Record<string, any>>(styles: T): T {
  for (const key of Object.keys(styles)) {
    const style = styles[key];
    if (style && typeof style === 'object' && !Array.isArray(style)) {
      if (style.fontFamily == null && isTextStyle(style)) {
        style.fontFamily = familyForWeight(style.fontWeight);
      }
    }
  }
  return styles;
}
