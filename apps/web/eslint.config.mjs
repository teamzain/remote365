import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Links between the Next site and the client-only app (dashboard,
      // session, meetings…) must be full page loads, so plain <a> is
      // intentional there. Site-to-site links go through SiteLink.
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
  globalIgnores(['.next/**', 'next-env.d.ts']),
])
