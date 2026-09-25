// localStorage keys for the signed-in session. Shared by the app's auth store
// and API client and by the website, which only needs to know whether someone
// is signed in (it never reads the tokens themselves).
export const TOKEN_KEY = 'remotelink_access_token'
export const REFRESH_KEY = 'remotelink_refresh_token'
