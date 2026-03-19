# Ads Dashboard — Operations Manual

**For:** Karl (Static Shift)
**Dashboard URL:** https://ads-dashboard-ecru.vercel.app
**Last updated:** 2026-03-19

---

## How It All Works (Big Picture)

```
Meta Ads API (Facebook)
        |
        v
  [Next.js App]  <---->  Google Sheets (leads tracker)
        |
        v
  Vercel (hosting)  <----  GitHub (code)
```

1. The dashboard pulls ad performance data **directly from Meta's Marketing API** in real time
2. Leads/pipeline data comes from **Google Sheets** (one shared leads tracker spreadsheet with tabs per client)
3. The code lives on **GitHub** under Karl's account
4. **Vercel** auto-deploys every time code is pushed to GitHub

---

## Accounts & Access

| Service | Account Owner | URL |
|---------|--------------|-----|
| GitHub | Karl (staticshiftau) | https://github.com/staticshiftau/ads-dashboard |
| Vercel | Karl | https://vercel.com (linked to GitHub) |
| Meta API | Static Shift Business Manager | Token stored in Vercel env vars |
| Google Sheets | Shared | Leads tracker + per-client ad performance sheets |

---

## How to Make Changes (Step by Step)

### Prerequisites
- **Node.js** installed (v18+) — download from https://nodejs.org
- **Git** installed — comes pre-installed on Mac, or download from https://git-scm.com
- A code editor — **VS Code** recommended (https://code.visualstudio.com)
- **Claude Code** (optional but recommended) — this is the AI tool Pauline uses

### 1. Clone the Repository (First Time Only)

```bash
git clone https://github.com/staticshiftau/ads-dashboard.git
cd ads-dashboard
npm install
```

### 2. Set Up Environment Variables

Create a file called `.env.local` in the project root with:

```
META_ACCESS_TOKEN=your_meta_access_token_here
```

The Meta access token is a **System User Token** from Meta Business Manager. It's also stored in Vercel's environment variables (Settings > Environment Variables).

### 3. Run Locally

```bash
npm run dev
```

Opens at http://localhost:3000. Changes auto-refresh in the browser.

### 4. Make Your Changes

Edit the relevant files (see "Key Files" section below).

### 5. Push to GitHub (This Deploys Automatically)

```bash
git add .
git commit -m "describe what you changed"
git push origin main
```

That's it. Vercel detects the push and deploys automatically. Takes about 1-2 minutes. Check https://ads-dashboard-ecru.vercel.app to verify.

---

## Key Files — What Does What

### Client Configuration
**`src/lib/clients.js`** — The list of all clients. To add a new client, add an entry:

```javascript
{
  slug: 'client-name',           // URL-friendly name (lowercase, hyphens)
  name: 'Client Display Name',   // What shows in the dashboard
  sheetId: 'google_sheet_id',    // Their Ad Performance Google Sheet ID
  sheetTab: 'Ad Performance',    // Tab name in the sheet
  fbAdAccountId: 'act_XXXXX',    // Facebook Ad Account ID
  slackChannelId: 'CXXXXXXX',    // Slack channel (optional, can be null)
}
```

### Leads Tracker
**`src/lib/leads.js`** — Fetches and processes leads from the shared Google Sheet.

- The leads tracker spreadsheet ID: `18UReQjJDNgP0976BPiaOjP9DRcxvA6e-Q8SsCiS0aMc`
- Each client has their own tab in this spreadsheet
- To add a new client's tab, add an entry to the `LEADS_SHEETS` array at the top of the file

**Qualification Logic:**
- A lead is **qualified** unless the `pick_up` column says "Unqualified" or "Fake"
- A meeting is **qualified** if `discovery` = "Booked" AND the lead is qualified
- All cost metrics (CPL, Cost/Meeting) use qualified counts only

### Meta API Integration
**`src/lib/meta.js`** — Pulls ad performance data from Facebook's Marketing API (v24.0).

### Google Sheets Integration
**`src/lib/sheets.js`** — Fetches data from Google Sheets using the public visualization API (no auth needed — sheets must be shared as "Anyone with the link can view").

### API Routes
- **`src/app/api/campaigns/route.js`** — Serves ad performance data
- **`src/app/api/leads/route.js`** — Serves leads/pipeline data

### Pages
- **`src/app/page.js`** — Home page (all clients overview)
- **`src/app/client/[slug]/page.js`** — Individual client dashboard (the main page with Overview, Campaigns, Pipeline, All Ads tabs)

### UI Components (in `src/components/`)
| Component | What It Does |
|-----------|-------------|
| `ClientCard.jsx` | Card on the home page for each client |
| `MetricCard.jsx` | Small stat card (spend, leads, CPL, etc.) |
| `CampaignTable.jsx` | Campaigns grouped with expandable ads |
| `AdTable.jsx` | All ads in a sortable table |
| `PipelineFunnel.jsx` | Sales pipeline visualization |
| `LeadsTable.jsx` | Individual leads list with stage indicators |
| `LeadsMeetingsChart.jsx` | Daily leads vs meetings chart |
| `SpendLeadsChart.jsx` | Daily spend vs leads chart |

---

## Common Tasks

### Add a New Client

1. **Get their Facebook Ad Account ID** — From Meta Business Manager > Ad Accounts
2. **Create their Google Sheet** — Copy an existing client's Ad Performance sheet, share it publicly
3. **Create their tab** in the leads tracker spreadsheet
4. **Edit two files:**
   - `src/lib/clients.js` — Add client config
   - `src/lib/leads.js` — Add leads sheet tab entry
5. Push to GitHub (auto-deploys)

### Update the Meta Access Token

If the token expires or needs rotation:
1. Generate a new System User token from Meta Business Manager
2. Update in **two places:**
   - `.env.local` (for local development)
   - Vercel dashboard > Project Settings > Environment Variables > `META_ACCESS_TOKEN`
3. Redeploy on Vercel (Settings > Deployments > Redeploy, or just push any commit)

### Check Why Data Looks Wrong

1. Check the Google Sheet — is the data actually there?
2. Check that the sheet is shared publicly ("Anyone with the link can view")
3. Check the Meta token hasn't expired (dashboard will show errors)
4. Check the "Last updated" timestamp on the dashboard — if it's stale, try the Refresh button

---

## Data Flow Details

### Ad Performance Data
```
Meta Marketing API
  → /api/campaigns route fetches insights (spend, leads, clicks, impressions)
  → Cached for 5 minutes
  → Displayed in MetricCards, CampaignTable, AdTable, SpendLeadsChart
```

### Leads & Pipeline Data
```
Google Sheets (Leads Tracker)
  → /api/leads route fetches all tabs
  → Each lead parsed for pipeline stage (pick_up, discovery, sales_call, close)
  → Qualified vs unqualified classification applied
  → Per-ad stats computed (which ads generate qualified meetings)
  → Displayed in PipelineFunnel, LeadsTable, LeadsMeetingsChart
```

### Pipeline Stages (in order)
1. **Lead** — Form submitted via Facebook ad
2. **Picked Up** — `pick_up` column has a value
3. **Meeting Booked** — `discovery` column = "Booked"
4. **Strategy Call** — `sales_call` column has a value
5. **Closed** — `close` column has a value

---

## Tech Stack

| Technology | Purpose |
|-----------|---------|
| Next.js 16 | React framework (frontend + API) |
| React 19 | UI library |
| Vercel | Hosting & auto-deployment |
| GitHub | Code repository |
| Meta Marketing API v24.0 | Ad performance data |
| Google Sheets (gviz API) | Leads & pipeline data |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Dashboard shows "Failed to fetch" | Check Meta token — may have expired |
| Leads not showing | Check Google Sheet is publicly shared |
| New client not appearing | Make sure you added them to both `clients.js` and `leads.js` |
| Deploy not working | Check Vercel dashboard for build errors |
| Numbers look wrong | Check the Google Sheet data directly, then hit Refresh |

---

## If You Need to Rebuild From Scratch

Everything you need is in the GitHub repo: https://github.com/staticshiftau/ads-dashboard

1. Clone the repo
2. Run `npm install`
3. Create `.env.local` with the Meta token
4. `npm run dev` to run locally, or connect to Vercel for deployment
5. On Vercel: Import the GitHub repo, add `META_ACCESS_TOKEN` as an environment variable, deploy

The Google Sheets and Meta Business Manager are separate — the dashboard just reads from them.
