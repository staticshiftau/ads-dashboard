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

export default function LeadsMeetingsChart({ leads }) {
  if (!leads || leads.length === 0) return null;

  // Aggregate leads and meetings by date
  const dateMap = {};
  leads.forEach((lead) => {
    const date = lead.createdDate;
    if (!date) return;
    if (!dateMap[date]) {
      dateMap[date] = { date, leads: 0, meetings: 0 };
    }
    dateMap[date].leads++;
    if (lead.meetingBooked) dateMap[date].meetings++;
  });

  const data = Object.values(dateMap).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  if (data.length === 0) return null;

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
            <span className="font-medium">{p.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-semibold mb-4">Leads vs Meetings Booked (Daily)</h3>
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
            tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: 'var(--color-text-muted)' }}
          />
          <Bar
            dataKey="leads"
            name="Leads"
            fill="var(--color-accent)"
            radius={[3, 3, 0, 0]}
            opacity={0.8}
          />
          <Bar
            dataKey="meetings"
            name="Meetings Booked"
            fill="var(--color-orange)"
            radius={[3, 3, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
