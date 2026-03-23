'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { getClient } from '@/lib/clients';
import MetricCard from '@/components/MetricCard';
import AdTable from '@/components/AdTable';
import CampaignTable from '@/components/CampaignTable';
import SpendLeadsChart from '@/components/SpendLeadsChart';
import PipelineFunnel from '@/components/PipelineFunnel';
import LeadsTable from '@/components/LeadsTable';
import LeadsMeetingsChart from '@/components/LeadsMeetingsChart';

export default function ClientPage({ params }) {
  const { slug } = use(params);
  const clientConfig = getClient(slug);
  const clientName = clientConfig?.name || slug;

  const [data, setData] = useState(null);
  const [leadsData, setLeadsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(30);
  const [view, setView] = useState('overview'); // 'overview' | 'campaigns' | 'pipeline' | 'ads'
  const [qualFilter, setQualFilter] = useState('all'); // 'all' | 'qualified' | 'non-qualified'
  const [lastUpdated, setLastUpdated] = useState(null);

  // Custom date range
  const [dateMode, setDateMode] = useState('preset'); // 'preset' | 'custom'
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  useEffect(() => {
    fetchData();
  }, [slug, days, dateMode, customFrom, customTo]);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const t = Date.now();
      let params = `client=${slug}&t=${t}`;
      if (dateMode === 'custom' && customFrom && customTo) {
        params += `&since=${customFrom}&until=${customTo}`;
      } else {
        params += `&days=${days}`;
      }

      const [adsRes, leadsRes] = await Promise.all([
        fetch(`/api/campaigns?${params}`, { cache: 'no-store' }),
        fetch(`/api/leads?${params}`, { cache: 'no-store' }),
      ]);

      if (!adsRes.ok) throw new Error('Failed to fetch ads data');
      const adsJson = await adsRes.json();
      setData(adsJson);

      if (leadsRes.ok) {
        const leadsJson = await leadsRes.json();
        setLeadsData(leadsJson);
      }
      setLastUpdated(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const summary = data?.summary;
  const rawAds = data?.ads || [];
  const rawRows = data?.rawRows || [];
  const pipeline = leadsData?.pipeline;
  const leads = leadsData?.leads || [];
  const adPipelineStats = leadsData?.adPipelineStats || {};

  // Build ad-name-to-campaign lookup from Meta ads (source of truth for campaign assignment)
  const adToCampaign = {};
  rawAds.forEach((ad) => {
    if (ad.adName && ad.campaignName) {
      adToCampaign[ad.adName] = ad.campaignName;
    }
  });

  // Build campaign pipeline stats locally, using Meta's ad-to-campaign mapping
  // to assign campaigns to leads that have ad_name but no campaign_name
  const campaignPipelineStats = {};
  leads.forEach((lead) => {
    let campaignName = lead.campaignName;
    if (!campaignName && lead.adName) {
      campaignName = adToCampaign[lead.adName] || '';
    }
    campaignName = campaignName || 'Unknown';
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

  // Build per-ad pipeline stats locally using Meta's ad-to-campaign mapping
  // This correctly assigns leads that have ad_name but no campaign_name
  const localAdStats = {};
  leads.forEach((lead) => {
    const adName = lead.adName || 'Unknown';
    // Use Meta's mapping to resolve campaign for leads missing campaign_name
    let campaignName = lead.campaignName || adToCampaign[adName] || 'Unknown';
    const key = `${campaignName}|||${adName}`;
    if (!localAdStats[key]) {
      localAdStats[key] = {
        adName,
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
    localAdStats[key].leads++;
    if (lead.qualified) localAdStats[key].qualifiedLeads++;
    if (lead.pickedUp) localAdStats[key].pickedUp++;
    if (lead.meetingBooked) localAdStats[key].meetingsBooked++;
    if (lead.qualifiedMeeting) localAdStats[key].qualifiedMeetings++;
    if (lead.strategyCall) localAdStats[key].strategyCalls++;
    if (lead.closed) localAdStats[key].closed++;
  });

  const ads = rawAds.map((ad) => {
    const key = `${ad.campaignName || 'Unknown'}|||${ad.adName || 'Unknown'}`;
    const stats = localAdStats[key] || {};
    return {
      ...ad,
      meetings: stats.meetingsBooked || 0,
      qualifiedMeetings: stats.qualifiedMeetings || 0,
      qualifiedLeads: stats.qualifiedLeads || 0,
      strategyCalls: stats.strategyCalls || 0,
      closed: stats.closed || 0,
      costPerMeeting:
        stats.qualifiedMeetings > 0 ? ad.totalSpend / stats.qualifiedMeetings : 0,
    };
  });

  // Split ads into performing vs not
  const leadAds = ads.filter((a) => a.totalLeads > 0);
  const zeroLeadAds = ads.filter((a) => a.totalLeads === 0 && a.totalSpend > 0);

  // Apply qualified filter to leads
  const filteredLeads = leads.filter((l) => {
    if (qualFilter === 'qualified') return l.qualified;
    if (qualFilter === 'non-qualified') return !l.qualified;
    return true;
  });

  // Recalculate pipeline for filtered leads
  const filteredPipeline =
    qualFilter === 'all'
      ? pipeline
      : filteredLeads.length > 0
        ? {
            total: filteredLeads.length,
            qualifiedLeads: filteredLeads.filter((l) => l.qualified).length,
            pickedUp: filteredLeads.filter((l) => l.pickedUp).length,
            meetingsBooked: filteredLeads.filter((l) => l.meetingBooked).length,
            qualifiedMeetings: filteredLeads.filter((l) => l.qualifiedMeeting).length,
            unqualifiedMeetings: filteredLeads.filter((l) => l.meetingBooked && !l.qualifiedMeeting).length,
            strategyCalls: filteredLeads.filter((l) => l.strategyCall).length,
            followUps: filteredLeads.filter((l) => l.followUp).length,
            closed: filteredLeads.filter((l) => l.closed).length,
          }
        : { total: 0, qualifiedLeads: 0, pickedUp: 0, meetingsBooked: 0, qualifiedMeetings: 0, unqualifiedMeetings: 0, strategyCalls: 0, followUps: 0, closed: 0 };

  // Date display
  const dateRangeLabel = (() => {
    if (dateMode === 'custom' && customFrom && customTo) {
      const fmt = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${fmt(customFrom)} – ${fmt(customTo)} · Custom range`;
    }
    if (summary?.dateRange) {
      return `Data from ${summary.dateRange.from} to ${summary.dateRange.to}`;
    }
    return null;
  })();

  // Qualified filter component
  const QualFilter = () => (
    <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
      {[
        { label: 'All', value: 'all' },
        { label: 'Qualified', value: 'qualified' },
        { label: 'Non-Qualified', value: 'non-qualified' },
      ].map((opt) => (
        <button
          key={opt.value}
          onClick={() => setQualFilter(opt.value)}
          className="px-3 py-1.5 text-xs font-medium transition-colors"
          style={{
            background: qualFilter === opt.value ? 'var(--color-accent)' : 'transparent',
            color: qualFilter === opt.value ? 'white' : 'var(--color-text-muted)',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  return (
    <div>
      {/* Breadcrumb + Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <Link
            href="/"
            className="text-xs flex items-center gap-1 mb-2 hover:underline"
            style={{ color: 'var(--color-accent-light)' }}
          >
            &larr; All Clients
          </Link>
          <h1 className="text-xl font-bold tracking-tight">
            {clientName}
          </h1>
          {dateRangeLabel && (
            <p
              className="text-xs mt-1"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {dateRangeLabel}
            </p>
          )}
          {lastUpdated && (
            <p
              className="text-xs mt-0.5"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Last updated: {lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Preset time range */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
            {[
              { label: '3d', value: 3 },
              { label: '7d', value: 7 },
              { label: '14d', value: 14 },
              { label: '30d', value: 30 },
              { label: '90d', value: 90 },
              { label: 'All', value: 365 },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setDateMode('preset');
                  setDays(opt.value);
                }}
                className="px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  background:
                    dateMode === 'preset' && days === opt.value ? 'var(--color-accent)' : 'transparent',
                  color:
                    dateMode === 'preset' && days === opt.value ? 'white' : 'var(--color-text-muted)',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Custom date range */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => {
                setCustomFrom(e.target.value);
                if (e.target.value && customTo) setDateMode('custom');
              }}
              className="px-2 py-1.5 text-xs rounded-lg cursor-pointer"
              style={{
                background: 'var(--color-bg-card)',
                border: `1px solid ${dateMode === 'custom' ? 'var(--color-accent)' : 'var(--color-border)'}`,
                color: 'var(--color-text)',
                outline: 'none',
                colorScheme: 'dark',
              }}
            />
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => {
                setCustomTo(e.target.value);
                if (customFrom && e.target.value) setDateMode('custom');
              }}
              className="px-2 py-1.5 text-xs rounded-lg cursor-pointer"
              style={{
                background: 'var(--color-bg-card)',
                border: `1px solid ${dateMode === 'custom' ? 'var(--color-accent)' : 'var(--color-border)'}`,
                color: 'var(--color-text)',
                outline: 'none',
                colorScheme: 'dark',
              }}
            />
          </div>

          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
            {[
              { label: 'Overview', value: 'overview' },
              { label: 'Campaigns', value: 'campaigns' },
              { label: 'Pipeline', value: 'pipeline' },
              { label: 'All Ads', value: 'ads' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setView(opt.value)}
                className="px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  background: view === opt.value ? 'var(--color-accent)' : 'transparent',
                  color: view === opt.value ? 'white' : 'var(--color-text-muted)',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            onClick={fetchData}
            className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
            style={{
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-muted)',
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="loading-pulse text-lg mb-2">Loading...</div>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div
          className="glass-card p-6 text-center"
          style={{ borderColor: 'var(--color-red)' }}
        >
          <div className="text-sm mb-2" style={{ color: 'var(--color-red)' }}>
            {error}
          </div>
          <button
            onClick={fetchData}
            className="px-4 py-2 text-xs font-medium rounded-lg mt-2 transition-colors"
            style={{
              background: 'var(--color-accent)',
              color: 'white',
            }}
          >
            Try Again
          </button>
        </div>
      )}

      {/* Data */}
      {!loading && !error && data && (
        <>
          {/* Metric Cards — always visible */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
            <MetricCard
              label="Total Spend"
              value={`$${summary?.totalSpend?.toFixed(2) || '0'}`}
            />
            <MetricCard
              label="Qualified Leads"
              value={pipeline?.qualifiedLeads || 0}
              subtext={`${pipeline?.total || 0} total`}
              color={
                pipeline?.qualifiedLeads > 0
                  ? 'var(--color-green)'
                  : 'var(--color-red)'
              }
            />
            <MetricCard
              label="CPL (Qualified)"
              value={pipeline?.qualifiedLeads > 0 && summary?.totalSpend > 0 ? `$${(summary.totalSpend / pipeline.qualifiedLeads).toFixed(2)}` : '-'}
            />
            <MetricCard
              label="Qualified Meetings"
              value={pipeline?.qualifiedMeetings || 0}
              subtext={`${pipeline?.meetingsBooked || 0} total booked`}
              color={
                pipeline?.qualifiedMeetings > 0
                  ? 'var(--color-orange)'
                  : 'var(--color-text-muted)'
              }
            />
            <MetricCard
              label="Cost / Meeting"
              value={
                pipeline?.qualifiedMeetings > 0 && summary?.totalSpend > 0
                  ? `$${(summary.totalSpend / pipeline.qualifiedMeetings).toFixed(2)}`
                  : '-'
              }
              color="var(--color-orange)"
            />
            <MetricCard
              label="Link Clicks"
              value={summary?.totalLinkClicks?.toLocaleString() || 0}
            />
            <MetricCard
              label="Impressions"
              value={summary?.totalImpressions?.toLocaleString() || 0}
            />
            <MetricCard
              label="Active Ads"
              value={summary?.activeAds ?? summary?.uniqueAds ?? 0}
              subtext={
                zeroLeadAds.length > 0
                  ? `${zeroLeadAds.length} need attention`
                  : undefined
              }
            />
          </div>

          {/* Overview View — original layout */}
          {view === 'overview' && (
            <>
              {/* Pipeline Funnel + Ad Status side by side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                <PipelineFunnel
                  pipeline={pipeline}
                  totalSpend={summary?.totalSpend}
                />
                <div className="grid grid-cols-1 gap-4">
                  {/* Ads Getting Leads */}
                  <div
                    className="glass-card p-4"
                    style={{
                      borderColor:
                        leadAds.length > 0
                          ? 'rgba(34,197,94,0.3)'
                          : 'var(--color-border)',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: 'var(--color-green)' }}
                      />
                      <h3 className="text-sm font-semibold">
                        Generating Leads ({leadAds.length})
                      </h3>
                    </div>
                    {leadAds.length > 0 ? (
                      <div className="space-y-2">
                        {leadAds.map((ad, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between text-xs p-2 rounded"
                            style={{ background: 'rgba(34,197,94,0.08)' }}
                          >
                            <span className="truncate max-w-[200px]">
                              {ad.adName}
                            </span>
                            <div className="flex items-center gap-3">
                              <span style={{ color: 'var(--color-green)' }}>
                                {ad.totalLeads} leads
                              </span>
                              {ad.meetings > 0 && (
                                <span style={{ color: 'var(--color-orange)' }}>
                                  {ad.meetings} meetings
                                </span>
                              )}
                              <span style={{ color: 'var(--color-text-muted)' }}>
                                ${ad.cpl.toFixed(2)} CPL
                              </span>
                              {ad.costPerMeeting > 0 && (
                                <span style={{ color: 'var(--color-text-muted)' }}>
                                  ${ad.costPerMeeting.toFixed(0)}/mtg
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div
                        className="text-xs py-3"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        No ads generating leads in this period
                      </div>
                    )}
                  </div>

                  {/* Ads Needing Attention */}
                  <div
                    className="glass-card p-4"
                    style={{
                      borderColor:
                        zeroLeadAds.length > 0
                          ? 'rgba(239,68,68,0.3)'
                          : 'var(--color-border)',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: 'var(--color-red)' }}
                      />
                      <h3 className="text-sm font-semibold">
                        Need Replacement ({zeroLeadAds.length})
                      </h3>
                    </div>
                    {zeroLeadAds.length > 0 ? (
                      <div className="space-y-2">
                        {zeroLeadAds
                          .sort((a, b) => b.totalSpend - a.totalSpend)
                          .map((ad, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between text-xs p-2 rounded"
                              style={{ background: 'rgba(239,68,68,0.08)' }}
                            >
                              <span className="truncate max-w-[200px]">
                                {ad.adName}
                              </span>
                              <div className="flex items-center gap-3">
                                <span style={{ color: 'var(--color-red)' }}>
                                  0 leads
                                </span>
                                <span style={{ color: 'var(--color-text-muted)' }}>
                                  ${ad.totalSpend.toFixed(2)} spent
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div
                        className="text-xs py-3"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        All ads are generating leads
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Campaigns */}
              <div className="mb-6">
                <div className="mb-3">
                  <h2 className="text-sm font-semibold">Campaigns</h2>
                  <span
                    className="text-xs"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    Grouped by campaign · Click to expand ads
                  </span>
                </div>
                <CampaignTable ads={ads} campaignPipelineStats={campaignPipelineStats} />
              </div>

              {/* Chart */}
              <div className="mb-6">
                <SpendLeadsChart rawRows={rawRows} />
              </div>
            </>
          )}

          {/* Campaigns View */}
          {view === 'campaigns' && (
            <div>
              <div className="mb-3">
                <h2 className="text-sm font-semibold">Campaigns</h2>
                <span
                  className="text-xs"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Grouped by campaign · Click to expand ads
                </span>
              </div>
              <CampaignTable ads={ads} campaignPipelineStats={campaignPipelineStats} />
            </div>
          )}

          {/* Pipeline View */}
          {view === 'pipeline' && (
            <div>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <h2 className="text-sm font-semibold">Sales Pipeline</h2>
                <QualFilter />
              </div>
              <div className="mb-6">
                <PipelineFunnel
                  pipeline={filteredPipeline}
                  totalSpend={summary?.totalSpend}
                />
              </div>

              {/* Leads vs Meetings Chart */}
              <div className="mb-6">
                <LeadsMeetingsChart leads={leads} />
              </div>

              <div className="mb-3">
                <h2 className="text-sm font-semibold">
                  Leads ({filteredLeads.length})
                </h2>
              </div>
              <LeadsTable leads={filteredLeads} />
            </div>
          )}

          {/* All Ads View */}
          {view === 'ads' && (
            <div>
              <div className="mb-3">
                <h2 className="text-sm font-semibold">All Ads Performance</h2>
                <span
                  className="text-xs"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {ads.length} ads total | Click headers to sort
                </span>
              </div>
              <AdTable ads={ads} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
