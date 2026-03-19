# Ads Dashboard — Operations Manual

**For:** Karl (Static Shift)
**Dashboard URL:** https://ads-dashboard-ecru.vercel.app
**Last updated:** 2026-03-19

---

## How It All Works (The Simple Version)

Think of it like this:

- **GitHub** = the filing cabinet where all the code is stored (like Google Drive but for code)
- **Vercel** = the web host that takes the code from GitHub and turns it into the live website
- **Meta API** = Facebook's data feed that gives us ad performance numbers
- **Google Sheets** = where the leads and pipeline data lives

Here's how they connect:

```
Facebook Ads (Meta)  ------>  The Dashboard App  <------  Google Sheets (leads)
                                    |
                                    |  (code stored in)
                                    v
                                 GitHub
                                    |
                                    |  (auto-published by)
                                    v
                                  Vercel  --->  https://ads-dashboard-ecru.vercel.app
```

**The key thing to understand:** When someone changes the code and pushes it to GitHub, Vercel automatically picks it up and updates the live dashboard within 1-2 minutes. No extra steps needed.

---

## Where Everything Lives

| What | Where | How to Access |
|------|-------|---------------|
| The live dashboard | Vercel | Go to https://ads-dashboard-ecru.vercel.app |
| The code | GitHub | Go to https://github.com/staticshiftau/ads-dashboard |
| Hosting settings | Vercel | Log in at https://vercel.com with your (Karl's) account |
| The Meta API token | Vercel + local `.env.local` file | Vercel dashboard > Project > Settings > Environment Variables |
| Leads data | Google Sheets | The shared leads tracker spreadsheet (one tab per client) |
| Ad performance data | Facebook | Pulled automatically from Meta's API using your token |

**Important:** The code is on GitHub, NOT on Vercel. Vercel just reads from GitHub and hosts the website. If you need to see or change the code, go to GitHub.

---

## How Pauline Currently Works on This

Here's the exact workflow Pauline follows when making changes:

1. Opens the project folder on her computer (`ads-dashboard/`)
2. Uses **Claude Code** (an AI coding tool) to make changes to the code
3. Tests locally by running `npm run dev` and checking http://localhost:3000
4. When happy with the changes, pushes to GitHub:
   ```
   git add .
   git commit -m "what I changed"
   git push origin main
   ```
5. Vercel auto-detects the push and deploys the update (1-2 minutes)
6. Checks the live dashboard to make sure it works

That's the full process. There's no manual deploy step — pushing to GitHub IS deploying.

---

## If You Need Someone Else to Work on This

Give them:

1. **Access to the GitHub repo** — Add them as a collaborator at https://github.com/staticshiftau/ads-dashboard/settings/access
2. **The Meta access token** — They'll need this in a `.env.local` file to run locally (it's also stored in Vercel's environment variables, so the live site always has it)
3. **This manual** — It's in the repo itself at `OPERATIONS-MANUAL.md`

They'll need to install a few free tools on their computer:
- **Node.js** (v18 or higher) — download at https://nodejs.org (click the big green button)
- **Git** — already on Mac; for Windows download at https://git-scm.com
- **VS Code** (or any code editor) — download at https://code.visualstudio.com

Then they run these commands once to set up:
```bash
git clone https://github.com/staticshiftau/ads-dashboard.git
cd ads-dashboard
npm install
```

And to start working:
```bash
npm run dev
```

That opens the dashboard on their computer at http://localhost:3000 where they can see changes in real time.

---

## How to Add a New Client

You need 3 things from the client:
1. Their **Facebook Ad Account ID** (looks like `act_123456789`) — find it in Meta Business Manager > Ad Accounts
2. A **Google Sheet** for their ad performance data — copy an existing client's sheet and share it publicly
3. A new **tab** in the leads tracker spreadsheet with the client's name

Then edit 2 files in the code:

### File 1: `src/lib/clients.js`
Add a new block like this (copy-paste an existing one and change the values):

```javascript
{
  slug: 'client-name',           // lowercase, hyphens instead of spaces (used in the URL)
  name: 'Client Display Name',   // how it shows in the dashboard
  sheetId: 'google_sheet_id',    // the long ID from the Google Sheet URL
  sheetTab: 'Ad Performance',    // the tab name in the sheet
  fbAdAccountId: 'act_XXXXX',    // their Facebook Ad Account ID
  slackChannelId: null,          // Slack channel ID, or null if none
},
```

**How to find the Google Sheet ID:** Open the sheet in your browser. The URL looks like:
`https://docs.google.com/spreadsheets/d/THIS_PART_IS_THE_ID/edit`

### File 2: `src/lib/leads.js`
Add a new block to the `LEADS_SHEETS` array at the top:

```javascript
{
  sheetId: '18UReQjJDNgP0976BPiaOjP9DRcxvA6e-Q8SsCiS0aMc',
  sheetTab: 'Client Name',     // must match the tab name exactly
  clientSlug: 'client-name',   // must match the slug from clients.js
},
```

