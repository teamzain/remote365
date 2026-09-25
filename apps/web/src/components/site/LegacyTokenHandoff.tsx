'use client'

import { useEffect } from 'react'

// Older sign-in redirects land on a page with ?accessToken=&refreshToken=.
// Only the app knows how to store a session, so hand those links to the
// dashboard (a full load into the app), which completes the sign-in there.
export default function LegacyTokenHandoff() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('accessToken') && params.get('refreshToken')) {
      window.location.replace(`/dashboard${window.location.search}`)
    }
  }, [])
  return null
}
