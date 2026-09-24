// Cloudflare global TURN (anycast) credential cache.
//
// A single London coturn forces far-away users to relay through the UK — the
// #1 latency cause for non-P2P sessions. Cloudflare's TURN is anycast, so every
// user reaches a *nearby* relay. Enabled only when CLOUDFLARE_TURN_KEY_ID +
// CLOUDFLARE_TURN_API_TOKEN are set; otherwise callers get null and behaviour
// is unchanged.
//
// Credentials are cached process-wide (they are shareable: Cloudflare issues a
// TTL-bound username/credential pair, not per-user grants), so the credential
// HTTPS round-trip is paid at most once per CACHE_FRESH_MS instead of on every
// session start. `peek` exposes the cache synchronously for hot paths that
// cannot await (the signaling join/joined replies); pair it with
// `startCloudflareTurnRefresh` so the cache is warm before the first join.

type IceServerEntry = {
  urls: string | string[];
  username?: string;
  credential?: string;
  credentialType?: string;
};

type WarnLogger = { warn: (msg: string) => void };

const CACHE_FRESH_MS = 5 * 60 * 1000;

let cache: { entry: IceServerEntry; fetchedAt: number; ttlSeconds: number } | null = null;
let inflight: Promise<IceServerEntry | null> | null = null;
let refreshTimer: NodeJS.Timeout | null = null;

export function cloudflareTurnConfigured(): boolean {
  return Boolean(process.env.CLOUDFLARE_TURN_KEY_ID && process.env.CLOUDFLARE_TURN_API_TOKEN);
}

// A credential is reusable until its TTL runs out; stop handing it to NEW
// sessions at 80% so nobody receives one about to expire mid-ICE.
function staleButValid(now: number): IceServerEntry | null {
  if (cache && now - cache.fetchedAt < cache.ttlSeconds * 800) return cache.entry;
  return null;
}

async function fetchEntry(log?: WarnLogger): Promise<IceServerEntry | null> {
  const cfKeyId = process.env.CLOUDFLARE_TURN_KEY_ID;
  const cfApiToken = process.env.CLOUDFLARE_TURN_API_TOKEN;
  if (!cfKeyId || !cfApiToken) return null;
  const ttlSeconds = Math.max(300, Math.min(Number(process.env.TURN_TTL_SECONDS || 3600), 86400));
  try {
    // Hard timeout: a hanging Cloudflare response must never stall a caller
    // sitting on the session-start path. Callers fall back to the coturn
    // entries already in their list.
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 2500);
    let resp: Response;
    try {
      resp = await fetch(
        `https://rtc.live.cloudflare.com/v1/turn/keys/${cfKeyId}/credentials/generate`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${cfApiToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ttl: ttlSeconds }),
          signal: abort.signal
        }
      );
    } finally {
      clearTimeout(timer);
    }
    if (!resp.ok) {
      log?.warn(`[ICE] Cloudflare TURN generate failed: HTTP ${resp.status}`);
      return null;
    }
    // Cloudflare returns { iceServers: { urls: string[], username, credential } }
    const data: any = await resp.json();
    const cf = data?.iceServers;
    if (!cf?.urls) return null;
    const entry: IceServerEntry = {
      urls: cf.urls,
      username: cf.username,
      credential: cf.credential,
      credentialType: 'password'
    };
    cache = { entry, fetchedAt: Date.now(), ttlSeconds };
    return entry;
  } catch (err: any) {
    log?.warn(`[ICE] Cloudflare TURN error: ${err?.message || err}`);
    return null;
  }
}

// Cached credential, fetching (deduplicated) when the cache is cold or stale.
// Returns null when unconfigured or when Cloudflare is unreachable and no
// still-valid cached credential exists.
export async function getCloudflareTurnEntry(log?: WarnLogger): Promise<IceServerEntry | null> {
  if (!cloudflareTurnConfigured()) return null;
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_FRESH_MS) return cache.entry;
  if (!inflight) {
    inflight = fetchEntry(log).finally(() => { inflight = null; });
  }
  const fresh = await inflight;
  return fresh ?? staleButValid(now);
}

// Synchronous view of the cache for paths that cannot await. Returns null when
// the cache is cold — call startCloudflareTurnRefresh() at process start so it
// rarely is.
export function peekCloudflareTurnEntry(): IceServerEntry | null {
  return staleButValid(Date.now());
}

// Keep the cache warm with a background refresh. Idempotent; no-op when
// unconfigured. The timer is unref'd so it never holds the process open.
export function startCloudflareTurnRefresh(log?: WarnLogger): void {
  if (!cloudflareTurnConfigured() || refreshTimer) return;
  const kick = () => { getCloudflareTurnEntry(log).catch(() => {}); };
  kick();
  refreshTimer = setInterval(kick, CACHE_FRESH_MS - 30_000);
  refreshTimer.unref?.();
}
