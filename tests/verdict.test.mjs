import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  campaignVerdict,
  adWarnings,
  stopWarning,
  buildCampaignReports,
  validateTargets,
} from '../src/lib/verdict.js';

const T = {
  costPerMeeting: 400,
  costPerQualifiedMeeting: 500,
  cpl: 150,
  callQualifiedRate: 70,
  leadQualifiedRate: 60,
};
const base = {
  spend: 2000,
  leads: 20,
  qualifiedLeads: 15,
  meetings: 5,
  qualifiedMeetings: 4,
  lpBookings: 2,
  sdrBookings: 3,
  daysSinceStart: 30,
  rangeDays: 30,
};

// --- AC6: one test per branch ---
test('range under 5 days gives no verdict', () => {
  const v = campaignVerdict({ ...base, rangeDays: 3 }, T);
  assert.equal(v.code, 'range_too_short');
  assert.equal(v.actionable, false);
});

test('campaign under 5 days old: do not touch', () => {
  const v = campaignVerdict({ ...base, daysSinceStart: 2 }, T);
  assert.equal(v.code, 'dont_touch');
  assert.match(v.label, /day 3 of 5/);
  assert.equal(v.actionable, false);
});

test('cost per meeting and qualified rate at KPI: on KPI', () => {
  const v = campaignVerdict(base, T); // $400 per meeting, 80% qualified
  assert.equal(v.code, 'on_kpi');
  assert.equal(v.actionable, false);
});

test('cost per meeting at KPI but call-qualified rate under: lead quality', () => {
  const v = campaignVerdict({ ...base, qualifiedMeetings: 2 }, T); // 40%
  assert.equal(v.code, 'lead_quality');
  assert.equal(v.actionable, true);
});

test('cost per meeting off KPI and CPL over target: improve CPL', () => {
  const v = campaignVerdict({ ...base, meetings: 2, qualifiedMeetings: 2, leads: 10, qualifiedLeads: 8 }, T);
  assert.equal(v.code, 'improve_cpl'); // $1000 per meeting, $200 CPL
});

test('cost per meeting off, CPL fine, lead-qualified rate under: lead quality', () => {
  const v = campaignVerdict({ ...base, meetings: 2, qualifiedMeetings: 2, qualifiedLeads: 8 }, T); // 40%
  assert.equal(v.code, 'lead_quality');
});

test('cost per meeting off, CPL and lead quality fine: booking rate', () => {
  const v = campaignVerdict({ ...base, meetings: 2, qualifiedMeetings: 2, lpBookings: 1, sdrBookings: 1 }, T);
  assert.equal(v.code, 'booking_rate');
  assert.match(v.detail, /landing page 1/i);
  assert.match(v.detail, /SDR 1/);
});

// --- edge cases ---
test('no booked meetings counts as off KPI, not a divide by zero', () => {
  const v = campaignVerdict({ ...base, meetings: 0, qualifiedMeetings: 0, lpBookings: 0, sdrBookings: 0 }, T);
  assert.equal(v.code, 'booking_rate');
});

test('spend with zero leads: improve CPL', () => {
  const v = campaignVerdict(
    { ...base, leads: 0, qualifiedLeads: 0, meetings: 0, qualifiedMeetings: 0 },
    T
  );
  assert.equal(v.code, 'improve_cpl');
});

// --- AC7: blank targets ---
test('no targets at all: set targets', () => {
  const v = campaignVerdict(base, {});
  assert.equal(v.code, 'set_targets');
  assert.equal(v.actionable, false);
});

test('blank CPL target is skipped and named', () => {
  const v = campaignVerdict({ ...base, meetings: 2, qualifiedMeetings: 2, leads: 10, qualifiedLeads: 8 }, { ...T, cpl: null });
  assert.equal(v.code, 'booking_rate');
  assert.ok(v.missing.includes('cost per lead'));
});

test('blank call-qualified target is named when on KPI', () => {
  const v = campaignVerdict(base, { ...T, callQualifiedRate: null });
  assert.equal(v.code, 'on_kpi');
  assert.ok(v.missing.includes('call-qualified rate'));
});

