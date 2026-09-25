'use client'

import dynamic from 'next/dynamic'

// The whole React Router app, rendered in the browser only: it relies on
// window, localStorage, WebRTC and sockets throughout.
const SpaRoot = dynamic(() => import('@/spa/SpaRoot'), { ssr: false })

export function AppShell() {
  return <SpaRoot />
}
