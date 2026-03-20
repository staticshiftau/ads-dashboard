'use client';

import { useState } from 'react';

export default function CampaignTable({ ads, showClient = false, campaignPipelineStats = {} }) {
  const [sortBy, setSortBy] = useState('totalLeads');
  const [sortDir, setSortDir] = useState('desc');
  const [expanded, setExpanded] = useState(new Set());

  // Group ads by campaign (spend, clicks, impressions from Meta)
  const campaignMap = {};
  ads.forEach((ad) => {
    const key = ad.campaignName || 'Unknown Campaign';
    if (!campaignMap[key]) {
      campaignMap[key] = {
        campaignName: key,
        clientName: ad.clientName || '',
        clientSlug: ad.clientSlug || '',
        ads: [],
        totalSpend: 0,
        totalImpressions: 0,
        totalLinkClicks: 0,
      };
    }
    const c = campaignMap[key];
    c.ads.push(ad);
    c.totalSpend += ad.totalSpend || 0;
    c.totalImpressions += ad.totalImpressions || 0;
    c.totalLinkClicks += ad.totalLinkClicks || 0;
  });

  // Merge leads/meetings from campaign-level pipeline stats (directly from sheets, no ad-name matching)
  // Fall back to summing per-ad stats if campaign stats not available
  const campaigns = Object.values(campaignMap).map((c) => {
    // Try to find matching campaign stats (fuzzy match by word overlap)
    let pipelineStats = campaignPipelineStats[c.campaignName];
    if (!pipelineStats) {
      // Fuzzy match: find the campaign stats entry with the most word overlap
      const campaignWords = c.campaignName.toLowerCase().split(/[\s|,\-–—/]+/).filter((w) => w.length >= 3);
      let bestMatch = null;
      let bestScore = 0;
      for (const [name, stats] of Object.entries(campaignPipelineStats)) {
        const statsWords = name.toLowerCase().split(/[\s|,\-–—/]+/).filter((w) => w.length >= 3);
        const overlap = campaignWords.filter((w) => statsWords.includes(w)).length;
        if (overlap > bestScore && overlap >= 2) {
          bestScore = overlap;
          bestMatch = stats;
        }
      }
      pipelineStats = bestMatch;
    }

    const totalLeads = pipelineStats?.leads || c.ads.reduce((sum, a) => sum + (a.totalLeads || 0), 0);
    const qualifiedLeads = pipelineStats?.qualifiedLeads || c.ads.reduce((sum, a) => sum + (a.qualifiedLeads || 0), 0);
    const meetings = pipelineStats?.meetingsBooked || c.ads.reduce((sum, a) => sum + (a.meetings || 0), 0);
    const qualifiedMeetings = pipelineStats?.qualifiedMeetings || c.ads.reduce((sum, a) => sum + (a.qualifiedMeetings || 0), 0);

    return {
      ...c,
      totalLeads,
      qualifiedLeads,
      meetings,
      qualifiedMeetings,
      strategyCalls: pipelineStats?.strategyCalls || 0,
      closed: pipelineStats?.closed || 0,
      cpl: qualifiedLeads > 0 ? c.totalSpend / qualifiedLeads : 0,
      costPerMeeting: qualifiedMeetings > 0 ? c.totalSpend / qualifiedMeetings : 0,
      adCount: c.ads.length,
    };
  });

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  const sorted = [...campaigns].sort((a, b) => {
    const aVal = a[sortBy] ?? 0;
    const bVal = b[sortBy] ?? 0;
    return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
  });

  const toggleExpand = (name) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const SortIcon = ({ field }) => {
    if (sortBy !== field) return null;
    return <span className="ml-1">{sortDir === 'desc' ? '↓' : '↑'}</span>;
  };

  return (
    <div className="table-container glass-card">
      <table>
        <thead>
          <tr>
            <th style={{ width: 24 }}></th>
            {showClient && <th>Client</th>}
            <th>Campaign</th>
            <th>Ads</th>
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
              onClick={() => handleSort('totalImpressions')}
            >
              Impressions <SortIcon field="totalImpressions" />
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((campaign) => {
            const isExpanded = expanded.has(campaign.campaignName);
            return (
              <CampaignRow
                key={campaign.campaignName}
                campaign={campaign}
                showClient={showClient}
                isExpanded={isExpanded}
                onToggle={() => toggleExpand(campaign.campaignName)}
              />
            );
          })}
          {sorted.length === 0 && (
            <tr>
              <td
                colSpan={showClient ? 11 : 10}
                className="text-center py-8"
                style={{ color: 'var(--color-text-muted)' }}
              >
                No campaign data available
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function CampaignRow({ campaign, showClient, isExpanded, onToggle }) {
  return (
    <>
      <tr
        className="cursor-pointer"
        onClick={onToggle}
        style={{ background: isExpanded ? 'rgba(55,160,232,0.05)' : undefined }}
      >
        <td className="text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {isExpanded ? '▼' : '▶'}
        </td>
        {showClient && (
          <td className="font-medium text-[12px]">{campaign.clientName || '-'}</td>
        )}
        <td>
          <div className="max-w-[300px] truncate font-medium text-[12px]">
            {campaign.campaignName}
          </div>
        </td>
        <td>
          <span
            className="text-[11px] px-1.5 py-0.5 rounded font-medium"
            style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--color-accent-light)' }}
          >
            {campaign.adCount} ads
          </span>
        </td>
        <td>
          <div className="flex items-center gap-1">
            <span
              className="font-bold"
              style={{ color: campaign.qualifiedLeads > 0 ? 'var(--color-green)' : 'var(--color-text-muted)' }}
            >
              {campaign.qualifiedLeads}
            </span>
            {campaign.totalLeads !== campaign.qualifiedLeads && (
              <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                / {campaign.totalLeads}
              </span>
            )}
          </div>
        </td>
        <td>
          <div className="flex items-center gap-1">
            <span
              className="font-bold"
              style={{ color: campaign.qualifiedMeetings > 0 ? 'var(--color-orange)' : 'var(--color-text-muted)' }}
            >
              {campaign.qualifiedMeetings}
            </span>
            {campaign.meetings !== campaign.qualifiedMeetings && (
              <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                / {campaign.meetings}
              </span>
            )}
          </div>
        </td>
        <td>${campaign.totalSpend.toFixed(2)}</td>
        <td>
          <span style={{ color: campaign.cpl > 0 ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
            {campaign.cpl > 0 ? `$${campaign.cpl.toFixed(2)}` : '-'}
          </span>
        </td>
        <td>
          <span style={{ color: campaign.costPerMeeting > 0 ? 'var(--color-orange)' : 'var(--color-text-muted)' }}>
            {campaign.costPerMeeting > 0 ? `$${campaign.costPerMeeting.toFixed(2)}` : '-'}
          </span>
        </td>
        <td>{campaign.totalLinkClicks}</td>
        <td>{campaign.totalImpressions.toLocaleString()}</td>
      </tr>
      {isExpanded &&
        campaign.ads.map((ad, i) => (
          <tr
            key={i}
            style={{ background: 'rgba(55,160,232,0.03)' }}
          >
            <td></td>
            {showClient && <td></td>}
            <td>
              <div className="max-w-[280px] truncate text-[11px] pl-4" style={{ color: 'var(--color-text-muted)' }}>
                ↳ {ad.adName}
              </div>
            </td>
            <td>
              <div className="flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full inline-block"
                  style={{
                    background:
                      (ad.status || '').toUpperCase() === 'ACTIVE'
                        ? 'var(--color-green)'
                        : (ad.status || '').toUpperCase() === 'PAUSED'
                          ? 'var(--color-yellow)'
                          : 'var(--color-text-muted)',
                  }}
                />
                <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                  {ad.status || '-'}
                </span>
              </div>
            </td>
            <td>
              <div className="flex items-center gap-1">
                <span
                  className="text-[12px]"
                  style={{ color: (ad.qualifiedLeads || 0) > 0 ? 'var(--color-green)' : 'var(--color-text-muted)' }}
                >
                  {ad.qualifiedLeads || 0}
                </span>
                {ad.totalLeads !== (ad.qualifiedLeads || 0) && (
                  <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                    / {ad.totalLeads}
                  </span>
                )}
              </div>
            </td>
            <td>
              <div className="flex items-center gap-1">
                <span
                  className="text-[12px]"
                  style={{ color: (ad.qualifiedMeetings || 0) > 0 ? 'var(--color-orange)' : 'var(--color-text-muted)' }}
                >
                  {ad.qualifiedMeetings || 0}
                </span>
                {(ad.meetings || 0) !== (ad.qualifiedMeetings || 0) && (
                  <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                    / {ad.meetings || 0}
                  </span>
                )}
              </div>
            </td>
            <td className="text-[12px]">${ad.totalSpend.toFixed(2)}</td>
            <td className="text-[12px]">
              {ad.cpl > 0 ? `$${ad.cpl.toFixed(2)}` : '-'}
            </td>
            <td className="text-[12px]">
              {ad.costPerMeeting > 0 ? `$${ad.costPerMeeting.toFixed(2)}` : '-'}
            </td>
            <td className="text-[12px]">{ad.totalLinkClicks}</td>
            <td className="text-[12px]">{ad.totalImpressions.toLocaleString()}</td>
          </tr>
        ))}
    </>
  );
}
