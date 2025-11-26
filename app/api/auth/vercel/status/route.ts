import { NextResponse } from 'next/server';
import { hasVercelToken, loadVercelToken } from '@/lib/vercel-token';

/**
 * GET /api/auth/vercel/status
 * Check Vercel connection status
 */
export async function GET() {
  try {
    const isConnected = await hasVercelToken();

    if (!isConnected) {
      return NextResponse.json({
        success: true,
        data: {
          connected: false,
        },
      });
    }

    const tokenInfo = await loadVercelToken();

    return NextResponse.json({
      success: true,
      data: {
        connected: true,
        teamId: tokenInfo?.teamId,
        userId: tokenInfo?.userId,
        connectedAt: tokenInfo?.createdAt,
      },
    });
  } catch (error) {
    console.error('Error checking Vercel status:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check Vercel status',
      },
      { status: 500 }
    );
  }
}
