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

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: root,
  turbopack: { root },
  reactStrictMode: true,
  poweredByHeader: false,
  // Caddy compresses responses; don't do the work twice on the server.
  compress: false,
  async redirects() {
    return RETIRED_PAGES.flatMap(([source, destination]) => [
      { source, destination, statusCode: 301 },
      { source: `${source}/:path*`, destination, statusCode: 301 },
    ])
  },
  async headers() {
    return [
      {
        // Media file names carry a version (hero-video.v1.mp4), so they can be
        // cached for good.
        source: '/media/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ]
  },
}

export default nextConfig
