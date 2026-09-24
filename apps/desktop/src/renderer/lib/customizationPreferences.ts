export type SearchBehavior = 'Search for result' | 'Direct connect';

export interface CustomizationPreferences {
  darkMode: boolean;
  searchBehavior: SearchBehavior;
  useNewInterface: boolean;
  marketingMessages: boolean;
  fontSize: number;
}

const clampFontSize = (value: unknown) => {
  const size = Number(value);
  if (!Number.isFinite(size)) return 16;
  return Math.min(24, Math.max(12, Math.round(size)));
};

export const readCustomizationPreferences = (): CustomizationPreferences => ({
  darkMode: localStorage.getItem('pref_dark_mode') === 'true',
  searchBehavior: localStorage.getItem('pref_search_behavior') === 'Direct connect'
    ? 'Direct connect'
    : 'Search for result',
  useNewInterface: localStorage.getItem('pref_use_new_interface') !== 'false',
  marketingMessages: localStorage.getItem('pref_marketing_messages') === 'true',
  fontSize: clampFontSize(localStorage.getItem('pref_font_size') ?? 16),
});

export const persistCustomizationPreferences = (preferences: Partial<CustomizationPreferences>) => {
  if (preferences.darkMode !== undefined) {
    localStorage.setItem('pref_dark_mode', String(preferences.darkMode));
    localStorage.setItem('pref_theme', preferences.darkMode ? 'Dark' : 'Light');
  }
  if (preferences.searchBehavior) {
    localStorage.setItem('pref_search_behavior', preferences.searchBehavior);
  }
  if (preferences.useNewInterface !== undefined) {
    localStorage.setItem('pref_use_new_interface', String(preferences.useNewInterface));
  }
  if (preferences.marketingMessages !== undefined) {
    localStorage.setItem('pref_marketing_messages', String(preferences.marketingMessages));
    localStorage.setItem('pref_marketing', String(preferences.marketingMessages));
  }
  if (preferences.fontSize !== undefined) {
    localStorage.setItem('pref_font_size', String(clampFontSize(preferences.fontSize)));
  }
};

export const applyCustomizationPreferences = (preferences: Partial<CustomizationPreferences>) => {
  persistCustomizationPreferences(preferences);

  if (preferences.darkMode !== undefined) {
    document.documentElement.classList.toggle('dark', preferences.darkMode);
  }

  if (preferences.fontSize !== undefined) {
    const fontSize = clampFontSize(preferences.fontSize);
    const scale = fontSize / 16;
    document.documentElement.style.setProperty('--base-font-size', `${fontSize}px`);
    document.documentElement.style.setProperty('--app-font-scale', String(scale));
    document.body.style.zoom = String(scale);
  }
};
