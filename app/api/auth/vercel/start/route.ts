import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * GET /api/auth/vercel/start
 * Start Vercel OAuth authentication flow
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.VERCEL_CLIENT_ID;
    const redirectUri = process.env.VERCEL_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return NextResponse.json(
        {
          success: false,
          error: 'Vercel OAuth credentials not configured',
        },
        { status: 500 }
      );
    }

    // Generate random state for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');

    // Build OAuth authorization URL
    const authUrl = new URL('https://vercel.com/integrations/synapse-notes/new');

    // For development, you can also use the direct OAuth endpoint:
    // const authUrl = new URL('https://vercel.com/oauth/authorize');
    // authUrl.searchParams.set('client_id', clientId);
    // authUrl.searchParams.set('redirect_uri', redirectUri);
    // authUrl.searchParams.set('state', state);

    // Store state in cookie for verification in callback
    const response = NextResponse.redirect(authUrl.toString());

    response.cookies.set('vercel_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
    });

    return response;
  } catch (error) {
    console.error('Error starting Vercel OAuth:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to start OAuth flow',
      },
      { status: 500 }
    );
  }
}
