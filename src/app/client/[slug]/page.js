'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { getClient } from '@/lib/clients';
import MetricCard from '@/components/MetricCard';
import AdTable from '@/components/AdTable';
import SpendLeadsChart from '@/components/SpendLeadsChart';
import PipelineFunnel from '@/components/PipelineFunnel';
import LeadsTable from '@/components/LeadsTable';

export default function ClientPage({ params }) {
  const { slug } = use(params);
  const clientConfig = getClient(slug);
  const clientName = clientConfig?.name || slug;

  const [data, setData] = useState(null);
  const [leadsData, setLeadsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetchData();
  }, [slug, days]);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const [adsRes, leadsRes] = await Promise.all([
        fetch(`/api/ads?client=${slug}&days=${days}`, { cache: 'no-cache' }),
        fetch(`/api/leads?client=${slug}&days=${days}`, { cache: 'no-cache' }),
      ]);

      if (!adsRes.ok) throw new Error('Failed to fetch ads data');
      const adsJson = await adsRes.json();
      setData(adsJson);

      if (leadsRes.ok) {
        const leadsJson = await leadsRes.json();
        setLeadsData(leadsJson);
      }
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

  // Enrich ads with pipeline data (meetings, calls, closes per ad)
  const ads = rawAds.map((ad) => {
    const stats = adPipelineStats[ad.adName] || {};
    return {
      ...ad,
      meetings: stats.meetingsBooked || 0,
      strategyCalls: stats.strategyCalls || 0,
      closed: stats.closed || 0,
      costPerMeeting:
        stats.meetingsBooked > 0 ? ad.totalSpend / stats.meetingsBooked : 0,
    };
  });

  // Split ads into performing vs not
  const leadAds = ads.filter((a) => a.totalLeads > 0);
  const zeroLeadAds = ads.filter((a) => a.totalLeads === 0 && a.totalSpend > 0);

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
          {summary?.dateRange && (
            <p
              className="text-xs mt-1"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Data from {summary.dateRange.from} to {summary.dateRange.to}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
            {[
              { label: '7d', value: 7 },
              { label: '14d', value: 14 },
              { label: '30d', value: 30 },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                className="px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  background:
                    days === opt.value ? 'var(--color-accent)' : 'transparent',
                  color:
                    days === opt.value ? 'white' : 'var(--color-text-muted)',
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
          {/* Metric Cards - includes pipeline metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
            <MetricCard
              label="Total Spend"
              value={`$${summary?.totalSpend?.toFixed(2) || '0'}`}
            />
            <MetricCard
              label="Leads"
              value={summary?.totalLeads || 0}
              color={
                summary?.totalLeads > 0
                  ? 'var(--color-green)'
                  : 'var(--color-red)'
              }
            />
            <MetricCard
              label="CPL"
              value={summary?.cpl > 0 ? `$${summary.cpl.toFixed(2)}` : '-'}
            />
            <MetricCard
              label="Meetings Booked"
              value={pipeline?.meetingsBooked || 0}
              color={
                pipeline?.meetingsBooked > 0
                  ? 'var(--color-orange)'
                  : 'var(--color-text-muted)'
              }
            />
            <MetricCard
              label="Cost / Meeting"
              value={
                pipeline?.meetingsBooked > 0 && summary?.totalSpend > 0
                  ? `$${(summary.totalSpend / pipeline.meetingsBooked).toFixed(2)}`
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

          {/* Pipeline Funnel + Lead Status side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* Pipeline Funnel */}
            <PipelineFunnel
              pipeline={pipeline}
              totalSpend={summary?.totalSpend}
            />

            {/* Ads Performance Summary */}
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

          {/* Chart */}
          <div className="mb-6">
            <SpendLeadsChart rawRows={rawRows} />
          </div>

          {/* Leads Pipeline Table */}
          {leads.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold mb-3">
                Leads Pipeline ({leads.length})
              </h2>
              <LeadsTable leads={leads} />
            </div>
          )}

          {/* Full Ad Table */}
          <div>
            <h2 className="text-sm font-semibold mb-3">
              All Ads Performance
            </h2>
            <AdTable ads={ads} />
          </div>
        </>
      )}
    </div>
  );
}
