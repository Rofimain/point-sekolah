# Known issues / tech debt (pre-launch hardening)

## npm audit — 8 moderate (accepted for now)

`npm audit` reports moderate advisories in the **production** dependency chain:

- **exceljs** → **uuid** ([GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq))
- **next** → nested **postcss** ([GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93))
- **next-auth** → next + uuid (same as above)
- **prisma** → **@prisma/dev** → **@hono/node-server** ([GHSA-92pp-h63x-v22m](https://github.com/advisories/GHSA-92pp-h63x-v22m))

Fixes currently require **major version bumps / force downgrades** (`npm audit fix --force`). Deferred until a planned upgrade pass with full regression testing.

## CSP — `unsafe-inline` / `unsafe-eval` (accepted tech debt)

Content-Security-Policy in `next.config.js` allows `style-src 'unsafe-inline'` and `script-src 'unsafe-inline' 'unsafe-eval'` for Next.js App Router + TipTap. Not a go-live blocker; follow-up: nonce-based CSP when TipTap/Next allow it cleanly.
