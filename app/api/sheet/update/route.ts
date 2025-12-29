import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function POST(request: Request) {
    try {
        const { serviceAccount, spreadsheetId, updates } = await request.json();
        // updates: Array of { rowIndex: number, values: { [colLetter]: string } }

        const targetSpreadsheetId = spreadsheetId || process.env.SPREADSHEET_ID;

        if (!serviceAccount || !targetSpreadsheetId || !updates || !Array.isArray(updates)) {
            return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
        }

        const auth = new google.auth.GoogleAuth({
            credentials: serviceAccount,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const sheets = google.sheets({ version: 'v4', auth });

        // Prepare batch updates
        // We will use valueInputOption = 'RAW' (or 'USER_ENTERED' if we want parsing)
        const data = [];

        for (const update of updates) {
            const { rowIndex, values } = update;
            // values is object like { "G": "Sesuai", "H": "Tidak Sesuai" }

            for (const [col, val] of Object.entries(values)) {
                data.push({
                    range: `${col}${rowIndex}`, // e.g. "G5"
                    values: [[val]]
                });
            }
        }

        if (data.length === 0) {
            return NextResponse.json({ success: true, message: 'No updates to apply' });
        }

        console.log(`Applying ${data.length} cell updates to spreadsheet...`);

        // Using batchUpdate for values
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: targetSpreadsheetId,
            requestBody: {
                valueInputOption: 'USER_ENTERED', // Allow string to be interpreted if needed, mostly for safety/formatting
                data: data
            }
        });

        return NextResponse.json({ success: true, message: `Updated ${data.length} cells` });

    } catch (error: any) {
        console.error('Sheet Update Error:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
