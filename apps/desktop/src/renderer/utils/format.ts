// Small formatting / account helpers (extracted from App.tsx, behaviour unchanged).

/** Groups a numeric id/access-key into space-separated triplets, e.g. "195989442" -> "195 989 442". */
export const formatCode = (val: string) => {
  if (!val) return '';
  const clean = val.replace(/\D/g, '');
  const match = clean.match(/.{1,3}/g);
  return match ? match.join(' ') : clean;
};

/** Stable per-account storage key (email, falling back to id). */
export const getRecentAccountKey = (user?: any) => user?.email || user?.id || null;