Then push to GitHub and it auto-deploys.

---

## How the Dashboard Decides "Qualified" vs "Unqualified"

This is based on the leads tracker Google Sheet:

**Qualified Lead:** Any lead where the `pick_up` column is empty OR has any value EXCEPT "Unqualified" or "Fake"

**Unqualified Lead:** The `pick_up` column says "Unqualified" or "Fake"

**Qualified Meeting:** The `discovery` column says "Booked" AND the lead is qualified

**Unqualified Meeting:** The `discovery` column says "Booked" BUT the lead is unqualified

**All cost metrics** (Cost per Lead, Cost per Meeting) only count qualified leads/meetings. This way you see the real cost of acquiring actual prospects, not inflated by junk leads.

---

## How to Update the Meta (Facebook) Token

The Meta access token is what lets the dashboard pull data from Facebook. If it expires:

1. Go to **Meta Business Manager** > Business Settings > System Users
2. Generate a new token for the System User that has access to all ad accounts
3. Update it in **two places:**
   - **Vercel** (for the live site): Go to https://vercel.com > Your Project > Settings > Environment Variables > Edit `META_ACCESS_TOKEN`
   - **Local `.env.local` file** (for local development): Open the file and replace the old token

After updating on Vercel, you may need to redeploy. Go to Vercel > Deployments > click the three dots on the latest deployment > Redeploy.

---

## Pipeline Stages Explained

The dashboard tracks leads through these stages (in order). Each stage corresponds to a column in the leads tracker Google Sheet:

| Stage | Sheet Column | What It Means |
|-------|-------------|---------------|
| Lead | (auto) | Someone submitted a form through a Facebook ad |
| Picked Up | `pick_up` | Someone contacted/responded to the lead |
| Meeting Booked | `discovery` | Value is "Booked" — a meeting was scheduled |
| Strategy Call | `sales_call` | A strategy/sales call happened |
| Closed | `close` | The deal was closed |

---

## Project Structure (What's in the Code)

```
ads-dashboard/
  src/
    app/
      page.js                    -- Home page (shows all clients)
      client/[slug]/page.js      -- Individual client page (the main dashboard view)
      api/
        campaigns/route.js       -- Backend: fetches ad data from Facebook
        leads/route.js           -- Backend: fetches leads from Google Sheets
    lib/
      clients.js                 -- Client list (names, sheet IDs, ad account IDs)
      leads.js                   -- Leads processing & qualification logic
      meta.js                    -- Facebook API connection
      sheets.js                  -- Google Sheets connection
    components/
      ClientCard.jsx             -- Client card on home page
      MetricCard.jsx             -- Small stat box (spend, leads, CPL, etc.)
      CampaignTable.jsx          -- Campaign table with expandable ads
      AdTable.jsx                -- All ads table
      PipelineFunnel.jsx         -- Sales pipeline funnel chart
      LeadsTable.jsx             -- List of individual leads
      LeadsMeetingsChart.jsx     -- Leads vs meetings bar chart
      SpendLeadsChart.jsx        -- Daily spend vs leads chart
  .env.local                     -- Meta token (NOT uploaded to GitHub for security)
  package.json                   -- Project dependencies and scripts
  OPERATIONS-MANUAL.md           -- This file
```

---

## Troubleshooting

**Dashboard shows an error or "Failed to fetch"**
- Most likely the Meta token expired. Follow the "Update the Meta Token" section above.

**Leads aren't showing for a client**
- Check the Google Sheet is shared publicly (Share > Anyone with the link > Viewer)
- Check the tab name in `leads.js` matches the actual tab name in the spreadsheet exactly (case-sensitive)

**A new client isn't appearing on the dashboard**
- Make sure you added them to BOTH `clients.js` AND `leads.js`
- Make sure you pushed the changes to GitHub

**Changes aren't showing on the live dashboard**
- Check Vercel for build errors: https://vercel.com > Your Project > Deployments
- Make sure you actually pushed to GitHub (`git push origin main`)
- Try a hard refresh in your browser (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)

**Numbers look wrong**
- Check the Google Sheet data directly — the dashboard just displays what's in the sheet
- Hit the "Refresh" button on the dashboard to pull fresh data
- Check the "Last updated" timestamp — if it's recent, the data is current

---

## Starting Completely From Scratch

If you ever need to rebuild everything (new computer, new developer, etc.), everything you need is in the GitHub repo:

1. Go to https://github.com/staticshiftau/ads-dashboard
2. Clone it: `git clone https://github.com/staticshiftau/ads-dashboard.git`
3. Install dependencies: `cd ads-dashboard && npm install`
4. Create `.env.local` with the Meta token
5. Run locally: `npm run dev`
6. To deploy: connect the repo to Vercel, add `META_ACCESS_TOKEN` as an environment variable

The Google Sheets and Meta Business Manager are completely separate services — the dashboard just reads data from them. So even if the dashboard code is lost, the data is safe.
