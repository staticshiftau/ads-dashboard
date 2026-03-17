'use client';

import { useState, useEffect } from 'react';
import { clients } from '@/lib/clients';
import ClientCard from '@/components/ClientCard';
import AdTable from '@/components/AdTable';
import PipelineFunnel from '@/components/PipelineFunnel';
import LeadsTable from '@/components/LeadsTable';

export default function Home() {
  const [data, setData] = useState(null);
  const [leadsData, setLeadsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('overview'); // 'overview' | 'comparison' | 'pipeline'
  const [days, setDays] = useState(30);
  const [filterClient, setFilterClient] = useState('all'); // 'all' or a client slug

  useEffect(() => {
    fetchData();
  }, [days]);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const t = Date.now();
      const [adsRes, leadsRes] = await Promise.all([
        fetch(`/api/ads?days=${days}&t=${t}`, { cache: 'no-store' }),
        fetch(`/api/leads?days=${days}&t=${t}`, { cache: 'no-store' }),
      ]);
      if (!adsRes.ok) throw new Error('Failed to fetch');
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

  // Per-ad pipeline stats from leads data
  const adPipelineStats = leadsData?.adPipelineStats || {};

  // Combine all ads across clients for comparison view, enriched with pipeline data
  const allAds =
    data?.flatMap(
      (d) =>
        d.ads?.map((ad) => {
          const stats = adPipelineStats[ad.adName] || {};
          return {
            ...ad,
            clientName: d.client.name,
            clientSlug: d.client.slug,
            meetings: stats.meetingsBooked || 0,
            strategyCalls: stats.strategyCalls || 0,
            closed: stats.closed || 0,
            costPerMeeting:
              stats.meetingsBooked > 0 ? ad.totalSpend / stats.meetingsBooked : 0,
          };
        }) || []
    ) || [];

  // Filter ads by selected client
  const filteredAds =
    filterClient === 'all'
      ? allAds
      : allAds.filter((ad) => ad.clientSlug === filterClient);

  // Summary totals across all clients (always show full totals in summary bar)
  const totals = data
    ? data.reduce(
        (acc, d) => {
          if (!d.summary) return acc;
          acc.spend += d.summary.totalSpend;
          acc.leads += d.summary.totalLeads;
          acc.impressions += d.summary.totalImpressions;
          acc.linkClicks += d.summary.totalLinkClicks;
          return acc;
        },
        { spend: 0, leads: 0, impressions: 0, linkClicks: 0 }
      )
    : null;

  const pipeline = leadsData?.pipeline;
  const leads = leadsData?.leads || [];

  // Filter leads by client
  const filteredLeads =
    filterClient === 'all'
      ? leads
      : leads.filter((l) => l.clientSlug === filterClient);

  // Recalculate pipeline for filtered leads
  const filteredPipeline =
    filterClient === 'all'
      ? pipeline
      : filteredLeads.length > 0
        ? {
            total: filteredLeads.length,
            pickedUp: filteredLeads.filter((l) => l.pickedUp).length,
            meetingsBooked: filteredLeads.filter((l) => l.meetingBooked).length,
            strategyCalls: filteredLeads.filter((l) => l.strategyCall).length,
            followUps: filteredLeads.filter((l) => l.followUp).length,
            closed: filteredLeads.filter((l) => l.closed).length,
          }
        : { total: 0, pickedUp: 0, meetingsBooked: 0, strategyCalls: 0, followUps: 0, closed: 0 };

  // Client filter dropdown component
  const ClientFilter = () => (
    <select
      value={filterClient}
      onChange={(e) => setFilterClient(e.target.value)}
      className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer"
      style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        color: filterClient === 'all' ? 'var(--color-text-muted)' : 'var(--color-accent-light)',
        outline: 'none',
      }}
    >
      <option value="all">All Clients</option>
      {clients.map((c) => (
        <option key={c.slug} value={c.slug}>
          {c.name}
        </option>
      ))}
    </select>
  );

  return (
    <div>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            All Clients Overview
          </h1>
          <p
            className="text-xs mt-1"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {(() => {
              const end = new Date();
              const start = new Date();
              start.setDate(start.getDate() - days);
              const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              return `${fmt(start)} – ${fmt(end)} · Last ${days} days`;
            })()}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Time range selector */}
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
                onClick={() => setDays(opt.value)}
                className="px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  background:
                    days === opt.value
                      ? 'var(--color-accent)'
                      : 'transparent',
                  color:
                    days === opt.value
                      ? 'white'
                      : 'var(--color-text-muted)',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
            {[
              { label: 'Clients', value: 'overview' },
              { label: 'Pipeline', value: 'pipeline' },
              { label: 'All Ads', value: 'comparison' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setView(opt.value)}
                className="px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  background:
                    view === opt.value
                      ? 'var(--color-accent)'
                      : 'transparent',
                  color:
                    view === opt.value
                      ? 'white'
                      : 'var(--color-text-muted)',
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

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="loading-pulse text-lg mb-2">Loading...</div>
          <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Fetching ad performance data
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div
          className="glass-card p-6 text-center"
          style={{ borderColor: 'var(--color-red)' }}
        >
          <div className="text-sm mb-2" style={{ color: 'var(--color-red)' }}>
            Failed to load data
          </div>
          <div className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
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

      {/* Data loaded */}
      {!loading && !error && data && (
        <>
          {/* Summary Bar — Meetings first (what matters most) */}
          {totals && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
              <div className="glass-card p-4" style={{ border: '1px solid rgba(249,115,22,0.3)' }}>
                <div
                  className="text-[10px] uppercase tracking-wider font-semibold mb-1"
                  style={{ color: 'var(--color-orange)' }}
                >
                  Meetings Booked
                </div>
                <div
                  className="text-xl font-bold"
                  style={{
                    color:
                      pipeline?.meetingsBooked > 0
                        ? 'var(--color-orange)'
                        : 'var(--color-text-muted)',
                  }}
                >
                  {pipeline?.meetingsBooked || 0}
                </div>
              </div>
              <div className="glass-card p-4" style={{ border: '1px solid rgba(249,115,22,0.3)' }}>
                <div
                  className="text-[10px] uppercase tracking-wider font-semibold mb-1"
                  style={{ color: 'var(--color-orange)' }}
                >
                  Cost / Meeting
                </div>
                <div
                  className="text-xl font-bold"
                  style={{ color: pipeline?.meetingsBooked > 0 ? 'var(--color-orange)' : 'var(--color-text-muted)' }}
                >
                  {pipeline?.meetingsBooked > 0
                    ? `$${(totals.spend / pipeline.meetingsBooked).toFixed(2)}`
                    : '-'}
                </div>
              </div>
              <div className="glass-card p-4">
                <div
                  className="text-[10px] uppercase tracking-wider font-medium mb-1"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Lead &rarr; Meeting
                </div>
                <div
                  className="text-xl font-bold"
                  style={{
                    color:
                      pipeline?.meetingsBooked > 0
                        ? 'var(--color-green)'
                        : 'var(--color-text-muted)',
                  }}
                >
                  {pipeline?.total > 0
                    ? `${((pipeline.meetingsBooked / pipeline.total) * 100).toFixed(0)}%`
                    : '-'}
                </div>
              </div>
              <div className="glass-card p-4">
                <div
                  className="text-[10px] uppercase tracking-wider font-medium mb-1"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Total Spend
                </div>
                <div className="text-xl font-bold">
                  ${totals.spend.toFixed(2)}
                </div>
              </div>
              <div className="glass-card p-4">
                <div
                  className="text-[10px] uppercase tracking-wider font-medium mb-1"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Total Leads
                </div>
                <div
                  className="text-xl font-bold"
                  style={{
                    color:
                      totals.leads > 0
                        ? 'var(--color-green)'
                        : 'var(--color-red)',
                  }}
                >
                  {totals.leads}
                </div>
              </div>
              <div className="glass-card p-4">
                <div
                  className="text-[10px] uppercase tracking-wider font-medium mb-1"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Avg CPL
                </div>
                <div className="text-xl font-bold">
                  {totals.leads > 0
                    ? `$${(totals.spend / totals.leads).toFixed(2)}`
                    : '-'}
                </div>
              </div>
            </div>
          )}

          {/* Client Cards View */}
          {view === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.map((d, i) => (
                <ClientCard
                  key={i}
                  client={d.client}
                  summary={d.summary}
                  ads={d.ads}
                  pipelineData={leadsData?.clientPipelines?.[d.client.slug]}
                  days={days}
                />
              ))}
            </div>
          )}

          {/* Pipeline View */}
          {view === 'pipeline' && (
            <div>
              {/* Client filter */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold">Sales Pipeline</h2>
                <ClientFilter />
              </div>
              <div className="mb-6">
                <PipelineFunnel
                  pipeline={filteredPipeline}
                  totalSpend={totals?.spend}
                />
              </div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">
                  {filterClient === 'all' ? 'All' : clients.find(c => c.slug === filterClient)?.name} Leads ({filteredLeads.length})
                </h2>
              </div>
              <LeadsTable leads={filteredLeads} showClient={filterClient === 'all'} />
            </div>
          )}

          {/* All Ads Comparison View */}
          {view === 'comparison' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold">
                    {filterClient === 'all' ? 'All Ads Across Clients' : `${clients.find(c => c.slug === filterClient)?.name} Ads`}
                  </h2>
                  <span
                    className="text-xs"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {filteredAds.length} ads total | Sorted by leads (click headers
                    to sort)
                  </span>
                </div>
                <ClientFilter />
              </div>
              <AdTable ads={filteredAds} showClient={filterClient === 'all'} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
