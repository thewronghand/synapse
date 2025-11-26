import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * GET /api/auth/github/start
 * Start GitHub OAuth authentication flow
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri = process.env.GITHUB_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return NextResponse.json(
        {
          success: false,
          error: 'GitHub OAuth credentials not configured',
        },
        { status: 500 }
      );
    }

    // Generate random state for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');

    // Build OAuth authorization URL
    const authUrl = new URL('https://github.com/login/oauth/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('scope', 'repo'); // Request repo access

    // Store state in cookie for verification in callback
    const response = NextResponse.redirect(authUrl.toString());

    response.cookies.set('github_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
    });

    return response;
  } catch (error) {
    console.error('Error starting GitHub OAuth:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to start OAuth flow',
      },
      { status: 500 }
    );
  }
}
