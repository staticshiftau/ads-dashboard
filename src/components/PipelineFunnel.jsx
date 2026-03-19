'use client';

export default function PipelineFunnel({ pipeline, totalSpend }) {
  if (!pipeline) return null;

  const stages = [
    {
      label: 'Leads',
      count: pipeline.total,
      color: 'var(--color-accent)',
      bgColor: 'rgba(99,102,241,0.1)',
    },
    {
      label: 'Picked Up',
      count: pipeline.pickedUp,
      color: 'var(--color-yellow)',
      bgColor: 'rgba(234,179,8,0.1)',
    },
    {
      label: 'Meeting Booked',
      count: pipeline.meetingsBooked,
      qualified: pipeline.qualifiedMeetings,
      unqualified: pipeline.unqualifiedMeetings,
      color: 'var(--color-orange)',
      bgColor: 'rgba(249,115,22,0.1)',
    },
    {
      label: 'Strategy Call',
      count: pipeline.strategyCalls,
      color: 'var(--color-green)',
      bgColor: 'rgba(34,197,94,0.1)',
    },
    {
      label: 'Closed',
      count: pipeline.closed,
      color: '#10b981',
      bgColor: 'rgba(16,185,129,0.1)',
    },
  ];

  const maxCount = Math.max(pipeline.total, 1);

  // Derived metrics (use qualified counts for cost calculations)
  const costPerMeeting =
    pipeline.qualifiedMeetings > 0 && totalSpend
      ? (totalSpend / pipeline.qualifiedMeetings).toFixed(2)
      : null;

  const leadToMeetingRate =
    pipeline.total > 0
      ? ((pipeline.qualifiedMeetings / pipeline.total) * 100).toFixed(0)
      : 0;

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Sales Pipeline</h3>
        <div className="flex items-center gap-4 text-xs">
          {costPerMeeting && (
            <div className="flex items-center gap-1.5">
              <span style={{ color: 'var(--color-text-muted)' }}>
                Cost / Qual. Meeting
              </span>
              <span className="font-bold" style={{ color: 'var(--color-orange)' }}>
                ${costPerMeeting}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span style={{ color: 'var(--color-text-muted)' }}>
              Lead → Meeting
            </span>
            <span
              className="font-bold"
              style={{
                color:
                  leadToMeetingRate > 0
                    ? 'var(--color-green)'
                    : 'var(--color-text-muted)',
              }}
            >
              {leadToMeetingRate}%
            </span>
          </div>
        </div>
      </div>

      {/* Funnel bars */}
      <div className="space-y-2">
        {stages.map((stage, i) => {
          const width = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
          const conversionFromPrev =
            i > 0 && stages[i - 1].count > 0
              ? ((stage.count / stages[i - 1].count) * 100).toFixed(0)
              : null;

          return (
            <div key={stage.label} className="flex items-center gap-3">
              <div
                className="text-[11px] font-medium w-[100px] text-right shrink-0"
                style={{ color: stage.color }}
              >
                {stage.label}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div
                    className="h-8 rounded-md flex items-center px-3 transition-all duration-500 shrink-0"
                    style={{
                      width: `${Math.max(width, 8)}%`,
                      minWidth: 'fit-content',
                      background: stage.bgColor,
                      border: `1px solid ${stage.color}20`,
                    }}
                  >
                    <span className="text-xs font-bold whitespace-nowrap" style={{ color: stage.color }}>
                      {stage.count}
                    </span>
                  </div>
                  {stage.qualified != null && stage.count > 0 && (
                    <span className="text-[10px] whitespace-nowrap shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                      {stage.qualified} qual · {stage.unqualified} unqual
                    </span>
                  )}
                </div>
              </div>
              {conversionFromPrev && (
                <div
                  className="text-[10px] w-[40px] text-right shrink-0"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {conversionFromPrev}%
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {pipeline.total === 0 && (
        <div
          className="text-xs text-center py-4 mt-2"
          style={{ color: 'var(--color-text-muted)' }}
        >
          No leads in pipeline yet for this period
        </div>
      )}
    </div>
  );
}
