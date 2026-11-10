/**
 * Campaign verdicts and optimisation warnings.
 *
 * Pure functions, no fetching and no imports, so they run under `node --test`.
 * The step order is MORPH's Meta ads decision framework (ads-side steps only).
 * The thresholds are Static Shift's own: 5 days before judging (MORPH), one target
 * cost per qualified meeting before an ad is flagged, 2x before a campaign is (Karl).
 *
 * Nothing here changes anything in Meta. It only produces text and links.
 */

export const MIN_DAYS = 5;
export const STOP_MULTIPLE = 2;

export const TARGET_FIELDS = [
  { key: 'costPerMeeting', label: 'cost per booked meeting', kind: 'money' },
  { key: 'costPerQualifiedMeeting', label: 'cost per qualified meeting', kind: 'money' },
  { key: 'cpl', label: 'cost per lead', kind: 'money' },
  { key: 'callQualifiedRate', label: 'call-qualified rate', kind: 'percent' },
  { key: 'leadQualifiedRate', label: 'lead-qualified rate', kind: 'percent' },
];

const NOT_ACTIONABLE = new Set([
  'range_too_short',
  'dont_touch',
  'on_kpi',
  'set_targets',
]);

function has(v) {
  return typeof v === 'number' && isFinite(v) && v > 0;
}

function money(n) {
  return `$${Number(n).toFixed(2)}`;
}

/**
 * Check and normalise targets typed into the settings panel.
 * Blank is allowed and means "no target set". Returns { values } or { error }.
 */
export function validateTargets(input = {}) {
  const values = {};
  for (const f of TARGET_FIELDS) {
    const raw = input[f.key];
    if (raw === undefined || raw === null || String(raw).trim() === '') {
      values[f.key] = null;
      continue;
    }
    const n = Number(String(raw).replace(/[$,%\s]/g, ''));
    if (!isFinite(n) || n <= 0) {
      return { error: `Target ${f.label} must be a number above zero, or left blank.` };
    }
    if (f.kind === 'percent' && n > 100) {
      return { error: `Target ${f.label} is a percentage and cannot be above 100.` };
    }
    values[f.key] = n;
  }
  return { values };
}

/**
 * Walk the decision framework for one campaign and name the first step off KPI.
 */
export function campaignVerdict(c, targets = {}) {
  const t = targets || {};
  const missing = [];
  const out = (code, label, detail = '', tone = 'warn') => ({
    code,
    label,
    detail,
    tone,
    missing,
    actionable: !NOT_ACTIONABLE.has(code),
  });

  if (c.rangeDays < MIN_DAYS) {
    return out('range_too_short', 'Pick 7 days or more for a verdict', '', 'hold');
  }
  if (c.daysSinceStart !== null && c.daysSinceStart !== undefined && c.daysSinceStart < MIN_DAYS) {
    return out('dont_touch', `Don't touch it (day ${c.daysSinceStart + 1} of ${MIN_DAYS})`, '', 'hold');
  }
  if (!TARGET_FIELDS.some((f) => has(t[f.key]))) {
    return out('set_targets', 'Set targets', 'No KPI targets are set for this client.', 'hold');
  }

  // Step 2: is call volume / cost per call at KPI?
  let callsAtKpi = false;
  if (has(t.costPerMeeting)) {
    callsAtKpi = c.meetings > 0 && c.spend / c.meetings <= t.costPerMeeting;
  } else if (has(t.costPerQualifiedMeeting)) {
    // No booked-meeting target: judge on the qualified-meeting target instead.
    missing.push('cost per booked meeting');
    callsAtKpi = c.qualifiedMeetings > 0 && c.spend / c.qualifiedMeetings <= t.costPerQualifiedMeeting;
  } else {
    missing.push('cost per booked meeting');
  }

  if (callsAtKpi) {
    // Step 3: is the booked call-qualified rate at KPI?
    if (!has(t.callQualifiedRate)) {
      missing.push('call-qualified rate');
    } else if (c.meetings > 0) {
      const rate = (c.qualifiedMeetings / c.meetings) * 100;
      if (rate < t.callQualifiedRate) {
        return out(
          'lead_quality',
          'Improve lead quality',
          `Call-qualified rate ${rate.toFixed(0)}% (${c.qualifiedMeetings} of ${c.meetings}) v target ${t.callQualifiedRate}%.`
        );
      }
    }
    return out('on_kpi', "On KPI - don't touch it", '', 'good');
  }

  // Step 4: is lead volume / cost per lead at KPI?
  if (!has(t.cpl)) {
    missing.push('cost per lead');
  } else if (c.leads === 0) {
    if (c.spend > 0) {
      return out('improve_cpl', 'Improve cost per lead', `${money(c.spend)} spent with no leads in the tracker.`);
    }
  } else if (c.spend / c.leads > t.cpl) {
    return out(
      'improve_cpl',
      'Improve cost per lead',
      `Cost per lead ${money(c.spend / c.leads)} v target ${money(t.cpl)}.`
    );
  }

  // Step 5: is the lead-qualified rate at KPI?
  if (!has(t.leadQualifiedRate)) {
    missing.push('lead-qualified rate');
  } else if (c.leads > 0) {
    const rate = (c.qualifiedLeads / c.leads) * 100;
    if (rate < t.leadQualifiedRate) {
      return out(
        'lead_quality',
        'Improve lead quality',
        `Lead-qualified rate ${rate.toFixed(0)}% (${c.qualifiedLeads} of ${c.leads}) v target ${t.leadQualifiedRate}%.`
      );
    }
  }

  // Step 6: leads are fine, bookings are not.
  return out(
    'booking_rate',
    'Improve booking rate',
    `Booked from ${c.leads} leads: landing page ${c.lpBookings || 0}, SDR ${c.sdrBookings || 0}.`
  );
}

