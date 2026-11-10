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
    // Only the mastermind campaign ("SS | 11/05/26 - Mastermind direct campaign")
    // shows here (Karl, 2026-11-10). The conference, workshop and retest campaigns
    // in this account are a different set-up and are left out. Matches on "contains".
    metaCampaignFilter: 'Mastermind',
  },
  {
    slug: 'nine-advisory',
    name: 'Nine Advisory',
    sheetId: null,
    sheetTab: null,
    fbAdAccountId: 'act_543814312127728',
    slackChannelId: 'C0B900AG2SD', // notifications-nine-advisory
  },
  {
    slug: 'execlenz',
    name: 'ExecLenz',
    sheetId: null,
    sheetTab: null,
    fbAdAccountId: 'act_1412191834453486',
    slackChannelId: 'C0CAS8SJNUC', // notifications-execlenz
  },
];

export function getClient(slug) {
  return clients.find((c) => c.slug === slug);
}
