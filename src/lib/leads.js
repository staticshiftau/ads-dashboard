/**
 * Fetch and process leads data from the Leads Tracker Google Sheets.
 * These sheets track the full sales pipeline: Lead → Pick Up → Meeting → SC → Close
 */

// Leads tracker tabs — one per client (all in the same spreadsheet)
const LEADS_SHEETS = [
  {
    sheetId: '18UReQjJDNgP0976BPiaOjP9DRcxvA6e-Q8SsCiS0aMc',
    sheetTab: 'Static Shift',
    clientSlug: 'static-shift',
  },
  {
    sheetId: '18UReQjJDNgP0976BPiaOjP9DRcxvA6e-Q8SsCiS0aMc',
    sheetTab: 'Fusion Financial',
    clientSlug: 'fusion-financial-group',
  },
  {
    sheetId: '18UReQjJDNgP0976BPiaOjP9DRcxvA6e-Q8SsCiS0aMc',
    sheetTab: 'Eddie',
    clientSlug: 'eddie-senatore',
  },
  {
    sheetId: '18UReQjJDNgP0976BPiaOjP9DRcxvA6e-Q8SsCiS0aMc',
    sheetTab: 'Corbel',
    clientSlug: 'corbel',
  },
  {
    sheetId: '18UReQjJDNgP0976BPiaOjP9DRcxvA6e-Q8SsCiS0aMc',
    sheetTab: 'Stirling Marketing',
    clientSlug: 'stirling-marketing',
  },
  {
    sheetId: '18UReQjJDNgP0976BPiaOjP9DRcxvA6e-Q8SsCiS0aMc',
    sheetTab: 'Homes by Lella',
    clientSlug: 'homes-by-lella',
  },
];

/**
 * Fetch raw leads from Google Sheet via gviz API
 */
async function fetchLeadsSheet(sheetId, sheetTab) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetTab)}&_=${Date.now()}`;
  const res = await fetch(url, {
    cache: 'no-store',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  const text = await res.text();
  if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
    throw new Error('Google returned HTML instead of data');
  }
  const jsonStr = text.replace(/^[^(]*\(/, '').replace(/\);?\s*$/, '');
  const data = JSON.parse(jsonStr);

  if (!data.table || !data.table.rows) return [];

  const cols = data.table.cols.map((c) => c.label || '');
  return data.table.rows
    .map((row) => {
      const obj = {};
      row.c.forEach((cell, i) => {
        if (!cols[i]) return;
        const val = cell ? cell.v : null;
        // Don't overwrite a truthy value with null (handles duplicate column labels)
        if (val != null || !(cols[i] in obj)) {
          obj[cols[i]] = val;
        }
      });
      return obj;
    })
    .filter((r) => r.created_time); // only rows with data
}

/**
 * Fetch leads from all tracker sheets, dedup by email+phone+time, tag with clientSlug
 */
export async function fetchAllLeads() {
  const results = await Promise.allSettled(
    LEADS_SHEETS.map(async (s) => {
      const rows = await fetchLeadsSheet(s.sheetId, s.sheetTab);
      // Tag each row with the client slug from the sheet config
      rows.forEach((row) => { row._clientSlug = s.clientSlug; });
      return rows;
    })
  );

  const allLeads = [];
  const seen = new Set();

  results.forEach((r) => {
    if (r.status !== 'fulfilled') return;
    r.value.forEach((lead) => {
      // Dedup per-client by phone + created_time (scoped so cross-tab leads don't collide)
      const key = `${lead._clientSlug}_${lead.phone || lead.email || ''}_${lead.created_time || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        allLeads.push(lead);
      }
    });
  });

  return allLeads;
}

/**
 * Parse a lead row into a clean object
 */
