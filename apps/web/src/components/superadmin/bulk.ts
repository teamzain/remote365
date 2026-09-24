/**
 * Run one request per id for a bulk action and report what actually happened.
 *
 * `Promise.all` used to abandon the batch on the first rejection: the other
 * requests still completed server-side, the table never reloaded, and the
 * error named nothing. This settles every request and returns a message that
 * says how many failed (null when all succeeded), so callers can always
 * reload and still tell the admin the truth.
 */
export async function runBulk(
  ids: string[],
  request: (id: string) => Promise<unknown>,
  noun: string,
): Promise<string | null> {
  const results = await Promise.allSettled(ids.map((id) => request(id)));
  const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (!failed.length) return null;
  const reason: any = failed[0].reason;
  const detail = reason?.response?.data?.error || reason?.message || '';
  return `${failed.length} of ${ids.length} ${noun} failed${detail ? ` — ${detail}` : '.'}`;
}
