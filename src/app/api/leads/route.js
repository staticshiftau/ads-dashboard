import { NextResponse } from 'next/server';
import { clients } from '@/lib/clients';
import { fetchSheetData } from '@/lib/sheets';
import {
  fetchAllLeads,
  processLeads,
  getPipelineSummary,
  filterLeadsByDays,
} from '@/lib/leads';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('client'); // optional: filter by client
  const days = parseInt(searchParams.get('days') || '30', 10);

  try {
    // 1. Fetch all leads from tracker sheets
    const rawLeads = await fetchAllLeads();

    // 2. Build a map of client slug -> { adNames, campaignNames, adSetNames }
    //    Only for clients that have ad performance sheets
    const clientsWithSheets = clients.filter((c) => c.sheetId);
    const clientAdsResults = await Promise.allSettled(
      clientsWithSheets.map(async (client) => {
        const rows = await fetchSheetData(client.sheetId, client.sheetTab);
        return {
          slug: client.slug,
          adNames: [...new Set(rows.map((r) => r['Ad Name']).filter(Boolean))],
          campaignNames: [...new Set(rows.map((r) => r['Campaign Name']).filter(Boolean))],
          adSetNames: [...new Set(rows.map((r) => r['Ad Set Name']).filter(Boolean))],
        };
      })
    );

    const clientDataMap = {};
    clientAdsResults.forEach((r) => {
      if (r.status === 'fulfilled') {
        clientDataMap[r.value.slug] = r.value;
      }
    });

    // 3. Process and match leads to clients
    //    Unmatched leads default to 'static-shift' (SS's own ads)
    let leads = processLeads(rawLeads, clientDataMap);

    // 4. Filter by date range
    leads = filterLeadsByDays(leads, days);

    // 5. Filter by client if requested
    if (slug) {
      leads = leads.filter((l) => l.clientSlug === slug);
    }

    // 6. Build pipeline summary
    const pipeline = getPipelineSummary(leads);

    // 7. Per-client breakdown
    const byClient = {};
    leads.forEach((lead) => {
      const cs = lead.clientSlug;
      if (!byClient[cs]) byClient[cs] = [];
      byClient[cs].push(lead);
    });

    const clientPipelines = {};
    Object.entries(byClient).forEach(([cs, clientLeads]) => {
      clientPipelines[cs] = {
        pipeline: getPipelineSummary(clientLeads),
        leadCount: clientLeads.length,
      };
    });

    return NextResponse.json({
      leads,
      pipeline,
      clientPipelines,
      totalLeads: leads.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch leads data' },
      { status: 500 }
    );
  }
}
