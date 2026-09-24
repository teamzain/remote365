// Text size for the whole web console (Settings → General → Text size). The
// page is zoomed as one, so text, spacing and controls grow together; the
// choice lives in this browser only.
//
// CSS zoom shrinks the layout viewport without moving the media-query
// breakpoints, so on a narrow window the factor is capped to keep at least
// ~390 CSS px of width — phones effectively stay at Default (they have the
// browser's own zoom), tablets get part of the increase, desktops all of it.
export const TEXT_SIZE_KEY = 'remote365_web_font_scale';
export const TEXT_SIZE_OPTIONS = [
  { value: '1', label: 'Default' },
  { value: '1.15', label: 'Large' },
  { value: '1.3', label: 'Larger' },
  { value: '1.5', label: 'Largest' },
];
const MIN_LAYOUT_WIDTH = 390;

export const readTextScale = (): string => {
  try {
    const stored = localStorage.getItem(TEXT_SIZE_KEY) || '1';
    return TEXT_SIZE_OPTIONS.some((option) => option.value === stored) ? stored : '1';
  } catch {
    return '1';
  }
};

const effectiveScale = (value: string) => {
  const wanted = Number(value) || 1;
  const width = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const cap = Math.max(1, width / MIN_LAYOUT_WIDTH);
  return Math.min(wanted, cap);
};

export const applyTextScale = (value: string) => {
  try {
    const scale = effectiveScale(value);
    (document.documentElement.style as any).zoom = scale > 1.001 ? String(Math.round(scale * 100) / 100) : '';
  } catch {
    /* not in a document */
  }
};

export const setTextScale = (value: string) => {
  const next = TEXT_SIZE_OPTIONS.some((option) => option.value === value) ? value : '1';
  try { localStorage.setItem(TEXT_SIZE_KEY, next); } catch { /* storage unavailable */ }
  applyTextScale(next);
  return next;
};

/** Apply the stored size now and keep it correct as the window is resized. */
export const installTextScale = () => {
  applyTextScale(readTextScale());
  if (typeof window === 'undefined') return;
  let timer: ReturnType<typeof setTimeout> | null = null;
  window.addEventListener('resize', () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => applyTextScale(readTextScale()), 120);
  });
};
