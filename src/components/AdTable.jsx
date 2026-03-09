'use client';

import { useState } from 'react';

export default function AdTable({ ads, showClient = false }) {
  const [sortBy, setSortBy] = useState('totalLeads');
  const [sortDir, setSortDir] = useState('desc');

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  const sorted = [...ads].sort((a, b) => {
    const aVal = a[sortBy] ?? 0;
    const bVal = b[sortBy] ?? 0;
    return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
  });

  const SortIcon = ({ field }) => {
    if (sortBy !== field) return null;
    return <span className="ml-1">{sortDir === 'desc' ? '↓' : '↑'}</span>;
  };

  const statusColor = (status) => {
    const s = (status || '').toUpperCase();
    if (s === 'ACTIVE') return 'var(--color-green)';
    if (s === 'PAUSED') return 'var(--color-yellow)';
    if (s === 'IN REVIEW' || s === 'PROCESSING') return 'var(--color-accent-light)';
    if (s === 'ARCHIVED') return 'var(--color-text-muted)';
    return 'var(--color-red)';
  };

  const leadBadge = (leads, spend) => {
    if (leads > 0) {
      return (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
          style={{
            background: 'rgba(34,197,94,0.1)',
            color: 'var(--color-green)',
          }}
        >
          {leads} leads
        </span>
      );
    }
    if (spend > 10) {
      return (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
          style={{
            background: 'rgba(239,68,68,0.1)',
            color: 'var(--color-red)',
          }}
        >
          0 leads - Replace?
        </span>
      );
    }
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
        style={{
          background: 'rgba(234,179,8,0.1)',
          color: 'var(--color-yellow)',
        }}
      >
        0 leads
      </span>
    );
  };

  return (
    <div className="table-container glass-card">
      <table>
        <thead>
          <tr>
            {showClient && <th>Client</th>}
            <th>Ad Name</th>
            <th>Status</th>
            <th
              className="cursor-pointer hover:text-white"
              onClick={() => handleSort('totalLeads')}
            >
              Leads <SortIcon field="totalLeads" />
            </th>
            <th
              className="cursor-pointer hover:text-white"
              onClick={() => handleSort('meetings')}
            >
              Meetings <SortIcon field="meetings" />
            </th>
            <th
              className="cursor-pointer hover:text-white"
              onClick={() => handleSort('totalSpend')}
            >
              Spend <SortIcon field="totalSpend" />
            </th>
            <th
              className="cursor-pointer hover:text-white"
              onClick={() => handleSort('cpl')}
            >
              CPL <SortIcon field="cpl" />
            </th>
            <th
              className="cursor-pointer hover:text-white"
              onClick={() => handleSort('costPerMeeting')}
            >
              Cost/Mtg <SortIcon field="costPerMeeting" />
            </th>
            <th
              className="cursor-pointer hover:text-white"
              onClick={() => handleSort('totalLinkClicks')}
            >
              Link Clicks <SortIcon field="totalLinkClicks" />
            </th>
            <th
              className="cursor-pointer hover:text-white"
              onClick={() => handleSort('costPerLinkClick')}
            >
              Cost/Click <SortIcon field="costPerLinkClick" />
            </th>
            <th
              className="cursor-pointer hover:text-white"
              onClick={() => handleSort('totalImpressions')}
            >
              Impressions <SortIcon field="totalImpressions" />
            </th>
            <th>Days</th>
            <th>Performance</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((ad, i) => (
            <tr key={i}>
              {showClient && (
                <td className="font-medium text-[12px]">
                  {ad.clientName || '-'}
                </td>
              )}
              <td>
                <div className="max-w-[250px] truncate font-medium text-[12px]">
                  {ad.adName}
                </div>
                <div
                  className="max-w-[250px] truncate text-[10px]"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {ad.adSetName || ad.campaignName}
                </div>
              </td>
              <td>
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full inline-block"
                    style={{ background: statusColor(ad.status) }}
                  />
                  <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                    {ad.status || '-'}
                  </span>
                </div>
              </td>
              <td>
                <span
                  className="font-bold"
                  style={{
                    color:
                      ad.totalLeads > 0
                        ? 'var(--color-green)'
                        : 'var(--color-text-muted)',
                  }}
                >
                  {ad.totalLeads}
                </span>
              </td>
              <td>
                <span
                  className="font-bold"
                  style={{
                    color:
                      ad.meetings > 0
                        ? 'var(--color-orange)'
                        : 'var(--color-text-muted)',
                  }}
                >
                  {ad.meetings || 0}
                </span>
              </td>
              <td>${ad.totalSpend.toFixed(2)}</td>
              <td>
                <span
                  style={{
                    color:
                      ad.cpl > 0 ? 'var(--color-text)' : 'var(--color-text-muted)',
                  }}
                >
                  {ad.cpl > 0 ? `$${ad.cpl.toFixed(2)}` : '-'}
                </span>
              </td>
              <td>
                <span
                  style={{
                    color:
                      ad.costPerMeeting > 0 ? 'var(--color-orange)' : 'var(--color-text-muted)',
                  }}
                >
                  {ad.costPerMeeting > 0 ? `$${ad.costPerMeeting.toFixed(2)}` : '-'}
                </span>
              </td>
              <td>{ad.totalLinkClicks}</td>
              <td>
                {ad.costPerLinkClick > 0
                  ? `$${ad.costPerLinkClick.toFixed(2)}`
                  : '-'}
              </td>
              <td>{ad.totalImpressions.toLocaleString()}</td>
              <td>{ad.days}</td>
              <td>{leadBadge(ad.totalLeads, ad.totalSpend)}</td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td
                colSpan={showClient ? 13 : 12}
                className="text-center py-8"
                style={{ color: 'var(--color-text-muted)' }}
              >
                No ad data available
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
