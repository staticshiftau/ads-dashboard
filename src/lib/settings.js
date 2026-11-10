/**
 * Per-client KPI targets, kept in a "Settings" tab of the Leads Tracker spreadsheet.
 *
 * Columns: Date | Client | CostPerMeeting | CostPerQualifiedMeeting | CPL | CallQualifiedRate | LeadQualifiedRate
 * Rows are append-only. The last row for a client wins; older rows are the history.
 *
 * Unlike notes.js, a failed read THROWS. An empty result here would be read as
 * "no targets set", and a verdict must never be built on targets that failed to load.
 */

const SHEET_ID = '18UReQjJDNgP0976BPiaOjP9DRcxvA6e-Q8SsCiS0aMc';
const SETTINGS_TAB = 'Settings';

const COLUMNS = [
  ['CostPerMeeting', 'costPerMeeting'],
  ['CostPerQualifiedMeeting', 'costPerQualifiedMeeting'],
  ['CPL', 'cpl'],
  ['CallQualifiedRate', 'callQualifiedRate'],
  ['LeadQualifiedRate', 'leadQualifiedRate'],
];

export const EMPTY_TARGETS = Object.fromEntries(COLUMNS.map(([, key]) => [key, null]));

/**
 * Read every client's current targets. Returns { [clientSlug]: targets }.
 * Throws if the tab cannot be read.
 */
export async function readAllSettings() {
  const url =
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json` +
    `&sheet=${encodeURIComponent(SETTINGS_TAB)}&headers=1&_=${Date.now()}`;

  const res = await fetch(url, {
    cache: 'no-store',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  if (!res.ok) throw new Error(`Settings read failed: ${res.status}`);

  const text = await res.text();
  if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
    throw new Error('Settings read failed: Google returned a page instead of data');
  }
  const data = JSON.parse(text.replace(/^[^(]*\(/, '').replace(/\);?\s*$/, ''));
  if (data.status === 'error' || !data.table) {
    throw new Error('Settings read failed: the Settings tab could not be queried');
  }

  const cols = data.table.cols.map((c) => (c.label || '').trim());
  // gviz quietly serves the first tab when the named one is missing. Refuse that.
  if (!cols.includes('Client') || !cols.includes('CostPerQualifiedMeeting')) {
    throw new Error('Settings read failed: the Settings tab is missing or has the wrong headers');
  }

  const bySlug = {};
  for (const row of data.table.rows || []) {
    const obj = {};
    row.c.forEach((cell, i) => {
      if (cols[i]) obj[cols[i]] = cell ? cell.v : null;
    });
    const slug = String(obj.Client || '').trim();
    if (!slug) continue;
    const targets = {};
    for (const [col, key] of COLUMNS) {
      const n = Number(obj[col]);
      targets[key] = obj[col] !== null && obj[col] !== '' && isFinite(n) && n > 0 ? n : null;
    }
    bySlug[slug] = targets; // rows are in sheet order, so the last one wins
  }
  return bySlug;
}

/**
 * Append a new settings row for a client. Throws if the write fails.
 * `values` must already be validated (see validateTargets in verdict.js).
 */
export async function appendSettings(clientSlug, values) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!email || !key) {
    throw new Error('Google service account not configured, so settings cannot be saved');
  }

  const { google } = await import('googleapis');
  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  const stamp = new Date().toLocaleString('en-AU', {
    timeZone: 'Australia/Sydney',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${SETTINGS_TAB}!A:G`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[stamp, clientSlug, ...COLUMNS.map(([, k]) => (values[k] === null ? '' : values[k]))]],
    },
  });
}
