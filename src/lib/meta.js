/**
 * Meta Marketing API integration.
 * Fetches ad performance data and statuses directly from Meta Graph API v24.0.
 */

const META_API_VERSION = 'v24.0';
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

// In-memory caches
const insightsCache = {};
const statusCache = {};
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Extract lead count from Meta actions array.
 */
function getLeads(actions) {
  if (!actions || !Array.isArray(actions)) return 0;
  const leadAction = actions.find((a) => {
    const t = a.action_type || '';
    return (
      t.includes('lead') ||
      t.includes('registration') ||
      t.includes('contact') ||
      t === 'offsite_conversion.fb_pixel_lead' ||
      t === 'leadgen_grouped' ||
      t === 'onsite_conversion.lead_grouped'
    );
  });
  return leadAction ? parseFloat(leadAction.value) : 0;
}

/**
 * Extract link click count from Meta actions array.
 */
function getLinkClicks(actions) {
  if (!actions || !Array.isArray(actions)) return 0;
  const lc = actions.find((a) => a.action_type === 'link_click');
  return lc ? parseFloat(lc.value) : 0;
}

/**
 * Map Meta's effective_status to display-friendly values.
 */
function mapMetaStatus(metaStatus) {
  const mapping = {
    ACTIVE: 'ACTIVE',
    PAUSED: 'PAUSED',
    CAMPAIGN_PAUSED: 'PAUSED',
    ADSET_PAUSED: 'PAUSED',
    DELETED: 'ARCHIVED',
    ARCHIVED: 'ARCHIVED',
    DISAPPROVED: 'DISAPPROVED',
    PENDING_REVIEW: 'IN REVIEW',
    PREAPPROVED: 'IN REVIEW',
    PENDING_BILLING_INFO: 'BILLING ISSUE',
    WITH_ISSUES: 'WITH_ISSUES',
    IN_PROCESS: 'PROCESSING',
  };
  return mapping[metaStatus] || metaStatus;
}

/**
 * Fetch paginated data from Meta API.
 */
async function fetchAllPages(url) {
  const results = [];
  let nextUrl = url;

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`[meta.js] Meta API error: ${res.status}`, errorBody);
      return null;
    }

    const json = await res.json();
    if (json.data) {
      results.push(...json.data);
    }
    nextUrl = json.paging?.next || null;
  }

  return results;
}

/**
 * Fetch ad statuses for a given Meta ad account.
 * Returns a Map of ad_id -> { name, effectiveStatus, campaignName }.
 * If campaignFilter is set, only ads whose campaign name contains that string are included.
 */
export async function fetchMetaAdStatuses(adAccountId, campaignFilter = null, { fresh = false } = {}) {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token || !adAccountId) return null;

  const cacheKey = `${adAccountId}_${campaignFilter || 'all'}`;
  const cached = statusCache[cacheKey];
  // `fresh` skips the cache so an ad paused a moment ago shows as paused (Refresh button).
  if (!fresh && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const url = `${META_BASE_URL}/${adAccountId}/ads?fields=id,name,effective_status,campaign{id,name}&limit=500&access_token=${token}`;
  const ads = await fetchAllPages(url);
  if (!ads) return null;

  const statusMap = new Map();
  for (const ad of ads) {
    const campaignName = ad.campaign?.name || '';
    if (campaignFilter && !campaignName.includes(campaignFilter)) continue;
    statusMap.set(ad.id, {
      name: ad.name,
      effectiveStatus: ad.effective_status,
      campaignName,
      campaignId: ad.campaign?.id || null,
    });
  }

  statusCache[cacheKey] = { data: statusMap, timestamp: Date.now() };
  return statusMap;
}

/**
 * Fetch every campaign in an ad account with its start time.
 * Returns { [campaignId]: { name, startTime } }, or null if Meta could not be read.
 * Read-only.
 */
const campaignCache = {};
export async function fetchMetaCampaigns(adAccountId, { fresh = false } = {}) {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token || !adAccountId) return null;

  const cached = campaignCache[adAccountId];
  if (!fresh && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const url = `${META_BASE_URL}/${adAccountId}/campaigns?fields=id,name,start_time&limit=500&access_token=${token}`;
  const campaigns = await fetchAllPages(url);
  if (!campaigns) return null;

  const data = {};
  for (const c of campaigns) {
    data[c.id] = { name: c.name, startTime: c.start_time || null };
  }
  campaignCache[adAccountId] = { data, timestamp: Date.now() };
  return data;
}

/**
 * The ad account's currency code (e.g. "AUD", "NZD"), or null. Read-only.
 */