// --- AC10-12: ad warnings ---
const actionable = { code: 'booking_rate', actionable: true };
const ads = [
  { adId: '1', adName: 'A', status: 'ACTIVE', statusKnown: true, spend: 600, leads: 4, meetings: 0 },
  { adId: '2', adName: 'B', status: 'ACTIVE', statusKnown: true, spend: 300, leads: 3, meetings: 0 },
  { adId: '3', adName: 'C', status: 'ACTIVE', statusKnown: true, spend: 700, leads: 5, meetings: 2 },
  { adId: '4', adName: 'D', status: 'PAUSED', statusKnown: true, spend: 900, leads: 1, meetings: 0 },
];

test('flags active ads past target with no meetings', () => {
  const w = adWarnings({ verdict: actionable, ads, targets: T, statusOk: true, unmatchedMeetings: 0 });
  assert.equal(w.state, 'flagged');
  assert.deepEqual(w.ads.map((a) => a.adName), ['A']);
});

test('paused ads are never suggested', () => {
  const w = adWarnings({ verdict: actionable, ads, targets: T, statusOk: true, unmatchedMeetings: 0 });
  assert.ok(!w.ads.some((a) => a.adName === 'D'));
});

test('an ad whose status is only the placeholder is not flagged', () => {
  const w = adWarnings({
    verdict: actionable,
    ads: [{ ...ads[0], statusKnown: false }, ads[2]],
    targets: T,
    statusOk: true,
    unmatchedMeetings: 0,
  });
  assert.equal(w.state, 'none');
});

test('no ad warnings when the campaign is on KPI or held', () => {
  for (const code of ['on_kpi', 'dont_touch']) {
    const w = adWarnings({ verdict: { code, actionable: false }, ads, targets: T, statusOk: true, unmatchedMeetings: 0 });
    assert.equal(w.state, 'none');
    assert.equal(w.ads.length, 0);
  }
});

test('status fetch failed: status unavailable, nothing flagged', () => {
  const w = adWarnings({ verdict: actionable, ads, targets: T, statusOk: false, unmatchedMeetings: 0 });
  assert.equal(w.state, 'status_unavailable');
  assert.equal(w.ads.length, 0);
});

test('no qualified-meeting target: ad warnings do not run', () => {
  const w = adWarnings({ verdict: actionable, ads, targets: { ...T, costPerQualifiedMeeting: null }, statusOk: true, unmatchedMeetings: 0 });
  assert.equal(w.state, 'no_target');
});

test('unmatched booked meetings in the campaign block ad flags', () => {
  const w = adWarnings({ verdict: actionable, ads, targets: T, statusOk: true, unmatchedMeetings: 1 });
  assert.equal(w.state, 'unmatched');
  assert.equal(w.ads.length, 0);
});

test('every active ad past target: stop-or-rebuild note, not a list', () => {
  const w = adWarnings({ verdict: actionable, ads: [ads[0], { ...ads[1], spend: 800 }, ads[3]], targets: T, statusOk: true, unmatchedMeetings: 0 });
  assert.equal(w.state, 'all');
});

// --- AC13: stop warning ---
test('stop warning at 2x target with no qualified meetings', () => {
  assert.equal(stopWarning({ verdict: actionable, spend: 1000, qualifiedMeetings: 0, targets: T }), true);
  assert.equal(stopWarning({ verdict: actionable, spend: 999, qualifiedMeetings: 0, targets: T }), false);
});

test('stop warning also fires with qualified meetings when each costs 2x target or more', () => {
  // target $500: 1 meeting for $5000 = $5000 each; 3 for $3000 = $1000 each; 3 for $2999 is under 2x
  assert.equal(stopWarning({ verdict: actionable, spend: 5000, qualifiedMeetings: 1, targets: T }), true);
  assert.equal(stopWarning({ verdict: actionable, spend: 3000, qualifiedMeetings: 3, targets: T }), true);
  assert.equal(stopWarning({ verdict: actionable, spend: 2999, qualifiedMeetings: 3, targets: T }), false);
  assert.equal(stopWarning({ verdict: actionable, spend: 900, qualifiedMeetings: 1, targets: T }), false);
});

test('a campaign on KPI never gets a stop warning', () => {
  assert.equal(stopWarning({ verdict: { code: 'on_kpi', actionable: false }, spend: 5000, qualifiedMeetings: 1, targets: T }), false);
});

