# CFCOrdersFrontend_Sandbox — README

⛔ THIS IS THE SANDBOX REPO — NOT PRODUCTION
- Sandbox frontend: https://cfcordersfrontend-sandbox.vercel.app
- Sandbox backend: https://cfcorderbackend-sandbox.onrender.com
- Production frontend (separate, leave alone): https://cfc-orders-frontend.vercel.app
- Production backend (separate, leave alone): https://cfc-backend-b83s.onrender.com

Production promotion is deferred. All active work is sandbox-only.

---

## ⛔ Session Rules — ALL Claude Sessions
- READ this README before doing any work in this repo
- DO NOT write or rewrite any file unless William explicitly says to in that session
- Report only and stop unless William says otherwise

---

## Current State (2026-04-03)

**Active sandbox work:**
- Lane A (P1): Test full Shippo checkout flow end-to-end for a <70 lb order
- Lane B (P1): Verify each payment automation trigger fires in sandbox with a test order

**Phase 7 production promotion:** DEFERRED — sandbox lanes not complete yet.

---

## Component Map

| File | Version | Status |
|------|---------|--------|
| `src/App.jsx` | v5.10.0 (repo) / v5.10.5 (local) | Local ahead — push before any sandbox testing |
| `src/config.js` | v5.11.0 | Sandbox URL hardcoded — correct for sandbox use |
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

No Vite env vars configured. All config is hardcoded in `src/config.js`.

| Constant | Current Value | Notes |
|----------|--------------|-------|
| `API_URL` | `https://cfcorderbackend-sandbox.onrender.com` | Correct for sandbox |
| `IS_SANDBOX` | `true` | Correct for sandbox |
| `APP_PASSWORD` | `'cfc2025'` | Dead code — not imported anywhere, safe to delete |

---

## Known Issues

### FIX 1 — Push local App.jsx v5.10.5
Local is ahead of repo (v5.10.5 vs v5.10.0). Push before sandbox testing to ensure Vercel sandbox deploys correct version.

### FIX 2 — StatusBar.jsx Sync AI uses raw fetch()
`src/components/StatusBar.jsx` `handleSyncAI()` calls `fetch()` directly without `apiFetch()`.
If `/orders/regenerate-summaries` is admin-protected, this will 401.
Fix: replace `fetch(...)` with `apiFetch(...)` and add the import.

### FIX 3 — CLEANUP: Delete dead code from config.js
`APP_PASSWORD = 'cfc2025'` is exported but never imported by any component. Safe to delete.

### FIX 4 — FUTURE: Convert API_URL to Vite env var
Replace hardcoded `API_URL` with `import.meta.env.VITE_API_URL` and set per deployment in Vercel dashboard.
Not required now — deferred.

---

## Auth Token

All write endpoints require `X-Admin-Token: CFC2026`.
`src/api.js` injects this on every request via `apiFetch()`.

---

## Backend Issues (tracked in cfc-orders)

| Issue | File | Status |
|-------|------|--------|
| auth.py defaults to CFC2025 if ADMIN_API_KEY env var missing | `auth.py` | Render env var must be set on sandbox service |
| square_sync.py hardcodes production Square URL | `square_sync.py` | Needs code fix — deferred |

---

## Junk Files to Delete (future cleanup)

- `body.json` in repo root — curl test artifact accidentally committed
