import { NextResponse } from 'next/server';
import { getClient } from '@/lib/clients';
import { readAllSettings, appendSettings, EMPTY_TARGETS } from '@/lib/settings';
import { validateTargets } from '@/lib/verdict';
import { fetchAccountCurrency } from '@/lib/meta';

export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

export async function GET(request) {
  const slug = new URL(request.url).searchParams.get('client');
  const client = getClient(slug);
  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404, headers });
  }

  try {
    const [all, currency] = await Promise.all([
      readAllSettings(),
      fetchAccountCurrency(client.fbAdAccountId),
    ]);
    return NextResponse.json({ targets: all[slug] || { ...EMPTY_TARGETS }, currency }, { headers });
  } catch (error) {
    // Never answer a failed read with blank targets.
    return NextResponse.json({ error: error.message }, { status: 502, headers });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const client = getClient(body?.client);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404, headers });
    }

    const { values, error } = validateTargets(body.targets || {});
    if (error) {
      return NextResponse.json({ error }, { status: 400, headers });
    }

    await appendSettings(client.slug, values);
    return NextResponse.json({ success: true, targets: values }, { headers });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Save failed' }, { status: 500, headers });
  }
}
