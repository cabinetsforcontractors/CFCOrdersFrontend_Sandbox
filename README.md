# CFCOrdersFrontend_Sandbox — README
**Version in repo:** v5.10.0 (App.jsx) — local is v5.10.5, NOT YET PUSHED
**Deployed at:** https://cfcordersfrontend-sandbox.vercel.app
**Production frontend:** https://cfc-orders-frontend.vercel.app (points to old repo, pending Phase 7 Step 3)
**Backend (sandbox):** https://cfcorderbackend-sandbox.onrender.com
**Backend (production):** https://cfc-backend-b83s.onrender.com

## ⛔ Session Rules — ALL Claude Sessions
- READ this README before doing any work in this repo
- DO NOT write or rewrite any file unless William explicitly says to in that session
- Report only and stop unless William says otherwise

---

## READ THIS BEFORE ANY TASK

Phase 7 Step 3 (Vercel repoint to this repo) has NOT happened yet.
Before any session touches this repo, confirm the current Phase 7 step in:
- `brain:workstreams/WS6_CFC_ORDERS.md`
- `cfc-orders:handoffs/SESSION_HANDOFF_ORDERS.md`

---

## Component Map

| File | Version | Status |
|------|---------|--------|
| `src/App.jsx` | v5.10.0 (repo) / v5.10.5 (local) | Local ahead — push before Phase 7 Step 3 |
| `src/config.js` | v5.11.0 | Hardcoded sandbox URL — must flip before Phase 7 Step 3 |
| `src/api.js` | v1.1.0 | ✅ CFC2026 token, correct |
| `src/components/OrderCard.jsx` | v5.12.1 | ✅ Uses apiFetch throughout |
| `src/components/StatusBar.jsx` | v5.9.2 | ⚠️ Sync AI button uses raw fetch() — not apiFetch |
| `src/components/ShippingManager.jsx` | — | Present |
| `src/components/EmailPanel.jsx` | — | Present |
| `src/components/BrainChat.jsx` | — | Present |
| `src/components/AiConfigPanel.jsx` | — | Present |
| `src/components/RLQuoteHelper.jsx` | — | Present |
| `src/components/ShipmentRow.jsx` | — | Present |
| `src/components/OrderComments.jsx` | — | Present |
| `src/components/CustomerAddress.jsx` | — | Present |

---

## Environment Variables

This frontend has NO Vite env vars configured. All config is hardcoded in `src/config.js`.

| Constant | Current Value | Correct for Production |
|----------|--------------|----------------------|
| `API_URL` | `https://cfcorderbackend-sandbox.onrender.com` | `https://cfc-backend-b83s.onrender.com` |
| `IS_SANDBOX` | `true` | `false` |
| `APP_PASSWORD` | `'cfc2025'` | Dead code — not imported anywhere, safe to delete |

No Vercel environment variables are in use. `config.js` must be edited and pushed for any URL changes.

---

## Known Issues — Required Fixes Before Phase 7 Step 3

### FIX 1 — REQUIRED: Push local App.jsx v5.10.5
Local is ahead of repo (v5.10.5 vs v5.10.0). Vercel deploys whatever is on `main`.
Push local App.jsx before repointing Vercel or the older version ships.

### FIX 2 — REQUIRED: Flip config.js for production
Two lines to change in `src/config.js`:
```js
// Change this:
export const API_URL = 'https://cfcorderbackend-sandbox.onrender.com'
export const IS_SANDBOX = true

// To this:
export const API_URL = 'https://cfc-backend-b83s.onrender.com'
export const IS_SANDBOX = false
```
Without this, the production frontend sends all API calls to the sandbox backend.

### FIX 3 — RECOMMENDED: StatusBar.jsx Sync AI uses raw fetch()
`src/components/StatusBar.jsx` `handleSyncAI()` calls `fetch()` directly without `apiFetch()`.
If `/orders/regenerate-summaries` is admin-protected, this will 401 in production.
Fix: replace `fetch(...)` with `apiFetch(...)` and add the import.

### FIX 4 — CLEANUP: Delete dead code from config.js
`APP_PASSWORD = 'cfc2025'` is exported but never imported by any component.
Safe to delete. Leftover from old login-screen pattern removed in Phase 5.

### FIX 5 — FUTURE: Convert API_URL to Vite env var
Long-term correct solution: replace hardcoded `API_URL` with `import.meta.env.VITE_API_URL`
and set the env var per deployment in Vercel dashboard. Eliminates code changes for future promotions.
Not required for Phase 7 — option 1 (code flip) is sufficient now.

---

## Phase 7 Step 3 Readiness Checklist

Before repointing Vercel production frontend to this repo:

- [ ] FIX 1: Local App.jsx v5.10.5 pushed to main
- [ ] FIX 2: config.js flipped (API_URL → prod, IS_SANDBOX=false) pushed to main
- [ ] Render backend (cfc-backend-b83s.onrender.com) confirmed live on sandbox code with ADMIN_API_KEY=CFC2026
- [ ] Render smoke test passed: GET /health → 200, v6.2.0
- [ ] SQUARE_ENVIRONMENT=production set on Render (see backend issue in SESSION_HANDOFF_ORDERS.md)

---

## Auth Token

All write endpoints require `X-Admin-Token: CFC2026`.
`src/api.js` injects this on every request via `apiFetch()`.
App.jsx v5.10.x also has a local `const ADMIN_TOKEN = 'CFC2026'` — verify it uses apiFetch, not raw fetch with this constant.

---

## Backend Issues (not in this repo — tracked in cfc-orders)

| Issue | File | Status |
|-------|------|--------|
| auth.py defaults to CFC2025 if ADMIN_API_KEY env var missing | `auth.py` | Render env var must be set |
| SQUARE_ENVIRONMENT defaults to "sandbox" | `config.py` / `checkout.py` | Set SQUARE_ENVIRONMENT=production on Render |
| square_sync.py hardcodes production Square URL regardless of env | `square_sync.py` | Needs code fix — sync and checkout talk to different Square envs |

---

## Junk Files to Delete (Step 6 cleanup)

- `body.json` in repo root — curl test artifact accidentally committed
