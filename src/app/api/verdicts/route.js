import { NextResponse } from 'next/server';
import { clients } from '@/lib/clients';
import { fetchMetaInsights, fetchMetaAdStatuses, fetchMetaCampaigns } from '@/lib/meta';
import {
  fetchAllLeadsWithStatus,
  processLeads,
  filterLeadsByDays,
  filterLeadsByDateRange,
} from '@/lib/leads';
import { readAllSettings } from '@/lib/settings';
import { buildCampaignReports } from '@/lib/verdict';

export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

/**
 * Campaign verdicts and warnings. One calculation, used by the client page
 * (any date range) and the overview cards (always the last 30 days).
 *
 * Read-only: every Meta call here is a GET.
 *
 * A source that fails to load produces a named state for that client. It is never
 * treated as "no leads", "no targets" or "all ads active".
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('client');
  const since = searchParams.get('since');
  const until = searchParams.get('until');
  const days = parseInt(searchParams.get('days') || '30', 10);
  const fresh = searchParams.get('fresh') === '1';

  const rangeDays =
    since && until
      ? Math.round((new Date(`${until}T00:00:00Z`) - new Date(`${since}T00:00:00Z`)) / 86400000) + 1
      : days;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' });

  const wanted = slug ? clients.filter((c) => c.slug === slug) : clients;
  if (slug && wanted.length === 0) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404, headers });
  }

  // Shared sources, loaded once.
  const [leadsResult, settingsResult] = await Promise.allSettled([
    fetchAllLeadsWithStatus(),
    readAllSettings(),
  ]);

  const results = await Promise.all(
    wanted.map(async (client) => {
      const base = { client: { name: client.name, slug: client.slug }, campaigns: [], warningCount: 0, unmatchedLeads: 0 };

      if (!client.fbAdAccountId) return { ...base, state: 'no_account' };

      if (settingsResult.status !== 'fulfilled') {
        return { ...base, state: 'targets_unavailable', message: settingsResult.reason?.message };
      }
      if (leadsResult.status !== 'fulfilled' || leadsResult.value.tabStatus[client.slug] !== 'ok') {
        return { ...base, state: 'leads_unavailable' };
      }

      const [rows, statusMap, campaignsMeta] = await Promise.all([
        fetchMetaInsights(client.fbAdAccountId, days, { since, until, campaignFilter: client.metaCampaignFilter }),
        fetchMetaAdStatuses(client.fbAdAccountId, client.metaCampaignFilter, { fresh }),
        fetchMetaCampaigns(client.fbAdAccountId, { fresh }),
      ]);
      if (!rows || !campaignsMeta) return { ...base, state: 'meta_unavailable' };

      let leads = processLeads(leadsResult.value.leads).filter((l) => l.clientSlug === client.slug);
      leads = since && until ? filterLeadsByDateRange(leads, since, until) : filterLeadsByDays(leads, days);

      // Every ad here carries the status Meta itself reported for that ad id.
      const ads = statusMap
        ? [...statusMap.entries()].map(([adId, info]) => ({
            adId,
            adName: info.name,
            campaignId: info.campaignId,
            status: info.effectiveStatus,
            statusKnown: true,
          }))
        : [];

      const targets = settingsResult.value[client.slug] || {};
      const report = buildCampaignReports({
        rows,
        ads,
        leads,
        campaignsMeta,
        targets,
        rangeDays,
        today,
        statusOk: !!statusMap,
        accountId: client.fbAdAccountId,
      });

      return { ...base, state: 'ok', targets, rangeDays, ...report };
    })
  );

  return NextResponse.json(slug ? results[0] : results, { headers });
}
