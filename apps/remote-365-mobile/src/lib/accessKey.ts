/**
 * Live-format a Remote 365 ID while typing: digits only, grouped in threes
 * ("123 456 789"). Strip spaces (`replace(/\D/g, '')`) before sending to the
 * API — every backend route normalizes the key the same way.
 */
export function formatAccessKey(input: string, maxDigits = 10): string {
  const digits = input.replace(/\D/g, '').slice(0, maxDigits);
  return digits.replace(/(\d{3})(?=\d)/g, '$1 ');
}
