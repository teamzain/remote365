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
  {
    // The website is server-rendered and should stay light: no app UI kit,
    // router or stores (those belong to the client-side app under (app)).
    files: ['src/app/(site)/**', 'src/app/not-found.tsx', 'src/components/landing/**', 'src/components/site/**'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@mui/*', '@emotion/*'], message: 'Site pages use plain elements and CSS, not MUI.' },
          { group: ['react-router', 'react-router-dom'], message: 'Use SiteLink / next/navigation on site pages.' },
          { group: ['**/store/*', '@/store/*'], message: 'Site pages must not load the app stores (use lib/useSignedIn).' },
          { group: ['lottie-react'], message: 'Too heavy for site pages.' },
        ],
      }],
    },
  },
  globalIgnores(['.next/**', 'next-env.d.ts']),
])
