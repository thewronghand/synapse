import type { VercelRequest, VercelResponse } from '@vercel/node';

interface StatePayload {
  csrf: string;
  callback: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, configurationId, teamId, state } = req.query;

  // Default error redirect
  const defaultCallback = 'http://localhost:3000/oauth/callback';

  if (!code) {
    return res.redirect(`${defaultCallback}?error=missing_code&provider=vercel`);
  }

  // Decode state to get CSRF token and callback URL
  let statePayload: StatePayload | null = null;
  let callbackUrl = defaultCallback;

  if (state) {
    try {
      statePayload = JSON.parse(Buffer.from(state as string, 'base64url').toString());
      if (statePayload) {
        callbackUrl = statePayload.callback || defaultCallback;

        // Verify CSRF token from cookie
        const cookies = req.headers.cookie || '';
        const storedState = cookies.match(/vercel_oauth_state=([^;]+)/)?.[1];

        if (!storedState || storedState !== statePayload.csrf) {
          return res.redirect(`${callbackUrl}?error=csrf_mismatch&provider=vercel`);
        }
      }
    } catch {
      // State parsing failed, continue without CSRF check for backward compatibility
      console.warn('Failed to parse state, continuing without CSRF check');
    }
  }

  // Exchange code for access token
  const clientId = process.env.VERCEL_CLIENT_ID;
  const clientSecret = process.env.VERCEL_CLIENT_SECRET;
  const redirectUri = process.env.VERCEL_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return res.redirect(`${callbackUrl}?error=config_error&provider=vercel`);
  }

  try {
    const tokenResponse = await fetch('https://api.vercel.com/v2/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code as string,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Vercel token exchange error:', errorText);
      return res.redirect(`${callbackUrl}?error=token_exchange_failed&provider=vercel`);
    }

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      console.error('No access token in response:', tokenData);
      return res.redirect(`${callbackUrl}?error=no_access_token&provider=vercel`);
    }

    // Clear CSRF cookie
    res.setHeader(
      'Set-Cookie',
      `vercel_oauth_state=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/`
    );

    // Encode token data for redirect
    const tokenPayload = encodeURIComponent(
      JSON.stringify({
        accessToken: tokenData.access_token,
        teamId: tokenData.team_id || teamId || null,
        userId: tokenData.user_id || null,
        installationId: tokenData.installation_id || configurationId || null,
      })
    );

    // Redirect back to app with token data
    res.redirect(`${callbackUrl}?data=${tokenPayload}&provider=vercel`);
  } catch (error) {
    console.error('Vercel OAuth error:', error);
    return res.redirect(`${callbackUrl}?error=oauth_failed&provider=vercel`);
  }
}
