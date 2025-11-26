import { NextRequest, NextResponse } from 'next/server';
import { saveVercelToken } from '@/lib/vercel-token';

/**
 * GET /api/auth/vercel/callback
 * Handle Vercel OAuth callback
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const configurationId = searchParams.get('configurationId');
    const teamId = searchParams.get('teamId');
    const state = searchParams.get('state');

    // Verify state parameter for CSRF protection
    const storedState = request.cookies.get('vercel_oauth_state')?.value;

    if (!code) {
      return NextResponse.redirect(
        new URL('/settings?error=oauth_failed', request.url)
      );
    }

    const clientId = process.env.VERCEL_CLIENT_ID;
    const clientSecret = process.env.VERCEL_CLIENT_SECRET;
    const redirectUri = process.env.VERCEL_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.redirect(
        new URL('/settings?error=config_missing', request.url)
      );
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://api.vercel.com/v2/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', await tokenResponse.text());
      return NextResponse.redirect(
        new URL('/settings?error=token_exchange_failed', request.url)
      );
    }

    const tokenData = await tokenResponse.json();
    const { access_token, team_id, user_id, installation_id } = tokenData;

    if (!access_token) {
      return NextResponse.redirect(
        new URL('/settings?error=no_access_token', request.url)
      );
    }

    // Store token and metadata
    await saveVercelToken({
      accessToken: access_token,
      teamId: team_id || teamId,
      userId: user_id,
      installationId: installation_id || configurationId,
      createdAt: new Date().toISOString(),
    });

    // Clear state cookie
    const response = NextResponse.redirect(
      new URL('/settings?success=vercel_connected', request.url)
    );
    response.cookies.delete('vercel_oauth_state');

    return response;
  } catch (error) {
    console.error('Error in Vercel OAuth callback:', error);
    return NextResponse.redirect(
      new URL('/settings?error=callback_error', request.url)
    );
  }
}
