import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { npsn, nama_sekolah, sn, session_id } = await request.json();

        if (!npsn || !nama_sekolah || !sn || !session_id) {
            return NextResponse.json({ success: false, message: 'Missing parameters' }, { status: 400 });
        }

        // Construct the body for x-www-form-urlencoded
        // npsn format: "20215401+-+SD+NEGERI+2+KEPONGPONGAN+KECAMATAN+TALUN"
        // It seems they want spaces replaced by '+' or standard URL encoding which usually encodes space as %20 or +.
        // Standard URLSearchParams encodes space as '+'.

        // Combining NPSN and Nama Sekolah
        const npsnValue = `${npsn} - ${nama_sekolah}`;

        const formData = new URLSearchParams();
        formData.append('draw', '1');
        formData.append('status', 'all');
        formData.append('npsn', npsnValue);
        formData.append('termin', 'all');
        formData.append('sn', sn);
        formData.append('start', '0');
        formData.append('length', '10');

        let newSessionId = null;

        const extractIdFromData = (parsedData: any) => {
            let extracted = null;
            if (parsedData && parsedData.data && Array.isArray(parsedData.data) && parsedData.data.length > 0) {
                // Try to find a row whose NPSN column matches the requested npsn first.
                // In the response array each row is: [no, bapp_id, npsn, nama_sekolah, item_name, sn, status, action_html]
                // NPSN is at index 2.
                const NPSN_INDEX = 2;

                // Prefer the row that matches the requested NPSN. If none matches, fall back to the
                // first row so we don't silently produce a wrong approval from another school.
                const matchingRow = parsedData.data.find(
                    (row: any[]) => String(row[NPSN_INDEX]).trim() === String(npsn).trim()
                );
                const row = matchingRow ?? null;

                if (!row) {
                    console.log(
                        `No row matching NPSN "${npsn}" found in approval data. ` +
                        `Available NPSNs: ${parsedData.data.map((r: any[]) => r[NPSN_INDEX]).join(', ')}`
                    );
                    return null;
                }

                for (let i = 0; i < row.length; i++) {
                    if (typeof row[i] === 'string' && row[i].includes('data-id=')) {
                        const match = row[i].match(/data-id=['"]([^'"]+)['"]/);
                        if (match && match[1]) {
                            extracted = match[1];
                            console.log(`Extracted ID found at index ${i} for NPSN ${npsn}:`, extracted);
                            break;
                        }
                    }
                }
                if (!extracted) {
                    console.log('No extracted ID found in matched row. Row was:', row);
                }
            } else {
                console.log('API returned empty or invalid data.data');
            }
            return extracted;
        };

        const targetUrl = 'https://kemdikdasmen.mastermedia.co.id/app/approval/datatable';
        const targetUrlFallback = 'https://kemdikdasmen.mastermedia.co.id/app/approval/filter_table';
        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Cookie': `ci_session=${session_id}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        };

        const fetchWithData = async (url: string, form: URLSearchParams) => {
            const res = await fetch(url, { method: 'POST', headers, body: form.toString() });
            const responseText = await res.text();

            let parsedData;
            try { parsedData = JSON.parse(responseText); } catch (e) { parsedData = responseText; }

            // Extract session id if set
            const setCookie = res.headers.get('set-cookie');
            if (setCookie) {
                const match = setCookie.match(/ci_session=([^;]+)/);
                if (match && match[1]) newSessionId = match[1];
            }
            return { res, parsedData };
        };

        let { res, parsedData: data } = await fetchWithData(targetUrl, formData);

        // If 404, the endpoint might have changed to targetUrlFallback
        if (res.status === 404) {
            console.log('Got 404 on filter_table, trying fallback URL');
            const fallbackRes = await fetchWithData(targetUrlFallback, formData);
            res = fallbackRes.res;
            data = fallbackRes.parsedData;
        }

        let extractedId = extractIdFromData(data);

        // FALLBACK 1: If strictly searching by "NPSN - Nama Sekolah" yields 0 rows, try just "NPSN" code
        if (!extractedId && data && data.data && data.data.length === 0) {
            console.log('Strict NPSN filter returned 0 rows. Trying fallback with NPSN code only:', npsn);
            formData.set('npsn', npsn);
            const fallback1 = await fetchWithData(targetUrl, formData);
            if (fallback1.res.status === 404) {
                const f2 = await fetchWithData(targetUrlFallback, formData);
                res = f2.res; data = f2.parsedData;
            } else {
                res = fallback1.res; data = fallback1.parsedData;
            }
            extractedId = extractIdFromData(data);
        }

        // FALLBACK 2: If searching by NPSN code still yields 0 rows, try searching across all schools just by SN
        if (!extractedId && data && data.data && data.data.length === 0) {
            console.log('NPSN code filter returned 0 rows. Trying fallback with empty NPSN (only SN filter).');
            formData.set('npsn', '');
            const fallback2 = await fetchWithData(targetUrl, formData);
            if (fallback2.res.status === 404) {
                const f2 = await fetchWithData(targetUrlFallback, formData);
                res = f2.res; data = f2.parsedData;
            } else {
                res = fallback2.res; data = fallback2.parsedData;
            }
            extractedId = extractIdFromData(data);
        }

        return NextResponse.json({
            success: res.ok,
            status: res.status,
            data: data,
            extractedId,
            newSessionId
        });

    } catch (error: any) {
        console.error('Check Approval Error:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
