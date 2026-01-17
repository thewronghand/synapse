import { NextRequest, NextResponse } from 'next/server';
import { saveVercelToken } from '@/lib/vercel-token';

/**
 * Validate a Vercel token and get user info
 */
async function validateToken(accessToken: string): Promise<{ valid: boolean; userId?: string; error?: string }> {
  try {
    const response = await fetch('https://api.vercel.com/v2/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return { valid: false, error: 'Invalid or expired token' };
      }
      return { valid: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    return { valid: true, userId: data.user?.id || data.user?.uid };
  } catch (error) {
    console.error('Token validation error:', error);
    return { valid: false, error: 'Failed to validate token' };
  }
}

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

    // For Personal Access Tokens, validate and get userId from API
    let finalUserId = userId;
    if (!finalUserId) {
      const validation = await validateToken(accessToken);
      if (!validation.valid) {
        return NextResponse.json(
          { success: false, error: validation.error || 'Invalid token' },
          { status: 401 }
        );
      }
      finalUserId = validation.userId;
    }

    if (!finalUserId) {
      return NextResponse.json(
        { success: false, error: 'Could not determine user ID from token' },
        { status: 400 }
      );
    }

    await saveVercelToken({
      accessToken,
      teamId: teamId || undefined,
      userId: finalUserId,
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
