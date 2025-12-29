import { NextResponse } from 'next/server';

export async function GET() {
    const serviceAccountJson = process.env.SERVICE_ACCOUNT_JSON;

    if (!serviceAccountJson) {
        return NextResponse.json({ error: 'Service Account configuration missing' }, { status: 500 });
    }

    try {
        // Ensure it is valid JSON before sending
        const parsed = JSON.parse(serviceAccountJson);
        return NextResponse.json(parsed);
    } catch (error) {
        console.error('Invalid Service Account JSON in env:', error);
        return NextResponse.json({ error: 'Invalid Service Account configuration' }, { status: 500 });
    }
}
