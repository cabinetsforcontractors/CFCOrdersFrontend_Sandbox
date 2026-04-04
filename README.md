# CFCOrdersFrontend_Sandbox — README

⛔ THIS IS THE SANDBOX REPO — NOT PRODUCTION
- Sandbox frontend: https://cfcordersfrontend-sandbox.vercel.app
- Sandbox backend: https://cfcorderbackend-sandbox.onrender.com
- Production frontend (separate, leave alone): https://cfc-orders-frontend.vercel.app
- Production backend (separate, leave alone): https://cfc-backend-b83s.onrender.com

---

## ⛔ Session Rules — ALL Claude Sessions
- READ this README before doing any work in this repo
- DO NOT write or rewrite any file unless William explicitly says to in that session
- Report only and stop unless William says otherwise

---

## PRIORITY ORDER

1. Complete sandbox UI wiring (in progress — see below)
2. Promote to production (Phase 7)
3. Phase 8 — Shipment Tracking & Notification Engine (TOP PRIORITY after promotion)
4. Phase 9 — Full Customer Portal
5. Phase 10 — Full Warehouse Portal
6. Phase 11 — SMS
7. Phase 12 — Mobile App

---

## Current State (2026-04-04)

**Lane A — Shippo End-to-End: COMPLETE ✅**
**Lane B — Payment Automation Triggers: COMPLETE ✅**
**Invoice / Checkout: COMPLETE ✅**
**Frontend UI: PARTIAL — wiring in progress**

### Sandbox UI — Still Needed Before Production Promotion
- Notes add/edit inline in detail panel
- Customer comments (B2BWave field) in detail panel
- ShipmentRow inline in table rows
- Profit tracking per order
- AI Summary snippet on Details tab
- Alert background + label on table rows
- Light theme CSS (match production)
- Manual shipping override in ShippingManager
- Shippo ZIP auto-fill fix (warehouse name key mismatch)
- Fix StatusBar Sync AI to use apiFetch
- Ship-to address in invoice email template
- Email template formatting polish

### Deferred Minor Fixes
- LI warehouse: name = Cabinetry Distribution, address = 561 Keuka Rd, Interlachen FL 32148, phone = (615) 410-6775

---

## Phase 8 — Shipment Tracking & Notification Engine (TOP PRIORITY)

Phase 8 absorbs what were originally Phase 8 (supplier email), Phase 9 (customer portal foundation), and Phase 10 (warehouse portal foundation). It must be built before Phases 9 and 10 can proceed.

### Warehouse Shipping Rules
- **LI** — always ships, any length. Gmail scan for tracking/PRO.
- **LM (Love-Milestone)** — always ships, any length. Gmail scan for tracking/PRO.
- **DL** — ships only if long pallet (≥96"). CFC arranges R+L for all other DL items. Gmail scan for DL-shipped items.
- **All others** — CFC always arranges R+L. Supplier palletizes and gets it out. CFC pulls PRO from R+L.

### Two Tracks
**Track A (LI, LM, DL long pallet):** Warehouse ships. Gmail scan day 2. Warehouse response form if no Gmail hit. Warehouse provides tracking/PRO. R+L polling to verify.

**Track B (all others + DL short):** CFC arranges R+L. Warehouse palletizes only. Supplier form asks "is it ready for pickup?" CFC pulls PRO from R+L. Supplier never sees PRO.

### Supplier "Has It Shipped" Flow (both tracks, day 2)
Both tracks get a supplier check email on day 2 regardless. Track A asks for tracking. Track B asks if it's ready for pickup. If no response in 24 hours → email William.

### Pick List PDF — Two Versions
Both generated via reportlab same pattern as invoice_pdf.py.

Customer version: full header, customer info, line items, policy text, pick sheet link, claim language. Sent morning of delivery.

Warehouse version: CFC header only, order #, warehouse name, line items, internal notes. No customer info. Sent at payment confirmation.

### Interactive Mobile Pick Sheet
`/picksheet/{order_id}?token={token}` — mobile-first page. Line items checkboxes. 4 required photos (pallet before unloading, all boxes laid out, any damage, signed BOL). Submit fires silent Gmail with photos to dedicated account. Missing items fire immediate William alert.

### Delivery Day Email
Stop #X of Y. Claims require completed pick sheet + 4 photos. Check all SKUs present before driver leaves. Do not sign BOL without noting visible damage in writing on the BOL. Damage → replacement form at cabinetsforcontractors.net/pages/5-replacement-request. Policy reminder.

### Post-Delivery Email
R+L confirmed delivered. Damage must be reported within 48 hours. No returns on assembled/installed cabinets. Replacement form link.

### Email Templates (Phase 8)
1. Warehouse — pick list + payment notification (warehouse PDF attached)
2. Warehouse — Track A: "Has it shipped?"
3. Warehouse — Track B: "Is it palletized and ready?"
4. Warehouse — R+L no record, confirm again
5. Customer — order has shipped (PRO + ETA)
6. Customer — delivery tomorrow
7. Customer — delivery day (stop #, pick sheet link, photo + BOL language, SKU checklist)
8. Customer — delivered
9. William — escalation

### Backend Components (Phase 8)
- Shipment state machine (per-shipment state column/table)
- R+L polling job (every 4 business hours)
- Gmail scan tied to state machine (LI, LM, DL-shipped only)
- Warehouse form endpoint
- Pick sheet endpoint + photo upload → silent Gmail to dedicated account
- `picklist_pdf.py` — two-version generator
- Email scheduler

### Frontend Components (Phase 8)
- ShipmentRow: track state display, escalation badge, supplier clock indicator
- Mobile pick sheet page

---

## Phase 9 — Full Customer Portal (after Phase 8)

Builds on Phase 8 foundation.
- Customer order status page (light auth: last 4 phone + ZIP)
- Order progress, all shipments, tracking, ETA, BOL link
- Future: browser extension → mobile app (Phase 12)

---

## Phase 10 — Full Warehouse Portal (after Phase 8)

Builds on Phase 8 foundation.
- Full warehouse login (last 4 phone + warehouse ZIP)
- View all open orders, download BOL, schedule R+L pickup
- CFC notification when pickup scheduled

---

## Phase 11 — SMS (after Phase 8)

Slots into every Phase 8 notification point: payment confirmed, shipped, delivery tomorrow, delivery today (stop #), delivered.

---

## Phase 12 — Mobile App (after Phase 9)

Customer-specific native app version of Phase 9 portal.

---

## Component Map

| File | Version | Status |
|------|---------|--------|
| `src/App.jsx` | v7.2.4 | ✅ sha 72b0251e |
| `src/config.js` | v5.11.0 | ✅ Sandbox URL hardcoded |
| `src/api.js` | v1.1.0 | ✅ CFC2026 token |
| `src/components/ShippingManager.jsx` | v5.9.5 | ✅ Shippo added |
| `src/components/OrderCard.jsx` | v5.12.1 | In repo, not used in current App |
| `src/components/ShipmentRow.jsx` | v5.9.3 | In repo, needs apiFetch + Shippo |
| `src/components/OrderComments.jsx` | v1.0.3 | In repo, not yet wired |
| `src/components/StatusBar.jsx` | v5.9.2 | In repo, not used in current App |
| `src/components/EmailPanel.jsx` | v1.0.0 | ✅ Wired |

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
- `SQUARE_ACCESS_TOKEN` / `SQUARE_LOCATION_ID` ✅ sandbox mode
- `SQUARE_ENVIRONMENT` — NOT set, defaults to sandbox ✅
