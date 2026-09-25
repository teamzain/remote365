'use client'

import { useSyncExternalStore } from 'react'
import { TOKEN_KEY } from './authKeys'

// Whether this browser holds a session, for the website's header and panels.
// The server (and the first client render, so hydration matches) always
// says "signed out"; the real value follows straight after mount, and stays
// in sync when another tab signs in or out.
function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange)
  return () => window.removeEventListener('storage', onChange)
}

function hasToken() {
  try {
    return Boolean(localStorage.getItem(TOKEN_KEY))
  } catch {
    return false
  }
}

export function useSignedIn(): boolean {
  return useSyncExternalStore(subscribe, hasToken, () => false)
}
