// First path segments owned by the client-side app (React Router, mounted by
// src/app/(app)/[...slug]). Everything else is a server-rendered site page or
// a 404. Crossing between the two is always a full page load: the site and
// the app are separate React trees.
export const APP_PREFIXES = [
  'dashboard',
  'admin',
  'session',
  'meeting',
  'join',
  'login',
  'register',
  'forgot-password',
  'reset-password',
  '2fa',
  'auth',
  'onboard',
] as const

/** True when `path` (a pathname or root-relative URL) belongs to the app. */
export function isAppPath(path: string): boolean {
  const pathname = path.split(/[?#]/, 1)[0]
  const first = pathname.split('/')[1] ?? ''
  return (APP_PREFIXES as readonly string[]).includes(first)
}
