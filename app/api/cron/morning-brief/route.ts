import { NextRequest, NextResponse } from 'next/server';

/**
 * Morning Brief Cron Job
 * Runs at 8 AM CT (14:00 UTC) Monday-Saturday
 * Sends daily summary to Logan via Telegram
 */

export async function GET(request: NextRequest) {
    // Verify cron secret if configured (Vercel cron protection)
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Call the existing morning brief POST endpoint which sends Telegram
        // Use production URL directly since VERCEL_URL returns preview URL
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL
            || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

        const response = await fetch(`${baseUrl}/api/morning-brief`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json({
                error: 'Failed to send morning brief',
                details: data
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'Morning brief sent to Telegram',
            data
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Morning brief cron failed';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
