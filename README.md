# RemoteLink-Desktop

## Desktop release flow (local only)

This repository supports a local-only desktop release flow (no CI/CD required).

### Prerequisites

- Node.js + npm
- GitHub CLI (`gh`) authenticated with release upload permissions
- Git remote `origin` set to the GitHub repository

### Run a release

```bash
npm run release:desktop
```

Optional flags:

```bash
node scripts/release-desktop.mjs --version 1.2.3 --notes "Bug fixes and stability"
node scripts/release-desktop.mjs --dry-run
```

### What it does

1. Builds and packages desktop artifacts via `npm run build -w connect-x`
2. Creates or updates GitHub release tag `v<version>`
3. Uploads all assets from `apps/desktop/release`
4. Updates `downloads/releases.json` manifest used by `downloads/index.html`

### Public download page

Standalone page: `downloads/index.html`  
Manifest source: `downloads/releases.json`

Host these two files on your static server (for example under `/downloads/`) and the page will render all release entries dynamically.