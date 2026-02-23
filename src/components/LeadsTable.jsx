'use client';

import { useState } from 'react';

const STAGE_COLORS = {
  new: { bg: 'rgba(99,102,241,0.1)', color: 'var(--color-accent-light)', label: 'New Lead' },
  pickedUp: { bg: 'rgba(234,179,8,0.1)', color: 'var(--color-yellow)', label: 'Picked Up' },
  meetingBooked: { bg: 'rgba(249,115,22,0.1)', color: 'var(--color-orange)', label: 'Meeting' },
  followUp: { bg: 'rgba(99,102,241,0.1)', color: 'var(--color-accent-light)', label: 'Follow Up' },
  strategyCall: { bg: 'rgba(34,197,94,0.1)', color: 'var(--color-green)', label: 'SC' },
  closed: { bg: 'rgba(16,185,129,0.15)', color: '#10b981', label: 'Closed' },
};

function getLeadStage(lead) {
  if (lead.closed) return 'closed';
  if (lead.strategyCall) return 'strategyCall';
  if (lead.meetingBooked) return 'meetingBooked';
  if (lead.followUp) return 'followUp';
  if (lead.pickedUp) return 'pickedUp';
  return 'new';
}

export default function LeadsTable({ leads, showClient }) {
  const [sortKey, setSortKey] = useState('createdDate');
  const [sortDir, setSortDir] = useState('desc');

  if (!leads || leads.length === 0) {
    return (
      <div
        className="glass-card p-6 text-center text-xs"
        style={{ color: 'var(--color-text-muted)' }}
      >
        No leads data available yet
      </div>
    );
  }

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const sorted = [...leads].sort((a, b) => {
    let aVal = a[sortKey];
    let bVal = b[sortKey];
    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const SortHeader = ({ label, field }) => (
    <th
      className="cursor-pointer select-none hover:text-white transition-colors"
      onClick={() => handleSort(field)}
    >
      {label} {sortKey === field ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  );

  return (
    <div className="glass-card table-container">
      <table>
        <thead>
          <tr>
            <SortHeader label="Date" field="createdDate" />
            {showClient && <SortHeader label="Client" field="clientSlug" />}
            <SortHeader label="Name" field="fullName" />
            <th>Platform</th>
            <th>Ad</th>
            <th>Qualification</th>
            <th>Stage</th>
            <SortHeader label="Score" field="leadScore" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((lead, i) => {
            const stage = getLeadStage(lead);
            const stageStyle = STAGE_COLORS[stage];

            return (
              <tr key={i}>
                <td className="text-xs">
                  {lead.createdDate}
                </td>
                {showClient && (
                  <td className="text-xs">
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                      style={{
                        background: 'rgba(99,102,241,0.1)',
                        color: 'var(--color-accent-light)',
                      }}
                    >
                      {lead.clientSlug === 'unmatched'
                        ? 'Unmatched'
                        : lead.clientSlug}
                    </span>
                  </td>
                )}
                <td>
                  <div className="text-xs font-medium">{lead.fullName || '-'}</div>
                  {lead.email && (
                    <div
                      className="text-[10px]"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {lead.email}
                    </div>
                  )}
                </td>
                <td>
                  <span
                    className="text-[10px] font-medium uppercase px-1.5 py-0.5 rounded"
                    style={{
                      background:
                        lead.platform === 'ig'
                          ? 'rgba(225,48,108,0.1)'
                          : 'rgba(24,119,242,0.1)',
                      color:
                        lead.platform === 'ig' ? '#e1306c' : '#1877f2',
                    }}
                  >
                    {lead.platform || '-'}
                  </span>
                </td>
                <td>
                  <div
                    className="text-xs max-w-[200px] truncate"
                    title={lead.adName}
                  >
                    {lead.adName || '-'}
                  </div>
                </td>
                <td>
                  {lead.answer1 ? (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                      style={{
                        background: 'rgba(34,197,94,0.1)',
                        color: 'var(--color-green)',
                      }}
                    >
                      {lead.answer1}
                    </span>
                  ) : (
                    <span
                      className="text-[10px]"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      -
                    </span>
                  )}
                </td>
                <td>
                  <span
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                    style={{
                      background: stageStyle.bg,
                      color: stageStyle.color,
                    }}
                  >
                    {stageStyle.label}
                  </span>
                </td>
                <td>
                  <span
                    className="text-xs font-medium"
                    style={{
                      color: lead.leadScore
                        ? 'var(--color-accent-light)'
                        : 'var(--color-text-muted)',
                    }}
                  >
                    {lead.leadScore || '-'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