const currencyCache = {};
export async function fetchAccountCurrency(adAccountId) {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token || !adAccountId) return null;
  if (currencyCache[adAccountId]) return currencyCache[adAccountId];
  try {
    const res = await fetch(
      `${META_BASE_URL}/${adAccountId}?fields=currency&access_token=${token}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return null;
    const json = await res.json();
    if (json.currency) currencyCache[adAccountId] = json.currency;
    return json.currency || null;
  } catch {
    return null;
  }
}

/**
 * Fetch ad performance insights directly from Meta API.
 * Returns rows in the same format as Google Sheets data.
 */
export async function fetchMetaInsights(adAccountId, days = 30, { since: sinceParam, until: untilParam, campaignFilter } = {}) {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token || !adAccountId) return null;

  // Calculate date range — use explicit dates if provided, otherwise fall back to days
  let sinceStr, untilStr;
  if (sinceParam && untilParam) {
    sinceStr = sinceParam;
    untilStr = untilParam;
  } else {
    const today = new Date();
    const sinceDate = new Date(today);
    sinceDate.setDate(sinceDate.getDate() - days);
    sinceStr = sinceDate.toISOString().split('T')[0];
    untilStr = today.toISOString().split('T')[0];
  }

  const cacheKey = `${adAccountId}_${sinceStr}_${untilStr}_${campaignFilter || 'all'}`;
  const cached = insightsCache[cacheKey];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const timeRange = encodeURIComponent(
    JSON.stringify({ since: sinceStr, until: untilStr })
  );

  const baseUrl =
    `${META_BASE_URL}/${adAccountId}/insights` +
    `?level=ad&time_increment=1&limit=500` +
    `&time_range=${timeRange}` +
    `&access_token=${token}`;

  // Spend and actions are fetched separately. On some accounts (Ange's, Oct 2026)
  // requesting `actions` in the same call makes Meta report most spend as 0.
  const [metricRows, actionRows] = await Promise.all([
    fetchAllPages(`${baseUrl}&fields=ad_id,ad_name,campaign_id,campaign_name,adset_name,spend,impressions,clicks`),
    fetchAllPages(`${baseUrl}&fields=ad_id,actions`),
  ]);
  if (!metricRows || !actionRows) return null;

  const actionsByAdDay = new Map(
    actionRows.map((row) => [`${row.ad_id}|${row.date_start}`, row.actions])
  );
  let data = metricRows.map((row) => ({
    ...row,
    actions: actionsByAdDay.get(`${row.ad_id}|${row.date_start}`),
  }));

  // Only keep rows from campaigns matching the client's filter (e.g. shared ad account)
  if (campaignFilter) {
    data = data.filter((row) => (row.campaign_name || '').includes(campaignFilter));
  }

  // Transform into the format aggregateAds() expects
  const rows = data.map((row) => ({
    Date: row.date_start,
    'Ad Name': row.ad_name,
    'Ad ID': row.ad_id,
    'Campaign Name': row.campaign_name,
    'Campaign ID': row.campaign_id,
    'Ad Set Name': row.adset_name,
    Status: 'ACTIVE', // placeholder — will be overridden by status fetch
    Spend: parseFloat(row.spend) || 0,
    Leads: getLeads(row.actions),
    Impressions: parseInt(row.impressions) || 0,
    Clicks: parseInt(row.clicks) || 0,
    'Link Clicks': getLinkClicks(row.actions),
  }));

  insightsCache[cacheKey] = { data: rows, timestamp: Date.now() };
  return rows;
}

/**
 * Apply real statuses from /ads endpoint to insight rows and aggregated ads.
 * Matches by ad_id — no more name collision issues.
 */
export function applyMetaStatuses(ads, statusMap) {
  if (!statusMap) return ads;

  return ads.map((ad) => {
    // Match by ad ID if available
    if (ad.adId) {
      const info = statusMap.get(ad.adId);
      if (info) {
        return {
          ...ad,
          status: mapMetaStatus(info.effectiveStatus),
        };
      }
    }

    // Fallback: match by name (for ads without ID)
    for (const [, info] of statusMap) {
      if (info.name === ad.adName) {
        return {
          ...ad,
          status: mapMetaStatus(info.effectiveStatus),
        };
      }
    }

    return ad;
  });
}

/**
 * Get ads from Meta that have a status but no insights data
 * (newly launched ads with no spend yet).
 */
export function getNewAdsFromMeta(statusMap, existingAdIds) {
  if (!statusMap) return [];

  const newAds = [];
  for (const [adId, info] of statusMap) {
    if (existingAdIds.has(adId)) continue;

    const mapped = mapMetaStatus(info.effectiveStatus);
    // Only show active or in-review — skip old archived/deleted
    if (mapped !== 'ACTIVE' && mapped !== 'IN REVIEW' && mapped !== 'PROCESSING')
      continue;

    newAds.push({
      adName: info.name,
      adId: adId,
      campaignName: info.campaignName || '',
      adSetName: '',
      status: mapped,
      totalSpend: 0,
      totalLeads: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalLinkClicks: 0,
      days: 0,
      dates: [],
      dailyData: [],
      cpl: 0,
      costPerLinkClick: 0,
      cpm: 0,
    });
  }

  return newAds;
}
