import { NextResponse } from 'next/server';
import { clients } from '@/lib/clients';
import {
  fetchSheetData,
  aggregateAds,
  getClientSummary,
  getLastNDays,
} from '@/lib/sheets';
import { fetchMetaAdStatuses, mergeMetaStatuses } from '@/lib/meta';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('client');
  const days = parseInt(searchParams.get('days') || '30', 10);

  const cacheHeaders = {
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
  };

  try {
    if (slug) {
      // Single client
      const client = clients.find((c) => c.slug === slug);
      if (!client) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 });
      }

      // Clients without an ad performance sheet (e.g. Static Shift)
      // return empty ad data — their pipeline data comes from /api/leads
      if (!client.sheetId) {
        return NextResponse.json({
          client: { name: client.name, slug: client.slug },
          summary: {
            totalSpend: 0,
            totalLeads: 0,
            totalImpressions: 0,
            totalClicks: 0,
            totalLinkClicks: 0,
            cpl: 0,
            uniqueAds: 0,
            dateRange: null,
            totalRows: 0,
          },
          ads: [],
          rawRows: [],
        }, { headers: cacheHeaders });
      }

      // Fetch sheet data and Meta statuses in parallel
      const [rows, metaStatusMap] = await Promise.all([
        fetchSheetData(client.sheetId, client.sheetTab),
        client.fbAdAccountId
          ? fetchMetaAdStatuses(client.fbAdAccountId)
          : Promise.resolve(null),
      ]);

      const recent = getLastNDays(rows, days);
      let ads = aggregateAds(recent);
      ads = mergeMetaStatuses(ads, metaStatusMap);
      const summary = getClientSummary(recent);
      summary.activeAds = ads.filter((a) => a.status === 'ACTIVE').length;

      return NextResponse.json({
        client: { name: client.name, slug: client.slug },
        summary,
        ads,
        rawRows: recent,
      }, { headers: cacheHeaders });
    }

    // All clients overview
    const results = await Promise.allSettled(
      clients.map(async (client) => {
        // Skip clients without ad performance sheets
        if (!client.sheetId) {
          return {
            client: { name: client.name, slug: client.slug },
            summary: null,
            ads: [],
          };
        }

        const [rows, metaStatusMap] = await Promise.all([
          fetchSheetData(client.sheetId, client.sheetTab),
          client.fbAdAccountId
            ? fetchMetaAdStatuses(client.fbAdAccountId)
            : Promise.resolve(null),
        ]);

        const recent = getLastNDays(rows, days);
        let ads = aggregateAds(recent);
        ads = mergeMetaStatuses(ads, metaStatusMap);
        const summary = getClientSummary(recent);
        summary.activeAds = ads.filter((a) => a.status === 'ACTIVE').length;

        return {
          client: { name: client.name, slug: client.slug },
          summary,
          ads,
        };
      })
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

    return NextResponse.json(data, { headers: cacheHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch data' },
      { status: 500 }
    );
  }
}
