'use client';

import Link from 'next/link';

export default function ClientCard({ client, summary, ads, pipelineData, days }) {
  const hasLeads = summary && summary.totalLeads > 0;
  const leadingAds = ads ? ads.filter((a) => a.totalLeads > 0).length : 0;
  const zeroLeadAds = ads ? ads.filter((a) => a.totalLeads === 0).length : 0;
  const meetings = pipelineData?.pipeline?.meetingsBooked || 0;
  const pipelineLeads = pipelineData?.leadCount || 0;
  const costPerMeeting =
    meetings > 0 && summary?.totalSpend > 0
      ? summary.totalSpend / meetings
      : 0;

  return (
    <Link href={`/client/${client.slug}`} className="block">
      <div className="glass-card p-5 cursor-pointer hover:border-[var(--color-accent)]/30 transition-all">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm">{client.name}</h3>
          <div className="flex items-center gap-2">
            <div
              className="text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{
                background: hasLeads
                  ? 'rgba(34,197,94,0.1)'
                  : 'rgba(239,68,68,0.1)',
                color: hasLeads ? 'var(--color-green)' : 'var(--color-red)',
              }}
            >
              {hasLeads ? 'Getting Leads' : 'No Leads'}
            </div>
          </div>
        </div>

        {summary ? (
          <>
            {/* Hero: Meetings Booked + Cost per Meeting */}
            <div className="grid grid-cols-2 gap-3 mb-4 p-3 rounded-lg" style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.15)' }}>
              <div>
                <div
                  className="text-[10px] uppercase tracking-wider mb-1 font-semibold"
                  style={{ color: 'var(--color-orange)' }}
                >
                  Meetings Booked
                </div>
                <div
                  className="text-2xl font-bold"
                  style={{
                    color: meetings > 0 ? 'var(--color-orange)' : 'var(--color-text-muted)',
                  }}
                >
                  {meetings}
                </div>
              </div>
              <div>
                <div
                  className="text-[10px] uppercase tracking-wider mb-1 font-semibold"
                  style={{ color: 'var(--color-orange)' }}
                >
                  Cost / Meeting
                </div>
                <div
                  className="text-2xl font-bold"
                  style={{
                    color: costPerMeeting > 0 ? 'var(--color-orange)' : 'var(--color-text-muted)',
                  }}
                >
                  {costPerMeeting > 0 ? `$${costPerMeeting.toFixed(2)}` : '-'}
                </div>
              </div>
            </div>

            {/* Secondary: Spend, Leads, CPL */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <div
                  className="text-[10px] uppercase tracking-wider mb-1"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Spend
                </div>
                <div className="text-sm font-semibold">
                  ${summary.totalSpend.toFixed(2)}
                </div>
              </div>
              <div>
                <div
                  className="text-[10px] uppercase tracking-wider mb-1"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Leads
                </div>
                <div
                  className="text-sm font-semibold"
                  style={{
                    color: hasLeads
                      ? 'var(--color-green)'
                      : 'var(--color-red)',
                  }}
                >
                  {summary.totalLeads}
                </div>
              </div>
              <div>
                <div
                  className="text-[10px] uppercase tracking-wider mb-1"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  CPL
                </div>
                <div className="text-sm font-semibold">
                  {summary.cpl > 0 ? `$${summary.cpl.toFixed(2)}` : '-'}
                </div>
              </div>
            </div>

            {/* Pipeline mini bar */}
            {pipelineLeads > 0 && (
              <div className="mb-3">
                <div className="flex items-center gap-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                  {pipelineData.pipeline.pickedUp > 0 && (
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(pipelineData.pipeline.pickedUp / pipelineLeads) * 100}%`,
                        background: 'var(--color-yellow)',
                      }}
                    />
                  )}
                  {pipelineData.pipeline.meetingsBooked > 0 && (
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(pipelineData.pipeline.meetingsBooked / pipelineLeads) * 100}%`,
                        background: 'var(--color-orange)',
                      }}
                    />
                  )}
                  {pipelineData.pipeline.closed > 0 && (
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(pipelineData.pipeline.closed / pipelineLeads) * 100}%`,
                        background: 'var(--color-green)',
                      }}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Ad Status Bar */}
            <div className="flex items-center gap-2 text-[11px]">
              <span style={{ color: 'var(--color-text-muted)' }}>
                {summary.uniqueAds} ads
              </span>
              <span style={{ color: 'var(--color-text-muted)' }}>|</span>
              {leadingAds > 0 && (
                <span style={{ color: 'var(--color-green)' }}>
                  {leadingAds} with leads
                </span>
              )}
              {zeroLeadAds > 0 && (
                <>
                  {leadingAds > 0 && (
                    <span style={{ color: 'var(--color-text-muted)' }}>|</span>
                  )}
                  <span style={{ color: 'var(--color-red)' }}>
                    {zeroLeadAds} need attention
                  </span>
                </>
              )}
            </div>

            {/* Data coverage */}
            <div
              className="text-[10px] mt-2"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {summary.totalRows > 0
                ? `${summary.totalRows} data points`
                : `No data in last ${days || 30} days`}
            </div>
          </>
        ) : (
          <div
            className="text-sm py-4"
            style={{ color: 'var(--color-text-muted)' }}
          >
            No data available
          </div>
        )}
      </div>
    </Link>
  );
}
