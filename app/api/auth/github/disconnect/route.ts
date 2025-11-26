import { NextResponse } from 'next/server';
import { deleteGitHubToken } from '@/lib/github-token';

/**
 * POST /api/auth/github/disconnect
 * Disconnect GitHub account by deleting the stored token
 */
export async function POST() {
  try {
    await deleteGitHubToken();

    return NextResponse.json({
      success: true,
      message: 'GitHub connection removed successfully',
    });
  } catch (error) {
    console.error('Error disconnecting GitHub:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to disconnect GitHub',
      },
      { status: 500 }
    );
  }
}
