'use client';

const TONE = {
  good: 'var(--color-green)',
  hold: 'var(--color-text-muted)',
  warn: 'var(--color-orange)',
};

const UNAVAILABLE = {
  targets_unavailable: 'Targets unavailable. No verdicts until the Settings tab can be read.',
  leads_unavailable: 'Leads unavailable. The Leads Tracker tab did not load, so nothing is judged.',
  meta_unavailable: 'Meta unavailable. Spend could not be read, so nothing is judged.',
  no_account: 'No Meta ad account for this client.',
};

const money = (n) => (n === null || n === undefined ? '-' : `$${Number(n).toFixed(2)}`);

function AdsManagerLink({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline whitespace-nowrap"
      style={{ color: 'var(--color-accent-light)' }}
    >
      {children}
    </a>
  );
}

function Figure({ label, value }) {
  return (
    <span className="whitespace-nowrap">
      <span style={{ color: 'var(--color-text-muted)' }}>{label} </span>
      <span className="font-medium">{value}</span>
    </span>
  );
}

function CampaignRow({ c, targets }) {
  const v = c.verdict;
  const w = c.adWarning;
  return (
    <div className="py-3" style={{ borderTop: '1px solid var(--color-border)' }}>
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
        <div className="text-sm font-medium break-words">{c.name}</div>
        <div className="text-sm font-semibold" style={{ color: TONE[v.tone] || TONE.warn }}>
          {v.code === 'set_targets' ? <a href="#kpi-targets" className="underline">Set targets</a> : v.label}
        </div>
      </div>

      {v.detail && (
        <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
          {v.detail}
        </div>
      )}

      {/* The numbers the verdict used, so it can be checked by hand */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-2">
        <Figure label="Spend" value={money(c.spend)} />
        <Figure label="Leads" value={`${c.leads} (${c.qualifiedLeads} qualified)`} />
        <Figure label="Booked meetings" value={c.meetings} />
        <Figure label="Qualified meetings" value={c.qualifiedMeetings} />
        <Figure
          label="Cost / booked meeting"
          value={`${money(c.costPerMeeting)}${targets?.costPerMeeting ? ` v ${money(targets.costPerMeeting)}` : ''}`}
        />
        <Figure
          label="Cost / qualified meeting"
          value={`${money(c.costPerQualifiedMeeting)}${targets?.costPerQualifiedMeeting ? ` v ${money(targets.costPerQualifiedMeeting)}` : ''}`}
        />
        <Figure
          label="Cost / lead"
          value={`${money(c.costPerLead)}${targets?.cpl ? ` v ${money(targets.cpl)}` : ''}`}
        />
      </div>

      {c.ads?.length > 0 && (
        <details className="mt-2">
          <summary className="text-[11px] cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>
            Spend by ad ({c.ads.length})
          </summary>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-[11px] mt-1">
              <thead>
                <tr style={{ color: 'var(--color-text-muted)' }}>
                  <th className="text-left font-medium py-1 pr-3">Ad</th>
                  <th className="text-left font-medium py-1 pr-3">Status</th>
                  <th className="text-right font-medium py-1 pr-3">Spend</th>
                  <th className="text-right font-medium py-1 pr-3">Share</th>
                  <th className="text-right font-medium py-1 pr-3">Leads</th>
                  <th className="text-right font-medium py-1">Meetings</th>
                </tr>
              </thead>
              <tbody>
                {c.ads.map((a) => (
                  <tr key={a.adId} style={{ borderTop: '1px solid var(--color-border)' }}>
                    <td className="py-1 pr-3 break-words">{a.adName}</td>
                    <td className="py-1 pr-3 whitespace-nowrap" style={{ color: a.status === 'ACTIVE' ? 'var(--color-green)' : 'var(--color-text-muted)' }}>
                      {a.status === 'ACTIVE' ? 'Active' : 'Off'}
                    </td>
                    <td className="py-1 pr-3 text-right whitespace-nowrap">{money(a.spend)}</td>
                    <td className="py-1 pr-3 text-right">{(a.share * 100).toFixed(0)}%</td>
                    <td className="py-1 pr-3 text-right">{a.leads}</td>
                    <td className="py-1 text-right" style={{ color: a.meetings > 0 ? 'var(--color-orange)' : undefined }}>{a.meetings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {v.missing?.length > 0 && v.code !== 'set_targets' && (
        <div className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
          {v.missing.map((m) => `No ${m} target set`).join('. ')}.
        </div>
      )}

      {c.stop && (
        <div
          className="text-xs mt-2 p-2 rounded-lg"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}
        >
          <span className="font-semibold" style={{ color: 'var(--color-red)' }}>
            Consider stopping this campaign.
          </span>{' '}
          {c.qualifiedMeetings > 0
            ? `${money(c.costPerQualifiedMeeting)} per qualified meeting (${c.qualifiedMeetings} from ${money(c.spend)})`
            : `${money(c.spend)} spent with no qualified meeting`}
          , against a target of {money(targets?.costPerQualifiedMeeting)} each. Try switching
          off any flagged ads first.{' '}
          <AdsManagerLink href={c.campaignLink}>Open campaign in Ads Manager</AdsManagerLink>
        </div>
      )}

      {w.state === 'flagged' &&
        w.ads.map((a) => (
          <div
            key={a.adId}
            className="text-xs mt-2 p-2 rounded-lg"
            style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.3)' }}
          >
            <span className="font-semibold" style={{ color: 'var(--color-orange)' }}>
              Consider switching off:
            </span>{' '}
            {a.adName} - {money(a.spend)} spent, {a.leads} leads, 0 meetings. Keep the campaign
            running. <AdsManagerLink href={c.link}>Open in Ads Manager</AdsManagerLink>
          </div>
        ))}

      {w.state === 'all' && (
        <div
          className="text-xs mt-2 p-2 rounded-lg"
          style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.3)' }}
        >
          <span className="font-semibold" style={{ color: 'var(--color-orange)' }}>
            All active ads are past target with no meetings.
          </span>{' '}
          Switching them all off is the same as stopping the campaign: stop it or rebuild the
          ads. <AdsManagerLink href={c.link}>Open in Ads Manager</AdsManagerLink>
        </div>
      )}

      {w.state === 'status_unavailable' && (
        <div className="text-[11px] mt-2" style={{ color: 'var(--color-red)' }}>
          Status unavailable. Meta did not return ad statuses, so no ad is suggested.
        </div>
      )}
      {w.state === 'unmatched' && (
        <div className="text-[11px] mt-2" style={{ color: 'var(--color-text-muted)' }}>
          No ad suggested: a booked meeting in this campaign came from an ad name that matches
          no current ad, so it cannot be credited.
        </div>
      )}
      {w.state === 'no_target' && v.actionable && (
        <div className="text-[11px] mt-2" style={{ color: 'var(--color-text-muted)' }}>
          Ad and stop warnings are off: no cost per qualified meeting target set.
        </div>
      )}
      {c.unmatchedAdLeads > 0 && w.state !== 'unmatched' && (
        <div className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
          {c.unmatchedAdLeads} lead{c.unmatchedAdLeads === 1 ? '' : 's'} in this campaign match no current ad name.
        </div>
      )}
    </div>
  );
}

/**
 * Verdict per campaign, following the ads-side steps of MORPH's decision framework,
 * plus warnings. Warnings only: nothing here changes anything in Meta.
 */
export default function CampaignVerdict({ report, loading }) {
  return (
    <div className="glass-card p-4 mb-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">Campaign verdicts</h2>
        {report?.state === 'ok' && (
          <span
            className="text-xs font-medium"
            style={{ color: report.warningCount > 0 ? 'var(--color-orange)' : 'var(--color-text-muted)' }}
          >
            {report.warningCount} warning{report.warningCount === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {loading && !report && (
        <p className="text-xs mt-3" style={{ color: 'var(--color-text-muted)' }}>
          Working out verdicts...
        </p>
      )}

      {report && report.state !== 'ok' && (
        <p className="text-xs mt-3" style={{ color: 'var(--color-red)' }}>
          {UNAVAILABLE[report.state] || 'Verdicts unavailable.'}
        </p>
      )}

      {report?.state === 'ok' && report.campaigns.length === 0 && (
        <p className="text-xs mt-3" style={{ color: 'var(--color-text-muted)' }}>
          No campaign spent in this date range.
        </p>
      )}

      {report?.state === 'ok' && report.campaigns.length > 0 && (
        <>
          <div className="mt-3">
            {report.campaigns.map((c) => (
              <CampaignRow key={c.id} c={c} targets={report.targets} />
            ))}
          </div>
          {report.unmatchedLeads > 0 && (
            <p className="text-[11px] mt-2" style={{ color: 'var(--color-text-muted)' }}>
              Unmatched leads: {report.unmatchedLeads}. Their campaign name matches no campaign
              that spent in this range, so they are in no verdict.
            </p>
          )}
          <p className="text-[11px] mt-3" style={{ color: 'var(--color-text-muted)' }}>
            Meetings are counted by the date the lead came in, so recent leads may still book
            and these figures differ from the weekly sheet, which counts by booking date.
            Cancelled and no-show meetings still count as booked. An edit to a campaign does
            not restart the 5-day clock. Bookings that never reached the Leads Tracker are
            not seen here.
          </p>
        </>
      )}
    </div>
  );
}
