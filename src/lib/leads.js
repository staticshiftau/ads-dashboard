/**
 * Fetch and process leads data from the Leads Tracker Google Sheets.
 * These sheets track the full sales pipeline: Lead → Pick Up → Meeting → SC → Close
 */

// Both leads tracker sheets (from n8n workflows)
const LEADS_SHEETS = [
  {
    sheetId: '18UReQjJDNgP0976BPiaOjP9DRcxvA6e-Q8SsCiS0aMc',
    sheetTab: 'MAIN Leads Sheet (DO NOT TOUCH)',
    name: 'pau-v2',
  },
  {
    sheetId: '1F3d3vIMV1q_Ucew9TKX0QiBChCAX9_2i1LFzKv7SZtI',
    sheetTab: 'MAIN Leads Sheet (DO NOT TOUCH)',
    name: 'original',
  },
];

/**
 * Fetch raw leads from Google Sheet via gviz API
 */
async function fetchLeadsSheet(sheetId, sheetTab) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetTab)}`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  const text = await res.text();
  const jsonStr = text.replace(/^[^(]*\(/, '').replace(/\);?\s*$/, '');
  const data = JSON.parse(jsonStr);

  if (!data.table || !data.table.rows) return [];

  const cols = data.table.cols.map((c) => c.label || '');
  return data.table.rows
    .map((row) => {
      const obj = {};
      row.c.forEach((cell, i) => {
        if (!cols[i]) return;
        obj[cols[i]] = cell ? cell.v : null;
      });
      return obj;
    })
    .filter((r) => r.created_time); // only rows with data
}

/**
 * Fetch leads from all tracker sheets, dedup by email
 */
export async function fetchAllLeads() {
  const results = await Promise.allSettled(
    LEADS_SHEETS.map((s) => fetchLeadsSheet(s.sheetId, s.sheetTab))
  );

  const allLeads = [];
  const seen = new Set();

  results.forEach((r) => {
    if (r.status !== 'fulfilled') return;
    r.value.forEach((lead) => {
      // Dedup by email + created_time
      const key = `${lead.email || ''}_${lead.created_time || ''}`;
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
    // Parse "2026-02-17T22:08:42+0000" format
    createdDate = createdTime.split('T')[0];
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
    pickedUp: !!raw['Pick Up'],
    meetingBooked: !!raw['Meeting'],
    followUp: !!raw['Follow Up'],
    strategyCall: !!raw['SC'],
    closed: !!raw['Close'],
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
 * The main leads tracker is for Static Shift's own ads.
 * When client-specific leads sheets exist, those will be matched to clients.
 * For now, all leads from the main tracker belong to 'static-shift'.
 */
export function processLeads(rawLeads, clientDataMap) {
  const leads = rawLeads.map(parseLead);

  // Try to match leads to specific clients first,
  // fallback to 'static-shift' (since the main tracker is SS's own ads)
  leads.forEach((lead) => {
    const matched = matchLeadToClient(lead, clientDataMap);
    lead.clientSlug = matched || 'static-shift';
  });

  return leads;
}

/**
 * Get pipeline summary stats from a list of processed leads
 */
export function getPipelineSummary(leads) {
  const total = leads.length;
  const pickedUp = leads.filter((l) => l.pickedUp).length;
  const meetingsBooked = leads.filter((l) => l.meetingBooked).length;
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
    pickedUp,
    meetingsBooked,
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
