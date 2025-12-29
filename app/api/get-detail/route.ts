import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { id, session_id } = await request.json();

        if (!id || !session_id) {
            return NextResponse.json({ success: false, message: 'Missing id or session_id' }, { status: 400 });
        }

        const formData = new URLSearchParams();
        formData.append('id', id);

        const targetUrl = 'https://kemdikdasmen.mastermedia.co.id/app/approval/detail';
        console.log(`Fetching detail for ID: ${id}`);

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

        // Response expected: { status: "success", html: "..." }
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            // If not JSON, maybe raw HTML or error page?
            data = { status: 'unknown', html: responseText };
        }

        return NextResponse.json(data);

    } catch (error: any) {
        console.error('Get Detail Error:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
