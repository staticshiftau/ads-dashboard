/**
 * Fetch data from a Google Sheet's "Ad Performance" tab
 * using the Google Visualization API (no API key required if sheet has link sharing).
 */
export async function fetchSheetData(sheetId, sheetTab = 'Ad Performance') {
  const encodedTab = encodeURIComponent(sheetTab);
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${encodedTab}`;

  // Retry up to 3 times with exponential backoff (Google Sheets can rate-limit)
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { next: { revalidate: 300 } }); // cache 5 min
      if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
      const text = await res.text();
      return parseSheetResponse(text);
    } catch (err) {
      lastError = err;
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

function parseSheetResponse(text) {
  // Response is wrapped in: google.visualization.Query.setResponse({...})
  const jsonStr = text.replace(/^[^(]*\(/, '').replace(/\);?\s*$/, '');
  const data = JSON.parse(jsonStr);

  if (!data.table || !data.table.rows) {
    return [];
  }

  const cols = data.table.cols.map((c) => c.label || '');
  const rows = data.table.rows.map((row) => {
    const obj = {};
    row.c.forEach((cell, i) => {
      if (!cols[i]) return;
      let val = cell ? cell.v : null;
      // Handle Google date objects like "Date(2026,1,22)"
      if (val && typeof val === 'string' && val.startsWith('Date(')) {
        const parts = val.match(/Date\((\d+),(\d+),(\d+)\)/);
        if (parts) {
          val = `${parts[1]}-${String(Number(parts[2]) + 1).padStart(2, '0')}-${parts[3].padStart(2, '0')}`;
        }
      }
      obj[cols[i]] = val;
    });
    return obj;
  });

  return rows.filter((r) => r.Date); // only rows with a date
}

/**
 * Aggregate raw daily rows into per-ad summaries
 */
export function aggregateAds(rows) {
  const adMap = {};

  rows.forEach((row) => {
    const key = row['Ad Name'] || 'Unknown';
    if (!adMap[key]) {
      adMap[key] = {
        adName: key,
        campaignName: row['Campaign Name'] || '',
        adSetName: row['Ad Set Name'] || '',
        status: row['Status'] || '',
        totalSpend: 0,
        totalLeads: 0,
        totalImpressions: 0,
        totalClicks: 0,
        totalLinkClicks: 0,
        days: 0,
        dates: [],
        dailyData: [],
      };
    }
    const ad = adMap[key];
    ad.totalSpend += Number(row['Spend']) || 0;
    ad.totalLeads += Number(row['Leads']) || 0;
    ad.totalImpressions += Number(row['Impressions']) || 0;
    ad.totalClicks += Number(row['Clicks']) || 0;
    ad.totalLinkClicks += Number(row['Link Clicks']) || 0;
    ad.days++;
    ad.dates.push(row['Date']);
    ad.dailyData.push({
      date: row['Date'],
      spend: Number(row['Spend']) || 0,
      leads: Number(row['Leads']) || 0,
      impressions: Number(row['Impressions']) || 0,
      clicks: Number(row['Clicks']) || 0,
      linkClicks: Number(row['Link Clicks']) || 0,
      cpl: Number(row['CPL']) || 0,
      cpm: Number(row['CPM']) || 0,
      cpc: Number(row['CPC']) || 0,
      costPerLinkClick: Number(row['Cost Per Link Click']) || 0,
    });
    // Keep most recent status
    if (row['Status']) ad.status = row['Status'];
  });

  return Object.values(adMap).map((ad) => ({
    ...ad,
    cpl: ad.totalLeads > 0 ? ad.totalSpend / ad.totalLeads : 0,
    costPerLinkClick:
      ad.totalLinkClicks > 0 ? ad.totalSpend / ad.totalLinkClicks : 0,
    cpm:
      ad.totalImpressions > 0
        ? (ad.totalSpend / ad.totalImpressions) * 1000
        : 0,
    dailyData: ad.dailyData.sort((a, b) => a.date.localeCompare(b.date)),
  }));
}

/**
 * Get summary stats for a client from their rows
 */
export function getClientSummary(rows) {
  const totalSpend = rows.reduce((s, r) => s + (Number(r['Spend']) || 0), 0);
  const totalLeads = rows.reduce((s, r) => s + (Number(r['Leads']) || 0), 0);
  const totalImpressions = rows.reduce(
    (s, r) => s + (Number(r['Impressions']) || 0),
    0
  );
  const totalClicks = rows.reduce(
    (s, r) => s + (Number(r['Clicks']) || 0),
    0
  );
  const totalLinkClicks = rows.reduce(
    (s, r) => s + (Number(r['Link Clicks']) || 0),
    0
  );
  const uniqueAds = new Set(rows.map((r) => r['Ad Name'])).size;
  const uniqueDates = [...new Set(rows.map((r) => r['Date']))].sort();
  const dateRange =
    uniqueDates.length > 0
      ? { from: uniqueDates[0], to: uniqueDates[uniqueDates.length - 1] }
      : null;

  return {
    totalSpend,
    totalLeads,
    totalImpressions,
    totalClicks,
    totalLinkClicks,
    cpl: totalLeads > 0 ? totalSpend / totalLeads : 0,
    uniqueAds,
    dateRange,
    totalRows: rows.length,
  };
}

/**
 * Get the last N days of data from rows
 */
export function getLastNDays(rows, n = 7) {
  const uniqueDates = [...new Set(rows.map((r) => r['Date']))]
    .sort()
    .reverse();
  const cutoffDates = uniqueDates.slice(0, n);
  return rows.filter((r) => cutoffDates.includes(r['Date']));
}
