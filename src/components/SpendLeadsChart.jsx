'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

export default function SpendLeadsChart({ rawRows }) {
  if (!rawRows || rawRows.length === 0) return null;

  // Aggregate by date
  const dateMap = {};
  rawRows.forEach((row) => {
    const date = row['Date'] || row.date;
    if (!date) return;
    if (!dateMap[date]) {
      dateMap[date] = { date, spend: 0, leads: 0, linkClicks: 0 };
    }
    dateMap[date].spend += Number(row['Spend'] || row.spend || 0);
    dateMap[date].leads += Number(row['Leads'] || row.leads || 0);
    dateMap[date].linkClicks += Number(row['Link Clicks'] || row.linkClicks || 0);
  });

  const data = Object.values(dateMap).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  // Format date for display
  const formatDate = (d) => {
    const parts = d.split('-');
    if (parts.length === 3) {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return `${months[parseInt(parts[1]) - 1]} ${parseInt(parts[2])}`;
    }
    return d;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload) return null;
    return (
      <div
        className="rounded-lg p-3 text-xs"
        style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div className="font-medium mb-1">{formatDate(label)}</div>
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: p.color }}
            />
            <span style={{ color: 'var(--color-text-muted)' }}>
              {p.name}:
            </span>
            <span className="font-medium">
              {p.name === 'Spend' ? `$${p.value.toFixed(2)}` : p.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-semibold mb-4">Daily Spend vs Leads</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} barGap={2}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--color-border)' }}
            tickLine={false}
          />
          <YAxis
            yAxisId="spend"
            tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v}`}
          />
          <YAxis
            yAxisId="leads"
            orientation="right"
            tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: 'var(--color-text-muted)' }}
          />
          <Bar
            yAxisId="spend"
            dataKey="spend"
            name="Spend"
            fill="var(--color-accent)"
            radius={[3, 3, 0, 0]}
            opacity={0.8}
          />
          <Bar
            yAxisId="leads"
            dataKey="leads"
            name="Leads"
            fill="var(--color-green)"
            radius={[3, 3, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
