/**
 * Matching + ranking for the header search bar.
 *
 * The old implementation was one line — `\`${label} ${detail}\`.includes(query)`
 * — over a list that had been `.slice(0, 8)`'d. That produced four distinct
 * ways for a search to "not find" something that plainly exists:
 *
 *  1. Only the first 8 devices were searchable AT ALL. On a fleet of 99 the
 *     other 91 could not be found by any query, which is what makes the bar
 *     feel like it demands an exact name — you are really just hunting for
 *     one of the lucky eight.
 *  2. IDs are rendered grouped ("123 456 789"), so a substring test against
 *     the displayed text failed for "123456789" — the way anyone actually
 *     types an ID.
 *  3. `includes` needs ONE contiguous run, so "voip 7" missed "PureVoip-7",
 *     and any word typed out of order missed everything.
 *  4. No ranking: whatever happened to match first won, so an exact device
 *     name could sit below an unrelated menu entry.
 *
 * This module fixes the matching itself. Scoring is deliberately simple and
 * predictable — exact, then prefix, then word-prefix, then substring, then
 * all-tokens-present — because a search bar that ranks unpredictably feels
 * broken even when it finds the right row.
 */

export type SearchCandidate = {
  id: string;
  label: string;
  detail?: string;
  /** Extra text to match on that is not displayed (IDs, aliases, hostnames). */
  keywords?: string;
  /** Devices/contacts should outrank generic menu entries on equal scores. */
  weight?: number;
};

/** Lowercase and strip punctuation so "PureVoip-7" and "purevoip 7" agree. */
export const normalizeText = (value: string): string =>
  String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Digits only, for connect IDs displayed as "123 456 789". */
export const digitsOnly = (value: string): string => String(value || '').replace(/\D/g, '');

/**
 * Score one candidate against a query. Returns 0 for "no match" so callers can
 * filter on truthiness. Higher is better.
 */
export function scoreCandidate(candidate: SearchCandidate, rawQuery: string): number {
  const query = normalizeText(rawQuery);
  if (!query) return 0;

  const label = normalizeText(candidate.label);
  const haystack = normalizeText(`${candidate.label} ${candidate.detail || ''} ${candidate.keywords || ''}`);
  const weight = candidate.weight || 0;

  // ID search: compare digits to digits so grouping/spacing never matters.
  const queryDigits = digitsOnly(rawQuery);
  if (queryDigits.length >= 3) {
    const candidateDigits = digitsOnly(`${candidate.detail || ''} ${candidate.keywords || ''}`);
    if (candidateDigits) {
      if (candidateDigits === queryDigits) return 1000 + weight;
      if (candidateDigits.startsWith(queryDigits)) return 900 + weight;
      if (candidateDigits.includes(queryDigits)) return 700 + weight;
    }
  }

  if (label === query) return 950 + weight;
  if (label.startsWith(query)) return 850 + weight;

  // Word-prefix: "voip" should hit "pure voip 7" on its second word.
  const labelWords = label.split(' ');
  if (labelWords.some((word) => word.startsWith(query))) return 800 + weight;

  if (label.includes(query)) return 650 + weight;
  if (haystack.includes(query)) return 550 + weight;

  // Every token present somewhere, in any order — this is what makes
  // "voip 7" and "7 voip" both find "PureVoip-7".
  const tokens = query.split(' ').filter(Boolean);
  if (tokens.length > 1 && tokens.every((token) => haystack.includes(token))) {
    return 500 + weight;
  }

  // Last resort: in-order subsequence over the label, so "pv7" finds
  // "purevoip 7" and abbreviations like "zn office" still land on
  // "Zain Office PC". Applies to multi-token queries too — restricting it to
  // single tokens meant any abbreviation with a space silently found nothing.
  // Scored lowest, so precise matches always rank above these.
  if (query.length >= 3) {
    const flatLabel = label.replace(/ /g, '');
    const flatQuery = query.replace(/ /g, '');
    let cursor = 0;
    for (const char of flatLabel) {
      if (char === flatQuery[cursor]) cursor++;
      if (cursor === flatQuery.length) return 300 + weight;
    }
  }

  return 0;
}

/** Filter + rank. Ties break on the candidate's original order (stable sort). */
export function searchCandidates<T extends SearchCandidate>(
  candidates: T[],
  rawQuery: string,
  limit = 12,
): T[] {
  if (!rawQuery.trim()) return candidates.slice(0, limit);
  return candidates
    .map((candidate, index) => ({ candidate, index, score: scoreCandidate(candidate, rawQuery) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => (b.score - a.score) || (a.index - b.index))
    .slice(0, limit)
    .map((entry) => entry.candidate);
}
