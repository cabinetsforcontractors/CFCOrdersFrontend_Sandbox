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

## Current State (2026-04-04)

**Lane A — Shippo End-to-End: COMPLETE ✅**
- <70 lbs → Shippo; 70+ lbs → R+L LTL
- Long item detection: single number ≥84 in name → LONG_PARCEL (98×9×6)
- X-separated dimensions → forced LTL

**Lane B — Payment Automation Triggers: COMPLETE ✅**
- Trigger 1: B2BWave webhook → email invoice + PDF to customer ✅
- Trigger 2: Square payment → auto-create BOL for LTL warehouses ✅
- Trigger 3: Square periodic sync → order status ✅
- Trigger 4: Square payment → confirmation email ✅

**Invoice/Checkout: COMPLETE ✅**
- QB-style HTML invoice with line items, tariff (8%), shipping, grand total
- PDF invoice attached to payment email
- Policy agreement popup before Pay Now
- Internal order notification to CFC on new order
- Checkout UI shows tariff + shipping breakdown

**Deferred (minor):**
- Ship-to address missing from email template — formatting cleanup needed
- Email template minor formatting polish

**Phase 7 production promotion:** DEFERRED — sandbox validation still in progress.

---

## Future Scope (post-production)

### Phase 8 — Supplier Email / CSV Upload
- Cross-ref website SKUs with supplier SKUs using William's mapping file
- `96` in product description = long trim indicator for UPS routing
- Auto-email supplier on payment with order details
- Future: CSV upload to supplier website (deferred — needs investigation)

### Phase 9 — Customer Order Portal (in-house first)
- Customer-facing order status page
- Show: order progress, tracking number, estimated delivery, BOL
- Light auth: last 4 phone + shipping ZIP
- Future: browser extension version
- Future: mobile app version

### Phase 10 — Warehouse Portal
- Warehouse login: last 4 phone + warehouse ZIP
- View orders, download BOL PDF, schedule R+L pickup, cancel pickup
- CFC notification when warehouse schedules pickup

---

## Component Map

| File | Version | Status |
|------|---------|--------|
| `src/App.jsx` | v7.2.3 | ✅ Pushed — sha ce6f739 |
| `src/config.js` | v5.11.0 | Sandbox URL hardcoded — correct for sandbox |
| `src/api.js` | v1.1.0 | ✅ CFC2026 token |
| `src/components/OrderCard.jsx` | v5.12.1 | ✅ Uses apiFetch |
| `src/components/StatusBar.jsx` | v5.9.2 | ⚠️ Sync AI uses raw fetch() |

---

## Known Issues / Deferred

- Ship-to address not in invoice email template — deferred
- StatusBar.jsx Sync AI uses raw fetch() — deferred
- `APP_PASSWORD` dead code in config.js — safe to delete, deferred
- LI warehouse: name/address correction pending (Cabinetry Distribution, 561 Keuka Rd) — deferred
- Email template formatting polish — deferred
- `body.json` in repo root — junk file, safe to delete

---

## Auth Token
All write endpoints require `X-Admin-Token: CFC2026`.
`src/api.js` injects this via `apiFetch()`.

---

## Backend Env Vars (sandbox Render)
- `ADMIN_API_KEY=CFC2026` ✅
- `GMAIL_SEND_ENABLED=true` ✅
- `GMAIL_REFRESH_TOKEN` ✅ regenerated 2026-04-04
- `SHIPPO_API_KEY` ✅
- `RL_CARRIERS_API_KEY` ✅
- `SQUARE_ACCESS_TOKEN` / `SQUARE_LOCATION_ID` ✅ (sandbox mode)
- `SQUARE_ENVIRONMENT` — NOT set, defaults to sandbox ✅
