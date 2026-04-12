# Ads Dashboard — Changelog

All notable changes to the ads dashboard are documented here.
Format: date, what changed, why, what was affected.

---

## 2026-04-13 — Fix HBL leads not appearing in dashboard

**What:** Fixed Date() regex in `leads.js` and `sheets.js` that failed to parse Google Sheets datetime values with time components.

**Root cause:** HBL's leads tracker tab has `created_time` as a `datetime` column type. Google's gviz API returns these as `Date(2026,3,3,17,42,0)`, but the regex only matched `Date(year,month,day)` — it broke on the extra `,hour,min,sec` before the closing paren. All HBL leads were silently dropped.

**Why it only affected HBL:** Other client tabs use `string` type (ISO format like `2026-02-17T00:00:00+0000`) or `date` type (no time component). HBL was the only tab with `datetime`.

**Fix:** Changed regex from `/Date\((\d+),(\d+),(\d+)\)/` to `/Date\((\d+),(\d+),(\d+)(?:,\d+)*\)/` — handles both date-only and datetime formats.

**Files changed:**
- `src/lib/leads.js` — date parsing in `fetchLeadsSheet()`
- `src/lib/sheets.js` — date parsing in `parseSheetResponse()`

**Also fixed:** n8n HBL workflows (Ads Performance 3-Day Tracker, Lead Drought Detector, Zero Leads Alert) had placeholder ad account IDs (`FB_AD_ACCOUNT_PLACEHOLDER`) — replaced with `act_1456930729494105`.

**Verified:** Regex tested against all 6 client tabs — no regressions. Static Shift (date type), Fusion/Eddie/Corbel/Stirling (string type) all unaffected.

---

## 2026-04-02 — Add Google Date object conversion to leads.js

**What:** Added `Date()` string conversion in `fetchLeadsSheet()` to handle Google's internal date representation.

**Note:** This commit introduced the regex that broke HBL (didn't account for time components). Fixed 2026-04-13.

---

## 2026-03-24 — Major dashboard refactor

**What:** Multiple updates to dashboard data flow, Meta API integration, and lead processing.

---

## 2026-03-20 — Add Homes by Lella to dashboard

**What:** Added HBL to `clients.js` config and `LEADS_SHEETS` array in `leads.js`.

---

## 2026-03-16 — Fix DD/MM/YYYY date parsing

**What:** Fixed leads tracker date parsing for DD/MM/YYYY formatted dates. Added 3-day time filter. Fixed duplicate column bug.

---

## 2026-03-09 — Connect all clients to Meta API

**What:** Connected Static Shift, Fusion, Eddie, Corbel, Stirling to Meta API for direct ad data. Updated leads sheet tabs.

---

## 2026-02-23 — Initial dashboard build

**What:** First version of the multi-client ads dashboard with Google Sheets data source, lead tracking, and pipeline funnel.
