import { NextResponse } from 'next/server';
import { fetchNotes, appendNote } from '@/lib/notes';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const client = searchParams.get('client');

  const headers = {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  };

  try {
    const notes = await fetchNotes(client);
    return NextResponse.json({ notes }, { headers });
  } catch (error) {
    return NextResponse.json(
      { notes: [], error: error.message },
      { status: 500, headers }
    );
  }
}

export async function POST(request) {
  const headers = {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  };

  try {
    const body = await request.json();
    const { client, note, date } = body;

    if (!client || !note) {
      return NextResponse.json(
        { error: 'Client and note are required' },
        { status: 400, headers }
      );
    }

    const noteDate =
      date ||
      new Date().toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
      });

    await appendNote({ client, date: noteDate, note });
    return NextResponse.json({ success: true }, { headers });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers }
    );
  }
}
