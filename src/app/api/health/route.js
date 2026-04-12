import { NextResponse } from 'next/server';
import { clients } from '@/lib/clients';
import { fetchMetaInsights, fetchMetaAdStatuses } from '@/lib/meta';
import { fetchAllLeads, processLeads, filterLeadsByDays } from '@/lib/leads';

export const dynamic = 'force-dynamic';

const META_API_VERSION = 'v24.0';
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

/**
 * Check 1: Meta API access — token valid, ad account reachable
 */
async function checkMetaAccess(client) {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return { status: 'fail', message: 'META_ACCESS_TOKEN not set' };
  if (!client.fbAdAccountId) return { status: 'skip', message: 'No ad account configured' };

  try {
    const res = await fetch(
      `${META_BASE_URL}/${client.fbAdAccountId}?fields=name,account_status&access_token=${token}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) {
      const body = await res.text();
      // Check for specific token errors
      if (body.includes('OAuthException') || body.includes('access token')) {
        return { status: 'fail', message: 'Access token expired or invalid' };
      }
      return { status: 'fail', message: `API returned ${res.status}` };
    }
    const data = await res.json();
    if (data.account_status !== 1) {
      return { status: 'pass', message: `Account "${data.name}" inactive (status ${data.account_status}) — not an issue`, inactive: true };
    }
    return { status: 'pass', message: `Account "${data.name}" active` };
  } catch (err) {
    return { status: 'fail', message: `Meta API unreachable: ${err.message}` };
  }
}

/**
 * Check 2: Leads sheet parseable — dates resolving correctly, no raw Date() strings
 */
function checkLeadDates(clientLeads) {
  if (clientLeads.length === 0) {
    return { status: 'pass', message: 'No leads to check' };
  }

  const badDates = clientLeads.filter(
    (l) => l.createdTime && !l.createdDate
  );

  if (badDates.length > 0) {
    const sample = badDates[0].createdTime;
    return {
      status: 'fail',
      message: `${badDates.length} leads with unparseable dates (e.g. "${sample}")`,
    };
  }

  const nullDates = clientLeads.filter((l) => !l.createdTime);
  if (nullDates.length > 0) {
    return {
      status: 'warn',
      message: `${nullDates.length} leads missing created_time`,
    };
  }

  return { status: 'pass', message: `All ${clientLeads.length} leads have valid dates` };
}

/**
 * Check 3: Meta vs sheet lead count sanity
 * Compares Meta's reported leads (from actions) vs sheet lead count over the same period
 */
async function checkLeadCountSanity(client, clientLeads, days = 7) {
  if (!client.fbAdAccountId) return { status: 'skip', message: 'No ad account' };

  try {
    const metaRows = await fetchMetaInsights(client.fbAdAccountId, days);
    if (!metaRows) return { status: 'warn', message: 'Could not fetch Meta insights' };

    const metaLeadCount = metaRows.reduce((sum, r) => sum + (r.Leads || 0), 0);
    const metaSpend = metaRows.reduce((sum, r) => sum + (r.Spend || 0), 0);
    const sheetLeadCount = clientLeads.length;

    // If Meta reports leads but sheet has 0, something is broken
    if (metaLeadCount > 0 && sheetLeadCount === 0) {
      return {
        status: 'fail',
        message: `Meta reports ${metaLeadCount} leads (last ${days}d) but sheet has 0. Spend: $${metaSpend.toFixed(2)}`,
      };
    }

    // Large discrepancy warning
    if (metaLeadCount > 0 && sheetLeadCount > 0) {
      const ratio = sheetLeadCount / metaLeadCount;
      if (ratio < 0.5) {
        return {
          status: 'warn',
          message: `Sheet has ${sheetLeadCount} leads vs Meta's ${metaLeadCount} (last ${days}d). Possible data gap.`,
        };
      }
    }

    // Spend but no leads anywhere
    if (metaSpend > 100 && metaLeadCount === 0 && sheetLeadCount === 0) {
      return {
        status: 'warn',
        message: `$${metaSpend.toFixed(2)} spent last ${days}d with 0 leads across both sources`,
      };
    }

    return {
      status: 'pass',
      message: `Sheet: ${sheetLeadCount} leads, Meta: ${metaLeadCount} leads, Spend: $${metaSpend.toFixed(2)} (last ${days}d)`,
    };
  } catch (err) {
    return { status: 'warn', message: `Sanity check error: ${err.message}` };
  }
}

/**
 * Check 4: Stale data — latest lead is old but ads are active
 */
