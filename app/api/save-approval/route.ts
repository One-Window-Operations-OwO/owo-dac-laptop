import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { status, id, npsn, resi, note, session_id } = await request.json();

        if (!status || !id || !npsn || !resi || !session_id) {
            return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
        }

        const formData = new URLSearchParams();
        formData.append('status', status.toString()); // 2 for terima, 3 for tolak
        formData.append('id', id);
        formData.append('npsn', npsn);
        formData.append('resi', resi);
        formData.append('note', note || ''); // Optional, mainly for rejection

        const targetUrl = 'https://kemdikdasmen.mastermedia.co.id/app/approval/save_approval';

        console.log(`Submitting approval: Status=${status}, ID=${id}, NPSN=${npsn}, Resi=${resi}`);

        const res = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Cookie': `ci_session=${session_id}`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            body: formData.toString()
        });

        const responseText = await res.text();
        console.log('Save Approval API Response:', responseText);

        // Check for session rotation
        let newSessionId = null;
        const setCookie = res.headers.get('set-cookie');
        if (setCookie) {
            const match = setCookie.match(/ci_session=([^;]+)/);
            if (match && match[1]) {
                newSessionId = match[1];
                console.log('Session rotated during save:', newSessionId);
            }
        }

        // Response is usually JSON, but might be plain text success/fail
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            data = { raw: responseText };
        }

        return NextResponse.json({
            success: res.ok,
            status: res.status,
            data,
            newSessionId
        });

    } catch (error: any) {
        console.error('Save Approval Error:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
