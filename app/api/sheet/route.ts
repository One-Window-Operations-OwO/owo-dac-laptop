import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function POST(request: Request) {
    try {
        const { serviceAccount, verifikator } = await request.json();
        // Use environment variable for Spreadsheet ID
        const spreadsheetId = process.env.SPREADSHEET_ID;

        console.log(`API Call - Verifikator: "${verifikator}", SpreadsheetID: "${spreadsheetId ? 'Found' : 'Missing'}"`);

        if (!serviceAccount || !spreadsheetId || !verifikator) {
            return NextResponse.json({ success: false, message: 'Missing required parameters or SPREADSHEET_ID env var' }, { status: 400 });
        }

        // Initialize Auth
        // serviceAccount is the JSON object from the client
        const auth = new google.auth.GoogleAuth({
            credentials: serviceAccount,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const sheets = google.sheets({ version: 'v4', auth });

        // Fetch data
        const range = 'A:V'; // Covers up to column V

        console.log('Fetching sheet data...');
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            console.log('No rows found in sheet.');
            return NextResponse.json({ success: true, data: [] });
        }

        console.log(`Total rows fetched: ${rows.length}`);

        // Filter Logic
        // B (Index 1): VERIFIKATOR == verifikator
        // V (Index 21): STATUS == "" (empty) or undefined (if row is short)

        const filtered = rows.filter((row, index) => {
            // Skip header? Assuming row 0 is header.
            if (index === 0) return false;

            const rowVerifikator = row[1] ? row[1].trim() : '';
            // Status might be undefined if the row ends early, or empty string
            const rowStatus = row[21] ? row[21].trim() : '';

            // Debug first few rows to verify column mapping
            if (index < 5) {
                console.log(`Row ${index + 1}: B(Verif)="${rowVerifikator}" | V(Status)="${rowStatus}" | Match? ${rowVerifikator === verifikator && rowStatus === ''}`);
            }

            return rowVerifikator === verifikator && rowStatus === '';
        });

        console.log(`Filtered count: ${filtered.length}`);

        // Map to result structure
        // C: NPSN (Index 2)
        // F: NAMA SEKOLAH (Index 5)
        // M: SERIAL NUMBER WEB DAC (Index 12)

        const results = filtered.map(row => ({
            npsn: row[2] || '',
            nama_sekolah: row[5] || '',
            serial_number: row[12] || '',
            // Include others if needed for context
            verifikator: row[1],
            row_index: rows.indexOf(row) + 1 // 1-based index in sheet
        }));

        return NextResponse.json({ success: true, count: results.length, data: results });

    } catch (error: any) {
        console.error('Sheet API Error:', error);
        return NextResponse.json({ success: false, message: error.message || 'Failed to fetch sheets' }, { status: 500 });
    }
}
