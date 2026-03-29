import { fetchSheetData } from './sheets';

// Same spreadsheet as the leads tracker — just a different tab ("Notes")
const SHEET_ID = '18UReQjJDNgP0976BPiaOjP9DRcxvA6e-Q8SsCiS0aMc';
const NOTES_TAB = 'Notes';

/**
 * Fetch campaign notes from the "Notes" tab in the leads tracker sheet.
 * Uses Google Visualization API (read-only, no auth — sheet already has link sharing).
 *
 * Sheet structure: Tab "Notes", columns: Date | Client | Note
 * - Date: stored as D/M/YYYY text (e.g. "24/3/2026")
 * - Client: client slug (e.g. "eddie-senatore")
 * - Note: free-text log entry
 */
export async function fetchNotes(clientSlug) {
  try {
    const rows = await fetchSheetData(SHEET_ID, NOTES_TAB);

    const notes = rows
      .filter((row) => !clientSlug || row.Client === clientSlug)
      .map((row) => ({
        date: row.Date || '',
        client: row.Client || '',
        note: row.Note || '',
      }));

    // Reverse so newest notes are first (sheet appends to bottom)
    return notes.reverse();
  } catch (e) {
    console.error('Failed to fetch notes:', e);
    return [];
  }
}

/**
 * Append a new note to the "Notes" tab in the leads tracker sheet.
 * Requires Google Sheets API credentials (service account).
 */
export async function appendNote({ client, date, note }) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!email || !key) {
    throw new Error(
      'Google service account not configured — add GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY to .env.local'
    );
  }

  const { google } = await import('googleapis');

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${NOTES_TAB}!A:C`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[date, client, note]],
    },
  });
}
