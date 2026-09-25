import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Monorepo root: dependencies are hoisted there, so the standalone output has
// to trace files from it.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

// Retired pages → the closest live page. statusCode 301 (Next's `permanent`
// sends 308, which some crawlers treat less reliably for consolidation).
const RETIRED_PAGES = [
  ['/features', '/product'],
  ['/solutions', '/product'],
  ['/resources', '/docs'],
  ['/enterprise', '/pricing'],
  ['/customers', '/'],
]

// Local previews of a production build (`next build && next start`) have no
// backend: on the servers Caddy routes /api to the API services before a
// request ever reaches Next, and builds use the same origin for the API. Set
// API_PROXY_ORIGIN (e.g. https://pp.remote365.ai) when building locally to
// forward /api there instead, so sign-in, Google/Microsoft sign-in and the
// dashboard work on localhost. CI never sets it, so deployed builds have no
// such rewrite.
const API_PROXY_ORIGIN = process.env.API_PROXY_ORIGIN?.replace(/\/+$/, '')

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: root,
  turbopack: { root },
  reactStrictMode: true,
  poweredByHeader: false,
  // Caddy compresses responses; don't do the work twice on the server.
  compress: false,
  async rewrites() {
    return API_PROXY_ORIGIN ? [{ source: '/api/:path*', destination: `${API_PROXY_ORIGIN}/api/:path*` }] : []
  },
  async redirects() {
    return RETIRED_PAGES.flatMap(([source, destination]) => [
      { source, destination, statusCode: 301 },
      { source: `${source}/:path*`, destination, statusCode: 301 },
    ])
  },
  async headers() {
    return [
      {
        // Media and font file names carry a version (hero-video.v1.mp4,
        // mona-sans-latin.v4.woff2), so they can be cached for good.
        source: '/media/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/fonts/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ]
  },
}

export default nextConfig
