// Liveness probe for the container healthcheck and the deploy script. Built
// once at `next build`, so `sha` is the commit this server was built from
// (BUILD_SHA is set by scripts/build-web-release.sh): the deploy compares it
// with the release it just started before switching traffic over.
export const dynamic = 'force-static'

export function GET() {
  return Response.json(
    { ok: true, sha: process.env.BUILD_SHA || 'dev' },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
