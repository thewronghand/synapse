import { NextRequest, NextResponse } from 'next/server';
import { saveGitHubToken } from '@/lib/github-token';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accessToken, username, userId } = body;

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'Missing access token' },
        { status: 400 }
      );
    }

    await saveGitHubToken({
      accessToken,
      username: username || undefined,
      userId: userId || undefined,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving GitHub token:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save token' },
      { status: 500 }
    );
  }
}
