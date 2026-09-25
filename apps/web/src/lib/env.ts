// Public build-time settings. Each value must be read as a literal
// `process.env.NEXT_PUBLIC_…` expression (no destructuring) so Next inlines it
// into the client bundle.
//
// Deployed builds leave these unset: the API, signaling socket and /downloads
// are served from the same origin as the site. Local development points them
// at a remote backend via .env.development.

/** API origin, e.g. https://pp.remote365.ai. Empty = same origin. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

/** Signaling WebSocket URL; undefined = derived from the API/server host. */
export const SIGNAL_URL: string | undefined = process.env.NEXT_PUBLIC_SIGNAL_URL || undefined

/** Overrides the server host used for socket URLs and deep links. */
export const SERVER_HOST = process.env.NEXT_PUBLIC_SERVER_HOST || ''

export const IS_DEV = process.env.NODE_ENV !== 'production'