/**
 * Which active ads are worth switching off while the campaign keeps running.
 * States: none | flagged | all | no_target | status_unavailable | unmatched
 */
export function adWarnings({ verdict, ads = [], targets = {}, statusOk, unmatchedMeetings = 0 }) {
  const none = (state) => ({ state, ads: [] });
  if (!verdict?.actionable) return none('none');
  const target = targets?.costPerQualifiedMeeting;
  if (!has(target)) return none('no_target');
  if (!statusOk) return none('status_unavailable');
  if (unmatchedMeetings > 0) return none('unmatched');

  // Only an ad Meta itself reports as ACTIVE counts. The placeholder status does not.
  const active = ads.filter((a) => a.statusKnown === true && a.status === 'ACTIVE');
  const flagged = active.filter((a) => a.spend >= target && a.meetings === 0);
  if (flagged.length === 0) return none('none');
  if (flagged.length === active.length) return { state: 'all', ads: flagged };
  return { state: 'flagged', ads: flagged };
}

/**
 * Should the whole campaign be considered for stopping.
 */
export function stopWarning({ verdict, spend, qualifiedMeetings, targets = {} }) {
  if (!verdict) return false;
  if (verdict.code === 'dont_touch' || verdict.code === 'range_too_short') return false;
  const target = targets?.costPerQualifiedMeeting;
  if (!has(target)) return false;
  return spend >= STOP_MULTIPLE * target && qualifiedMeetings === 0;
}

