import { NextResponse } from 'next/server';
import { hasGitHubToken, loadGitHubToken } from '@/lib/github-token';

/**
 * GET /api/auth/github/status
 * Check GitHub OAuth connection status
 */
export async function GET() {
  try {
    const isConnected = await hasGitHubToken();

    if (!isConnected) {
      return NextResponse.json({
        success: true,
        data: { connected: false },
      });
    }

    const tokenInfo = await loadGitHubToken();

    return NextResponse.json({
      success: true,
      data: {
        connected: true,
        username: tokenInfo?.username,
        userId: tokenInfo?.userId,
        connectedAt: tokenInfo?.createdAt,
      },
    });
  } catch (error) {
    console.error('Error checking GitHub status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check GitHub status' },
      { status: 500 }
    );
  }
}
