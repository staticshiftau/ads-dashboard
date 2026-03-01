/**
 * Meta Marketing API integration for fetching live ad statuses.
 * Uses the Graph API v24.0 to query effective_status per ad account.
 */

const META_API_VERSION = 'v24.0';
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

// In-memory cache: { [adAccountId]: { data, timestamp } }
const statusCache = {};
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch all ad statuses for a given Meta ad account.
 * Returns { statusMap, activeNames } or null on failure.
 *
 * statusMap: Map<name, status> — for duplicate names, prefers non-ACTIVE
 *   (sheet ads with historical data are the old/paused version)
 * activeNames: Set<name> — all names that have at least one ACTIVE version
 *   (used to surface new active ads not yet in the sheet)
 */
export async function fetchMetaAdStatuses(adAccountId) {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token || !adAccountId) {
    return null;
  }

  // Check cache
  const cached = statusCache[adAccountId];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const statusMap = new Map();
    const activeNames = new Set();
    let url = `${META_BASE_URL}/${adAccountId}/ads?fields=id,name,effective_status&limit=500&access_token=${token}`;

    while (url) {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        const errorBody = await res.text();
        console.error(`[meta.js] Meta API error for ${adAccountId}: ${res.status}`, errorBody);
        return null;
      }

      const json = await res.json();

      if (json.data) {
        for (const ad of json.data) {
          if (ad.effective_status === 'ACTIVE') {
            activeNames.add(ad.name);
          }

          const existing = statusMap.get(ad.name);
          if (!existing) {
            statusMap.set(ad.name, ad.effective_status);
          } else if (existing === 'ACTIVE' && ad.effective_status !== 'ACTIVE') {
            // For duplicates, prefer non-ACTIVE for sheet matching
            // (sheet data is from the old/paused version of the ad)
            statusMap.set(ad.name, ad.effective_status);
          }
        }
      }

      url = json.paging?.next || null;
    }

    const result = { statusMap, activeNames };
    statusCache[adAccountId] = { data: result, timestamp: Date.now() };
    return result;
  } catch (err) {
    console.error(`[meta.js] Failed to fetch Meta statuses for ${adAccountId}:`, err.message);
    return null;
  }
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
 * Merge live Meta statuses into aggregated ad objects.
 * If metaData is null (Meta API failed), ads keep their sheet status.
 */
export function mergeMetaStatuses(ads, metaData) {
  if (!metaData) {
    return ads.map((ad) => ({ ...ad, statusSource: 'sheet' }));
  }

  const { statusMap, activeNames } = metaData;

  // Track which Meta ad names were matched to sheet ads
  const matchedMetaNames = new Set();

  const merged = ads.map((ad) => {
    // Exact match
    let metaStatus = statusMap.get(ad.adName);
    let matchedName = metaStatus ? ad.adName : null;

    // Fallback: case-insensitive trimmed match
    if (!metaStatus) {
      const normalizedSheet = ad.adName.toLowerCase().trim();
      for (const [metaName, status] of statusMap) {
        if (metaName.toLowerCase().trim() === normalizedSheet) {
          metaStatus = status;
          matchedName = metaName;
          break;
        }
      }
    }

    if (metaStatus) {
      matchedMetaNames.add(matchedName);
      return {
        ...ad,
        status: mapMetaStatus(metaStatus),
        metaRawStatus: metaStatus,
        statusSource: 'meta',
      };
    }

    return { ...ad, statusSource: 'sheet' };
  });

  // Add new active ads from Meta that aren't in the sheet yet
  for (const name of activeNames) {
    if (matchedMetaNames.has(name)) {
      // Name was matched to a sheet ad — but if the sheet ad got the
      // non-ACTIVE status (old version), the new ACTIVE version should
      // still show up separately
      const sheetAd = merged.find(
        (a) => a.adName === name && a.statusSource === 'meta',
      );
      if (sheetAd && sheetAd.status === 'ACTIVE') continue;
    } else {
      // Check case-insensitive match too
      const normalizedName = name.toLowerCase().trim();
      const matched = [...matchedMetaNames].some(
        (m) => m.toLowerCase().trim() === normalizedName,
      );
      if (matched) {
        const sheetAd = merged.find(
          (a) =>
            a.adName.toLowerCase().trim() === normalizedName &&
            a.statusSource === 'meta',
        );
        if (sheetAd && sheetAd.status === 'ACTIVE') continue;
      }
    }

    merged.push({
      adName: name,
      campaignName: '',
      adSetName: '',
      status: 'ACTIVE',
      metaRawStatus: 'ACTIVE',
      statusSource: 'meta-only',
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

  return merged;
}
