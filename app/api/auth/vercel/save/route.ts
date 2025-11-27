import { NextRequest, NextResponse } from 'next/server';
import { saveVercelToken } from '@/lib/vercel-token';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accessToken, teamId, userId, installationId } = body;

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'Missing access token' },
        { status: 400 }
      );
    }

    await saveVercelToken({
      accessToken,
      teamId: teamId || undefined,
      userId: userId || undefined,
      installationId: installationId || undefined,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving Vercel token:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save token' },
      { status: 500 }
    );
  }
}
