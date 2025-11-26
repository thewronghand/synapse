import { NextRequest, NextResponse } from 'next/server';
import { saveGitHubToken } from '@/lib/github-token';

/**
 * GET /api/auth/github/callback
 * Handle GitHub OAuth callback
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    // Verify state parameter
    const storedState = request.cookies.get('github_oauth_state')?.value;

    if (!code) {
      return NextResponse.redirect(
        new URL('/settings?error=oauth_failed', request.url)
      );
    }

    // Exchange code for access token
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    const redirectUri = process.env.GITHUB_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.redirect(
        new URL('/settings?error=config_error', request.url)
      );
    }

    const tokenResponse = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
        }),
      }
    );

    const tokenData = await tokenResponse.json();

    if (tokenData.error || !tokenData.access_token) {
      console.error('GitHub OAuth error:', tokenData);
      return NextResponse.redirect(
        new URL('/settings?error=token_exchange_failed', request.url)
      );
    }

    // Get user info
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/vnd.github+json',
      },
    });

    const userData = await userResponse.json();

    // Store token and metadata
    await saveGitHubToken({
      accessToken: tokenData.access_token,
      username: userData.login,
      userId: userData.id?.toString(),
      createdAt: new Date().toISOString(),
    });

    // Clear state cookie
    const response = NextResponse.redirect(
      new URL('/settings?success=github_connected', request.url)
    );
    response.cookies.delete('github_oauth_state');

    return response;
  } catch (error) {
    console.error('Error in GitHub OAuth callback:', error);
    return NextResponse.redirect(
      new URL('/settings?error=callback_error', request.url)
    );
  }
}
