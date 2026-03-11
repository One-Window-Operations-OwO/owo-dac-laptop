import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { npsn, nama_sekolah, sn, session_id, no_bapp } = await request.json();

        if (!npsn || !nama_sekolah || !sn || !session_id) {
            return NextResponse.json({ success: false, message: 'Missing parameters' }, { status: 400 });
        }

        // Combining NPSN and Nama Sekolah for the datatable filter
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
                const NPSN_INDEX = 2;

                // Rows that match the requested NPSN
                const npsnRows = parsedData.data.filter(
                    (row: any[]) => String(row[NPSN_INDEX]).trim() === String(npsn).trim()
                );

                if (npsnRows.length === 0) {
                    console.log(
                        `No row matching NPSN "${npsn}" found. ` +
                        `Available NPSNs: ${parsedData.data.map((r: any[]) => r[NPSN_INDEX]).join(', ')}`
                    );
                    return null;
                }

                // If no_bapp is provided, try to find the exact row.
                // From the actual API response, row[1] is the FULL no_bapp string
                // (e.g. "127777/BAPP/M2-KEMENDIKDASMEN/2025"), not a bare number.
                // Strategy (ordered by reliability):
                //   1. Exact string match: row[1] === no_bapp
                //   2. startsWith numeric prefix: row[1].startsWith("127777")
                //   3. Full-text .includes() across all cells (catch-all)
                //   4. Warn and fall back to first matching NPSN row
                const BAPP_ID_INDEX = 1;
                let row: any[] | null = null;
                if (no_bapp && npsnRows.length > 1) {
                    const normalizedNoBapp = String(no_bapp).trim();
                    const numericPrefix = normalizedNoBapp.match(/^(\d+)/)?.[1] ?? '';

                    let matched: any[] | undefined;

                    // 1. Exact match on row[1]
                    matched = npsnRows.find((r: any[]) =>
                        String(r[BAPP_ID_INDEX]).trim() === normalizedNoBapp
                    );
                    if (matched) {
                        console.log(`[NoBAPP] Exact match on row[1] for "${normalizedNoBapp}".`);
                    }

                    // 2. row[1].startsWith(numericPrefix) — reliable even if suffix differs
                    if (!matched && numericPrefix) {
                        matched = npsnRows.find((r: any[]) =>
                            String(r[BAPP_ID_INDEX]).trim().startsWith(numericPrefix)
                        );
                        if (matched) {
                            console.log(`[NoBAPP] Matched row[1] via startsWith("${numericPrefix}").`);
                        }
                    }

                    // 3. Full-text .includes() across all string cells
                    if (!matched) {
                        const lowerTarget = normalizedNoBapp.toLowerCase();
                        matched = npsnRows.find((r: any[]) =>
                            r.some((cell: any) =>
                                typeof cell === 'string' &&
                                cell.toLowerCase().includes(lowerTarget)
                            )
                        );
                        if (matched) {
                            console.log(`[NoBAPP] Matched via full-text search for "${normalizedNoBapp}".`);
                        }
                    }

                    if (matched) {
                        row = matched;
                    } else {
                        console.warn(
                            `[NoBAPP] All strategies failed for no_bapp "${normalizedNoBapp}". ` +
                            `Row bapp values: ${npsnRows.map((r: any[]) => r[BAPP_ID_INDEX]).join(' | ')}. ` +
                            `Falling back to first NPSN match.`
                        );
                        row = npsnRows[0];
                    }
                } else {
                    if (no_bapp && npsnRows.length === 1) {
                        console.log(`[NoBAPP] Only one NPSN row; using it (hint: "${no_bapp}").`);
                    }
                    row = npsnRows[0];
                }

                if (!row) return null;

                for (let i = 0; i < row.length; i++) {
                    if (typeof row[i] === 'string' && row[i].includes('data-id=')) {
                        const match = row[i].match(/data-id=['"]([^'"]+)['"]/);
                        if (match && match[1]) {
                            extracted = match[1];
                            console.log(`Extracted ID at index ${i} for NPSN ${npsn}${no_bapp ? ` / no_bapp ${no_bapp}` : ''}:`, extracted);
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
            console.log('Got 404 on datatable, trying fallback URL');
            const fallbackRes = await fetchWithData(targetUrlFallback, formData);
            res = fallbackRes.res;
            data = fallbackRes.parsedData;
        }

        let extractedId = extractIdFromData(data);

        // FALLBACK 1: If strictly searching by "NPSN - Nama Sekolah" yields 0 rows, try just NPSN code
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

        // FALLBACK 2: If NPSN code still yields 0 rows, try searching only by SN
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
