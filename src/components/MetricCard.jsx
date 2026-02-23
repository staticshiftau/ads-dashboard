'use client';

export default function MetricCard({ label, value, subtext, color }) {
  return (
    <div className="glass-card p-4">
      <div
        className="text-[11px] uppercase tracking-wider font-medium mb-2"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {label}
      </div>
      <div
        className="text-2xl font-bold tracking-tight"
        style={{ color: color || 'var(--color-text)' }}
      >
        {value}
      </div>
      {subtext && (
        <div
          className="text-xs mt-1"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {subtext}
        </div>
      )}
    </div>
  );
}
