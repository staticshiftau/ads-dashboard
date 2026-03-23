import { NextResponse } from 'next/server';
import { clients } from '@/lib/clients';
import {
  aggregateAds,
  getClientSummary,
} from '@/lib/sheets';
import {
  fetchMetaInsights,
  fetchMetaAdStatuses,
  applyMetaStatuses,
  getNewAdsFromMeta,
} from '@/lib/meta';

export const dynamic = 'force-dynamic';

const EMPTY_SUMMARY = {
  totalSpend: 0,
  totalLeads: 0,
  totalImpressions: 0,
  totalClicks: 0,
  totalLinkClicks: 0,
  cpl: 0,
  uniqueAds: 0,
  activeAds: 0,
  dateRange: null,
  totalRows: 0,
};

async function fetchClientAds(client, days, { since, until } = {}) {
  // Clients without a Meta ad account return empty data
  if (!client.fbAdAccountId) {
    return {
      client: { name: client.name, slug: client.slug },
      summary: { ...EMPTY_SUMMARY },
      ads: [],
      rawRows: [],
      metaStatus: 'no_account',
      metaFetchedAt: null,
    };
  }

  // Fetch insights and statuses from Meta in parallel
  const [rows, statusMap] = await Promise.all([
    fetchMetaInsights(client.fbAdAccountId, days, { since, until }),
    fetchMetaAdStatuses(client.fbAdAccountId),
  ]);

  if (!rows) {
    return {
      client: { name: client.name, slug: client.slug },
      summary: { ...EMPTY_SUMMARY },
      ads: [],
      rawRows: [],
      error: 'Failed to fetch from Meta API',
      metaStatus: 'error',
      metaFetchedAt: new Date().toISOString(),
    };
  }

  // Aggregate daily rows into per-ad summaries
  let ads = aggregateAds(rows);

  // Apply real statuses from Meta /ads endpoint (matched by ad_id)
  ads = applyMetaStatuses(ads, statusMap);

  // Add newly launched ads that have no insights data yet
  const existingAdIds = new Set(ads.map((a) => a.adId).filter(Boolean));
  const newAds = getNewAdsFromMeta(statusMap, existingAdIds);
  ads = [...ads, ...newAds];

  const summary = getClientSummary(rows);
  summary.activeAds = ads.filter((a) => a.status === 'ACTIVE').length;

  return {
    client: { name: client.name, slug: client.slug },
    summary,
    ads,
    rawRows: rows,
    metaStatus: 'ok',
    metaFetchedAt: new Date().toISOString(),
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('client');
  const since = searchParams.get('since');
  const until = searchParams.get('until');
  const days = parseInt(searchParams.get('days') || '30', 10);

  const headers = {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  };

  try {
    if (slug) {
      // Single client
      const client = clients.find((c) => c.slug === slug);
      if (!client) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404, headers: headers });
      }

      const result = await fetchClientAds(client, days, { since, until });
      return NextResponse.json(result, { headers: headers });
    }

    // All clients overview
    const results = await Promise.allSettled(
      clients.map((client) => fetchClientAds(client, days, { since, until }))
    );

    const data = results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      return {
        client: { name: clients[i].name, slug: clients[i].slug },
        summary: null,
        ads: [],
        error: r.reason?.message || 'Failed to fetch',
      };
    });

    return NextResponse.json(data, { headers: headers });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch data' },
      { status: 500, headers: headers }
    );
  }
}