test('no stop warning inside the 5-day window or without a target', () => {
  assert.equal(stopWarning({ verdict: { code: 'dont_touch', actionable: false }, spend: 5000, qualifiedMeetings: 0, targets: T }), false);
  assert.equal(stopWarning({ verdict: actionable, spend: 5000, qualifiedMeetings: 0, targets: { ...T, costPerQualifiedMeeting: null } }), false);
});

// --- AC7a + shared join ---
const today = '2026-11-10';
const rows = [
  { 'Campaign ID': 'c1', 'Campaign Name': 'Camp One', 'Ad ID': '1', 'Ad Name': 'A', Spend: 600 },
  { 'Campaign ID': 'c1', 'Campaign Name': 'Camp One', 'Ad ID': '3', 'Ad Name': 'C', Spend: 700 },
  { 'Campaign ID': 'c1', 'Campaign Name': 'Camp One renamed', 'Ad ID': '3', 'Ad Name': 'C', Spend: 100 },
];
const adList = [
  { adId: '1', adName: 'A', campaignId: 'c1', status: 'ACTIVE', statusKnown: true },
  { adId: '3', adName: 'C', campaignId: 'c1', status: 'ACTIVE', statusKnown: true },
];
const lead = (o) => ({ campaignName: 'Camp One', adName: 'C', qualified: true, meetingBooked: false, qualifiedMeeting: false, pickUpStatus: '', ...o });
const meta = { c1: { name: 'Camp One renamed', startTime: '2026-09-01T00:00:00+1000' } };

test('a renamed campaign stays one row, grouped by campaign id', () => {
  const r = buildCampaignReports({ rows, ads: adList, leads: [lead({}), lead({ campaignName: 'Camp One renamed' })], campaignsMeta: meta, targets: T, rangeDays: 30, today, statusOk: true, accountId: 'act_123' });
  assert.equal(r.campaigns.length, 1);
  assert.equal(r.campaigns[0].spend, 1400);
  assert.equal(r.campaigns[0].leads, 2);
  assert.equal(r.campaigns[0].name, 'Camp One renamed');
  assert.match(r.campaigns[0].link, /act=123/);
  assert.match(r.campaigns[0].link, /c1/);
});

test('leads that match no campaign are counted once at client level', () => {
  const r = buildCampaignReports({ rows, ads: adList, leads: [lead({ campaignName: 'Something else' })], campaignsMeta: meta, targets: T, rangeDays: 30, today, statusOk: true, accountId: 'act_123' });
  assert.equal(r.unmatchedLeads, 1);
  assert.equal(r.campaigns[0].leads, 0);
});

test('campaign with spend but no tracker leads still gets a verdict', () => {
  const r = buildCampaignReports({ rows, ads: adList, leads: [], campaignsMeta: meta, targets: T, rangeDays: 30, today, statusOk: true, accountId: 'act_123' });
  assert.equal(r.campaigns[0].verdict.code, 'improve_cpl');
  assert.equal(r.campaigns[0].stop, true);
});

test('a booked meeting on a lead whose ad name matches no ad blocks ad flags', () => {
  const r = buildCampaignReports({ rows, ads: adList, leads: [lead({ adName: 'Old name', meetingBooked: true, qualifiedMeeting: true })], campaignsMeta: meta, targets: T, rangeDays: 30, today, statusOk: true, accountId: 'act_123' });
  assert.equal(r.campaigns[0].adWarning.state, 'unmatched');
});

test('landing page v SDR split follows the pick_up rule', () => {
  const r = buildCampaignReports({ rows, ads: adList, leads: [lead({ meetingBooked: true }), lead({ meetingBooked: true, pickUpStatus: 'TRUE' })], campaignsMeta: meta, targets: T, rangeDays: 30, today, statusOk: true, accountId: 'act_123' });
  assert.equal(r.campaigns[0].lpBookings, 1);
  assert.equal(r.campaigns[0].sdrBookings, 1);
});

test('warning count adds ad warnings and stop warnings', () => {
  const r = buildCampaignReports({ rows, ads: adList, leads: [], campaignsMeta: meta, targets: T, rangeDays: 30, today, statusOk: true, accountId: 'act_123' });
  assert.equal(r.warningCount, 2); // every active ad past target (one note) + stop
});