async function checkStaleData(client, clientLeads) {
  if (!client.fbAdAccountId) return { status: 'skip', message: 'No ad account' };

  // Find most recent lead date
  const dates = clientLeads
    .map((l) => l.createdDate)
    .filter(Boolean)
    .sort();

  const latestLeadDate = dates.length > 0 ? dates[dates.length - 1] : null;

  // Check if ads are currently active
  try {
    const statusMap = await fetchMetaAdStatuses(client.fbAdAccountId);
    if (!statusMap) return { status: 'warn', message: 'Could not fetch ad statuses' };

    const activeCount = [...statusMap.values()].filter(
      (a) => a.effectiveStatus === 'ACTIVE'
    ).length;

    if (activeCount === 0) {
      return { status: 'pass', message: 'No active ads — stale check not applicable' };
    }

    if (!latestLeadDate) {
      return {
        status: 'warn',
        message: `${activeCount} active ads but no leads with valid dates in sheet`,
      };
    }

    const daysSinceLastLead = Math.floor(
      (Date.now() - new Date(latestLeadDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceLastLead > 7) {
      return {
        status: 'warn',
        message: `${activeCount} active ads but last lead was ${daysSinceLastLead} days ago (${latestLeadDate})`,
      };
    }

    return {
      status: 'pass',
      message: `${activeCount} active ads, last lead: ${latestLeadDate} (${daysSinceLastLead}d ago)`,
    };
  } catch (err) {
    return { status: 'warn', message: `Stale check error: ${err.message}` };
  }
}

/**
 * Check 5: Column schema — expected columns present in leads
 */
function checkSchema(clientLeads) {
  if (clientLeads.length === 0) {
    return { status: 'pass', message: 'No leads to check schema' };
  }

  const required = ['adName', 'campaignName', 'createdTime'];
  const sample = clientLeads[0];
  const missing = required.filter((col) => !(col in sample));

  if (missing.length > 0) {
    return {
      status: 'fail',
      message: `Missing expected fields: ${missing.join(', ')}`,
    };
  }

  return { status: 'pass', message: 'All expected fields present' };
}

/**
 * Run all health checks for all clients
 */
export async function GET() {
  const headers = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

  try {
    // Fetch all leads once (shared across clients)
    const rawLeads = await fetchAllLeads();
    const allLeads = processLeads(rawLeads);

    // Group leads by client
    const leadsByClient = {};
    allLeads.forEach((lead) => {
      const slug = lead.clientSlug;
      if (!leadsByClient[slug]) leadsByClient[slug] = [];
      leadsByClient[slug].push(lead);
    });

    // Run checks for each client
    const results = await Promise.all(
      clients
        .filter((c) => !c.isAgency)
        .map(async (client) => {
          const clientLeads = leadsByClient[client.slug] || [];
          const recentLeads = filterLeadsByDays(clientLeads, 7);

          const metaAccess = await checkMetaAccess(client);

          // If account is inactive, skip spend/lead checks — nothing to flag
          let leadSanity, staleData;
          if (metaAccess.inactive) {
            leadSanity = { status: 'skip', message: 'Account inactive' };
            staleData = { status: 'skip', message: 'Account inactive' };
          } else {
            [leadSanity, staleData] = await Promise.all([
              checkLeadCountSanity(client, recentLeads, 7),
              checkStaleData(client, clientLeads),
            ]);
          }

          const dateCheck = checkLeadDates(clientLeads);
          const schemaCheck = checkSchema(clientLeads);

          const checks = {
            metaAccess,
            leadDates: dateCheck,
            leadCountSanity: leadSanity,
            staleData,
            schema: schemaCheck,
          };

          // Overall status: worst of all checks
          const statuses = Object.values(checks).map((c) => c.status);
          let overall = 'pass';
          if (statuses.includes('warn')) overall = 'warn';
          if (statuses.includes('fail')) overall = 'fail';

          return {
            client: client.name,
            slug: client.slug,
            overall,
            totalLeads: clientLeads.length,
            recentLeads: recentLeads.length,
            checks,
          };
        })
    );

    // Overall health
    const overallStatuses = results.map((r) => r.overall);
    let systemStatus = 'healthy';
    if (overallStatuses.includes('warn')) systemStatus = 'degraded';
    if (overallStatuses.includes('fail')) systemStatus = 'unhealthy';

    return NextResponse.json(
      {
        status: systemStatus,
        checkedAt: new Date().toISOString(),
        clients: results,
      },
      { headers }
    );
  } catch (err) {
    return NextResponse.json(
      {
        status: 'error',
        checkedAt: new Date().toISOString(),
        error: err.message,
      },
      { status: 500, headers }
    );
  }
}
