export const clients = [
  {
    slug: 'static-shift',
    name: 'Static Shift',
    sheetId: null,
    sheetTab: null,
    fbAdAccountId: 'act_990085855697029',
    slackChannelId: null,
    isAgency: true, // Flag for Static Shift's own ads
  },
  {
    slug: 'ange-henderson',
    name: 'Ange Henderson',
    sheetId: null,
    sheetTab: null,
    fbAdAccountId: 'act_412201883071384',
    slackChannelId: 'C093TJ273M2', // notifications-ange
    // Ange's ad account is shared with other agencies. Only track campaigns
    // Static Shift runs - all of ours start with "SS" ("SS | ...", "SS 2026 | ...",
    // "SS Retest | ...").
    metaCampaignFilter: 'SS',
  },
  {
    slug: 'nine-advisory',
    name: 'Nine Advisory',
    sheetId: null,
    sheetTab: null,
    fbAdAccountId: 'act_543814312127728',
    slackChannelId: 'C0B900AG2SD', // notifications-nine-advisory
  },
];

export function getClient(slug) {
  return clients.find((c) => c.slug === slug);
}