// --- AC3: validation ---
test('targets: blanks allowed, zero, negative and text rejected', () => {
  assert.deepEqual(validateTargets({ cpl: '', costPerMeeting: '400' }).values, {
    costPerMeeting: 400, costPerQualifiedMeeting: null, cpl: null, callQualifiedRate: null, leadQualifiedRate: null,
  });
  assert.ok(validateTargets({ cpl: '0' }).error);
  assert.ok(validateTargets({ cpl: '-5' }).error);
  assert.ok(validateTargets({ cpl: 'abc' }).error);
  assert.ok(validateTargets({ callQualifiedRate: '140' }).error);
});

// --- AC5: a failed settings read throws, it never reads as "no targets" ---
import { readAllSettings } from '../src/lib/settings.js';
import { fetchAllLeadsWithStatus } from '../src/lib/leads.js';

const gviz = (cols, rows) =>
  `/*O_o*/\ngoogle.visualization.Query.setResponse(${JSON.stringify({
    status: 'ok',
    table: { cols: cols.map((label) => ({ label })), rows: rows.map((r) => ({ c: r.map((v) => (v === null ? null : { v })) })) },
  })});`;
const withFetch = async (impl, fn) => {
  const real = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = real;
  }
};
const SETTINGS_COLS = ['Date', 'Client', 'CostPerMeeting', 'CostPerQualifiedMeeting', 'CPL', 'CallQualifiedRate', 'LeadQualifiedRate'];

test('settings: HTTP failure throws', async () => {
  await withFetch(async () => ({ ok: false, status: 500, text: async () => '' }), async () => {
    await assert.rejects(readAllSettings(), /Settings read failed/);
  });
});

test('settings: an HTML page instead of data throws', async () => {
  await withFetch(async () => ({ ok: true, text: async () => '<!DOCTYPE html><html></html>' }), async () => {
    await assert.rejects(readAllSettings(), /Settings read failed/);
  });
});

test('settings: a gviz error throws', async () => {
  await withFetch(async () => ({ ok: true, text: async () => 'x({"status":"error"});' }), async () => {
    await assert.rejects(readAllSettings(), /Settings read failed/);
  });
});

test('settings: wrong tab served (no Client column) throws', async () => {
  await withFetch(async () => ({ ok: true, text: async () => gviz(['Date', 'Note'], [['1/1/2026', 'hi']]) }), async () => {
    await assert.rejects(readAllSettings(), /missing or has the wrong headers/);
  });
});

test('settings: the last row per client wins and blanks stay blank', async () => {
  const body = gviz(SETTINGS_COLS, [
    ['01/11/2026, 09:00', 'execlenz', 300, 400, 100, 70, 60],
    ['02/11/2026, 09:00', 'nine-advisory', null, 600, 82, null, null],
    ['03/11/2026, 09:00', 'execlenz', null, 500, 150, null, null],
  ]);
  await withFetch(async () => ({ ok: true, text: async () => body }), async () => {
    const all = await readAllSettings();
    assert.deepEqual(all.execlenz, { costPerMeeting: null, costPerQualifiedMeeting: 500, cpl: 150, callQualifiedRate: null, leadQualifiedRate: null });
    assert.equal(all['nine-advisory'].cpl, 82);
  });
});

// --- AC5a: a tab that fails to load is reported, not read as zero leads ---
test('leads: a failed tab is marked error and the others still load', async () => {
  const ok = gviz(['created_time', 'campaign_name'], [['2026-11-01T00:00:00+0000', 'X']]);
  await withFetch(
    async (url) => {
      if (String(url).includes('Nine%20Advisory')) throw new Error('network down');
      if (String(url).includes('ExecLenz')) return { ok: true, text: async () => 'x({"status":"error"});' };
      return { ok: true, text: async () => ok };
    },
    async () => {
      const { leads, tabStatus } = await fetchAllLeadsWithStatus();
      assert.equal(tabStatus['nine-advisory'], 'error');
      assert.equal(tabStatus.execlenz, 'error');
      assert.equal(tabStatus['static-shift'], 'ok');
      assert.ok(leads.length > 0);
      assert.ok(!leads.some((l) => l._clientSlug === 'nine-advisory'));
    }
  );
});