function parseLead(raw) {
  const createdTime = raw.created_time || '';
  let createdDate = '';
  if (createdTime) {
    if (createdTime.match(/^\d{4}-/)) {
      // ISO format: "2026-02-17T22:08:42+0000"
      createdDate = createdTime.split('T')[0];
    } else {
      // DD/MM/YYYY format: "09/03/2026 8:19 PM"
      const parts = createdTime.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (parts) {
        createdDate = `${parts[3]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
      }
    }
  }

  return {
    createdTime,
    createdDate,
    adName: raw.ad_name || '',
    adSetName: raw.adset_name || '',
    campaignName: raw.campaign_name || '',
    formName: raw.form_name || '',
    platform: raw.platform || '',
    fullName: raw.full_name || '',
    email: raw.email || '',
    phone: raw.phone || '',
    // Qualification
    question1: raw.question_1 || '',
    answer1: raw.answer_1 || '',
    question2: raw.question_2 || '',
    answer2: raw.answer_2 || '',
    question3: raw.question_3 || '',
    answer3: raw.answer_3 || '',
    // Pipeline stages (truthy = completed that stage)
    pickUpStatus: String(raw['pick_up'] || '').trim(),
    pickedUp: !!raw['pick_up'],
    qualified: !['unqualified', 'fake'].includes(String(raw['pick_up'] || '').trim().toLowerCase()),
    meetingBooked: String(raw['discovery'] || '').toLowerCase() === 'booked',
    qualifiedMeeting: String(raw['discovery'] || '').toLowerCase() === 'booked'
      && !['unqualified', 'fake'].includes(String(raw['pick_up'] || '').trim().toLowerCase()),
    followUp: false,
    strategyCall: !!raw['sales_call'],
    closed: !!raw['close'],
    // Extras
    notes: raw['notes/summary'] || '',
    callDate: raw.call_date || '',
    leadScore: raw.lead_Score || '',
    transcriptLink: raw.transcript_Link || '',
    recordingLink: raw.recording_link || '',
    salesAnalysis: raw.sales_analysis || '',
    nextSteps: raw.next_steps || '',
    objections: raw.decisions_objections_blockers || '',
  };
}

/**
 * Try to match a lead to a client based on ad/campaign/adset name overlap.
 * Uses fuzzy word-overlap matching since names vary between Meta lead forms and the Ads API.
 * Returns the client slug or null if no match.
 */
export function matchLeadToClient(lead, clientDataMap) {
  // clientDataMap: { slug: { adNames: Set, campaignNames: Set, adSetNames: Set } }
  const leadAdName = (lead.adName || '').toLowerCase();
  const leadCampaign = (lead.campaignName || '').toLowerCase();
  const leadAdSet = (lead.adSetName || '').toLowerCase();

  // Extract significant words (3+ chars, not common words)
  const stopWords = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'are', 'was', 'not']);
  function getWords(str) {
    return str.split(/[\s|,\-–—/]+/)
      .map(w => w.replace(/[^a-z0-9]/g, ''))
      .filter(w => w.length >= 3 && !stopWords.has(w));
  }

  const leadWords = new Set([
    ...getWords(leadAdName),
    ...getWords(leadCampaign),
    ...getWords(leadAdSet),
  ]);

  let bestMatch = null;
  let bestScore = 0;

  for (const [slug, data] of Object.entries(clientDataMap)) {
    const clientWords = new Set();
    for (const name of data.adNames || []) {
      getWords(name.toLowerCase()).forEach(w => clientWords.add(w));
    }
    for (const name of data.campaignNames || []) {
      getWords(name.toLowerCase()).forEach(w => clientWords.add(w));
    }
    for (const name of data.adSetNames || []) {
      getWords(name.toLowerCase()).forEach(w => clientWords.add(w));
    }

    // Count overlapping words
    let overlap = 0;
    for (const word of leadWords) {
      if (clientWords.has(word)) overlap++;
    }

    if (overlap > bestScore && overlap >= 2) {
      bestScore = overlap;
      bestMatch = slug;
    }
  }

  return bestMatch;
}

/**
 * Process all leads into structured data with pipeline stats.
 * Each lead gets its clientSlug from the sheet tab it came from.
 */
export function processLeads(rawLeads) {
  const leads = rawLeads.map((raw) => {
    const lead = parseLead(raw);
    lead.clientSlug = raw._clientSlug || 'static-shift';
    return lead;
  });

  return leads;
}

/**
 * Get pipeline summary stats from a list of processed leads
 */
export function getPipelineSummary(leads) {
  const total = leads.length;
  const qualifiedLeads = leads.filter((l) => l.qualified).length;
  const pickedUp = leads.filter((l) => l.pickedUp).length;
  const meetingsBooked = leads.filter((l) => l.meetingBooked).length;
  const qualifiedMeetings = leads.filter((l) => l.qualifiedMeeting).length;
  const unqualifiedMeetings = leads.filter((l) => l.meetingBooked && !l.qualifiedMeeting).length;
  const followUps = leads.filter((l) => l.followUp).length;
  const strategyCalls = leads.filter((l) => l.strategyCall).length;
  const closed = leads.filter((l) => l.closed).length;

  // Conversion rates
  const pickUpRate = total > 0 ? pickedUp / total : 0;
  const meetingRate = total > 0 ? meetingsBooked / total : 0;
  const scRate = total > 0 ? strategyCalls / total : 0;
  const closeRate = total > 0 ? closed / total : 0;

  return {
    total,
    qualifiedLeads,
    pickedUp,
    meetingsBooked,
    qualifiedMeetings,
    unqualifiedMeetings,
    followUps,
    strategyCalls,
    closed,
    pickUpRate,
    meetingRate,
    scRate,
    closeRate,
  };
}

/**
 * Filter leads by date range (last N days)
 */
export function filterLeadsByDays(leads, days) {
  if (!days) return leads;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  return leads.filter((l) => l.createdDate >= cutoffStr);
}

/**
 * Filter leads by explicit date range (since/until as YYYY-MM-DD strings)
 */
export function filterLeadsByDateRange(leads, since, until) {
  return leads.filter((l) => l.createdDate >= since && l.createdDate <= until);
}
