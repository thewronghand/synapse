import { NextResponse } from 'next/server';
import { deleteVercelToken } from '@/lib/vercel-token';

/**
 * POST /api/auth/vercel/disconnect
 * Disconnect Vercel account by deleting the stored token
 */
export async function POST() {
  try {
    await deleteVercelToken();

    return NextResponse.json({
      success: true,
      message: 'Vercel connection removed successfully',
    });
  } catch (error) {
    console.error('Error disconnecting Vercel:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to disconnect Vercel',
      },
      { status: 500 }
    );
  }
}
