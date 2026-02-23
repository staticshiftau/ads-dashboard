export const clients = [
  {
    slug: 'static-shift',
    name: 'Static Shift',
    sheetId: null, // No ad performance sheet yet — uses leads tracker only
    sheetTab: null,
    fbAdAccountId: null,
    slackChannelId: null,
    isAgency: true, // Flag for Static Shift's own ads
  },
  {
    slug: 'fusion-financial-group',
    name: 'Fusion Financial Group',
    sheetId: '1oQ5tmmmCQyMFChcltKFglVB4l8WxO-oMdvY_Ab3Vcp8',
    sheetTab: 'Ad Performance',
    fbAdAccountId: 'act_495114407769858',
    slackChannelId: 'C0ADFT0RAUC',
  },
  {
    slug: 'corbel',
    name: 'Corbel',
    sheetId: '1WKcbEPkbO-ljR5xJHURWMdg1ip6MiNwFsdmQK52hp6g',
    sheetTab: 'Ad Performance',
    fbAdAccountId: 'act_3634319663373564',
    slackChannelId: 'C094VED5TM2',
  },
  {
    slug: 'eddie-senatore',
    name: 'Eddie Senatore',
    sheetId: '1OQxNLz4IuwsVOSVBTOyvZK-a_9mog81Cns5XGZYBFXU',
    sheetTab: 'Ad Performance',
    fbAdAccountId: 'act_383005220104049',
    slackChannelId: 'C094MMSRF5Z',
  },
  {
    slug: 'stirling-marketing',
    name: 'Stirling Marketing',
    sheetId: '1UfadxXUqOZ43zZNmsSZuR9YmMx75la4enfMzaz27eTk',
    sheetTab: 'Ad Performance',
    fbAdAccountId: 'act_2250556082119896',
    slackChannelId: 'C095FE6NZ3J',
  },
];

export function getClient(slug) {
  return clients.find((c) => c.slug === slug);
}
