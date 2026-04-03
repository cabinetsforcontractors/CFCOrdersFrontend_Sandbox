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

**Lane A — Shippo end-to-end: COMPLETE ✅**
- Checkout routing: <70 lbs → Shippo, 70+ lbs → R+L LTL
- Long item detection: single number ≥84 in name → LONG_PARCEL box (98×9×6)
- X-separated dimensions (e.g. 24WX84HX3D) → forced LTL
- 96" trim tested on order 5518: parcel_length=96, USPS $101.66 ✅

**Lane B — Payment automation triggers: IN PROGRESS**
- Trigger 1 ✅ BUILT: B2BWave webhook → generates token → emails payment_link to customer
- Trigger 2 ✅ BUILT: Square payment received → auto-creates BOL for LTL warehouses
- Trigger 3 ✅ DONE: periodic Square sync (existing, sufficient)
- Trigger 4 ✅ BUILT: Square payment received → sends payment_confirmation email

**Trigger 1 blocker: Gmail OAuth refresh token expired on sandbox Render**
- `GMAIL_REFRESH_TOKEN` needs to be regenerated
- Steps: https://developers.google.com/oauthplayground → use own credentials → authorize `https://mail.google.com/` with cabinetsforcontractors@gmail.com → exchange code → copy refresh_token → update Render env var → manual deploy
- Once done: retest with `POST /webhook/b2bwave-order` using order 5518

**Phase 7 production promotion:** DEFERRED — sandbox lanes not complete yet.

---

## Component Map

| File | Version | Status |
|------|---------|--------|
| `src/App.jsx` | v7.2.3 | ✅ Pushed — sha ce6f739 |
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

### FIX 1 — StatusBar.jsx Sync AI uses raw fetch()
`src/components/StatusBar.jsx` `handleSyncAI()` calls `fetch()` directly without `apiFetch()`.
Fix: replace `fetch(...)` with `apiFetch(...)` and add the import.

### FIX 2 — CLEANUP: Delete dead code from config.js
`APP_PASSWORD = 'cfc2025'` is exported but never imported. Safe to delete.

### FIX 3 — FUTURE: Convert API_URL to Vite env var
Deferred — not required for sandbox work.

---

## Auth Token

All write endpoints require `X-Admin-Token: CFC2026`.
`src/api.js` injects this on every request via `apiFetch()`.

---

## Backend Issues (tracked in cfc-orders)

| Issue | File | Status |
|-------|------|--------|
| Gmail refresh token expired on sandbox Render | `gmail_sync.py` | Regenerate via OAuth Playground — see Current State above |
| auth.py defaults to CFC2025 if ADMIN_API_KEY env var missing | `auth.py` | ✅ Fixed — CFC2026 set on sandbox Render |
| square_sync.py hardcodes production Square URL | `square_sync.py` | Deferred |

---

## Junk Files to Delete (future cleanup)

- `body.json` in repo root — curl test artifact accidentally committed
