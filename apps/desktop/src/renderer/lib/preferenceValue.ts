// Preference values that double as <select> option values were sentence case
// ("Outgoing only", "Optimize speed") before the UI moved to Title Case. Read
// them back case-insensitively so an existing install keeps its saved choice
// instead of silently falling back to the first option.
export const readPreferenceChoice = (
  key: string,
  options: readonly string[],
  fallback: string
): string => {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(key);
  } catch {
    return fallback;
  }
  if (!saved) return fallback;
  const match = options.find((option) => option.toLowerCase() === saved!.toLowerCase());
  return match || fallback;
};