function daysBetween(startIso, todayIso) {
  const start = new Date(String(startIso).replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
  const today = new Date(`${todayIso}T23:59:59Z`);
  if (isNaN(start) || isNaN(today)) return null;
  return Math.max(0, Math.floor((today - start) / 86400000));
}

function adsManagerLink(accountId, campaignId, level = 'ads') {
  const act = String(accountId || '').replace(/^act_/, '');
  return `https://adsmanager.facebook.com/adsmanager/manage/${level}?act=${act}&selected_campaign_ids=${campaignId}`;
}

/**
 * The one shared join of Meta spend to tracker leads, used by every page.
 *
 * rows:          daily Meta insight rows for the range ('Campaign ID', 'Campaign Name', 'Ad ID', 'Ad Name', Spend)
 * ads:           every ad in the account with its real status ({ adId, adName, campaignId, status, statusKnown })
 * leads:         processed tracker leads for the same range
 * campaignsMeta: { [campaignId]: { name, startTime } } from Meta
 *
 * Campaigns are grouped by Meta campaign id, so a renamed campaign stays one row.
 * Leads join to a campaign by any name that campaign has carried.
 */
export function buildCampaignReports({
  rows = [],
  ads = [],
  leads = [],
  campaignsMeta = {},
  targets = {},
  rangeDays,
  today,
  statusOk,
  accountId,
}) {
  const campaigns = new Map();
  const nameToId = new Map();

  for (const [id, m] of Object.entries(campaignsMeta)) {
    if (m?.name) nameToId.set(m.name, id);
  }

  for (const row of rows) {
    const id = row['Campaign ID'];
    if (!id) continue;
    if (!campaigns.has(id)) {
      campaigns.set(id, { id, spend: 0, adSpend: new Map(), leadRows: [] });
    }
    const c = campaigns.get(id);
    const spend = Number(row.Spend) || 0;
    c.spend += spend;
    if (row['Campaign Name']) nameToId.set(row['Campaign Name'], id);
    const adId = row['Ad ID'];
    if (adId) c.adSpend.set(adId, (c.adSpend.get(adId) || 0) + spend);
  }

  let unmatchedLeads = 0;
  for (const lead of leads) {
    const id = nameToId.get(lead.campaignName);
    const c = id ? campaigns.get(id) : null;
    if (!c) {
      unmatchedLeads++;
      continue;
    }
    c.leadRows.push(lead);
  }

  const reports = [];
  for (const c of campaigns.values()) {
    if (c.spend <= 0) continue;
    const meta = campaignsMeta[c.id] || {};
    const campaignAds = ads.filter((a) => a.campaignId === c.id);
    const adNames = new Set(campaignAds.map((a) => a.adName));

    const booked = c.leadRows.filter((l) => l.meetingBooked);
    const figures = {
      spend: c.spend,
      leads: c.leadRows.length,
      qualifiedLeads: c.leadRows.filter((l) => l.qualified).length,
      meetings: booked.length,
      qualifiedMeetings: c.leadRows.filter((l) => l.qualifiedMeeting).length,
      lpBookings: booked.filter((l) => !String(l.pickUpStatus || '').trim()).length,
      sdrBookings: booked.filter((l) => String(l.pickUpStatus || '').trim()).length,
      daysSinceStart: meta.startTime ? daysBetween(meta.startTime, today) : null,
      rangeDays,
    };

    // A lead whose ad name matches no ad in this campaign (renamed or deleted ad).
    const unmatchedAdLeads = c.leadRows.filter((l) => !adNames.has(l.adName));
    const unmatchedMeetings = unmatchedAdLeads.filter((l) => l.meetingBooked).length;

    // Two ads sharing a name both get that name's leads, so neither is flagged wrongly.
    const adRows = campaignAds.map((a) => {
      const mine = c.leadRows.filter((l) => l.adName === a.adName);
      return {
        adId: a.adId,
        adName: a.adName,
        status: a.status,
        statusKnown: a.statusKnown === true,
        spend: c.adSpend.get(a.adId) || 0,
        leads: mine.length,
        meetings: mine.filter((l) => l.meetingBooked).length,
      };
    });

    const verdict = campaignVerdict(figures, targets);
    const adWarning = adWarnings({ verdict, ads: adRows, targets, statusOk, unmatchedMeetings });
    const stop = stopWarning({ verdict, spend: c.spend, qualifiedMeetings: figures.qualifiedMeetings, targets });

    reports.push({
      id: c.id,
      name: meta.name || [...nameToId.entries()].find(([, v]) => v === c.id)?.[0] || c.id,
      ...figures,
      costPerMeeting: figures.meetings > 0 ? c.spend / figures.meetings : null,
      costPerQualifiedMeeting: figures.qualifiedMeetings > 0 ? c.spend / figures.qualifiedMeetings : null,
      costPerLead: figures.leads > 0 ? c.spend / figures.leads : null,
      unmatchedAdLeads: unmatchedAdLeads.length,
      // Ads that spent in the range or are live now, biggest spender first.
      ads: adRows
        .filter((a) => a.spend > 0 || a.status === 'ACTIVE')
        .sort((a, b) => b.spend - a.spend)
        .map((a) => ({ ...a, share: c.spend > 0 ? a.spend / c.spend : 0 })),
      verdict,
      adWarning,
      stop,
      link: adsManagerLink(accountId, c.id, 'ads'),
      campaignLink: adsManagerLink(accountId, c.id, 'campaigns'),
    });
  }

  reports.sort((a, b) => b.spend - a.spend);

  const warningCount = reports.reduce((n, r) => {
    const adCount = r.adWarning.state === 'flagged' ? r.adWarning.ads.length : r.adWarning.state === 'all' ? 1 : 0;
    return n + adCount + (r.stop ? 1 : 0);
  }, 0);

  return { campaigns: reports, unmatchedLeads, warningCount };
}
