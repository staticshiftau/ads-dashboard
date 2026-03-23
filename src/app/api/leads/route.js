import { NextResponse } from 'next/server';
import {
  fetchAllLeads,
  processLeads,
  getPipelineSummary,
  filterLeadsByDays,
  filterLeadsByDateRange,
} from '@/lib/leads';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('client'); // optional: filter by client
  const since = searchParams.get('since');
  const until = searchParams.get('until');
  const days = parseInt(searchParams.get('days') || '30', 10);

  const headers = {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  };

  try {
    // 1. Fetch all leads from tracker sheets (each tab is tagged with clientSlug)
    const rawLeads = await fetchAllLeads();

    // 2. Process leads (clientSlug comes from sheet tab config)
    let leads = processLeads(rawLeads);

    // 4. Filter by date range
    if (since && until) {
      leads = filterLeadsByDateRange(leads, since, until);
    } else {
      leads = filterLeadsByDays(leads, days);
    }

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

    // 8. Per-ad pipeline breakdown (keyed by ad name — sheet is source of truth)
    const adPipelineStats = {};
    leads.forEach((lead) => {
      const adName = lead.adName || 'Unknown';
      if (!adPipelineStats[adName]) {
        adPipelineStats[adName] = {
          adName,
          campaignName: lead.campaignName || '',
          adSetName: lead.adSetName || '',
          leads: 0,
          qualifiedLeads: 0,
          pickedUp: 0,
          meetingsBooked: 0,
          qualifiedMeetings: 0,
          strategyCalls: 0,
          closed: 0,
        };
      }
      adPipelineStats[adName].leads++;
      if (lead.qualified) adPipelineStats[adName].qualifiedLeads++;
      if (lead.pickedUp) adPipelineStats[adName].pickedUp++;
      if (lead.meetingBooked) adPipelineStats[adName].meetingsBooked++;
      if (lead.qualifiedMeeting) adPipelineStats[adName].qualifiedMeetings++;
      if (lead.strategyCall) adPipelineStats[adName].strategyCalls++;
      if (lead.closed) adPipelineStats[adName].closed++;
    });

    // 9. Per-campaign pipeline breakdown (directly from leads, no ad-name matching needed)
    const campaignPipelineStats = {};
    leads.forEach((lead) => {
      const campaignName = lead.campaignName || 'Unknown';
      if (!campaignPipelineStats[campaignName]) {
        campaignPipelineStats[campaignName] = {
          campaignName,
          leads: 0,
          qualifiedLeads: 0,
          pickedUp: 0,
          meetingsBooked: 0,
          qualifiedMeetings: 0,
          strategyCalls: 0,
          closed: 0,
        };
      }
      campaignPipelineStats[campaignName].leads++;
      if (lead.qualified) campaignPipelineStats[campaignName].qualifiedLeads++;
      if (lead.pickedUp) campaignPipelineStats[campaignName].pickedUp++;
      if (lead.meetingBooked) campaignPipelineStats[campaignName].meetingsBooked++;
      if (lead.qualifiedMeeting) campaignPipelineStats[campaignName].qualifiedMeetings++;
      if (lead.strategyCall) campaignPipelineStats[campaignName].strategyCalls++;
      if (lead.closed) campaignPipelineStats[campaignName].closed++;
    });

    return NextResponse.json({
      leads,
      pipeline,
      clientPipelines,
      adPipelineStats,
      campaignPipelineStats,
      totalLeads: leads.length,
    }, { headers: headers });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch leads data' },
      { status: 500, headers: headers }
    );
  }
}
