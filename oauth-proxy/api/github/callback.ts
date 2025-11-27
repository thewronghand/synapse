import type { VercelRequest, VercelResponse } from '@vercel/node';

interface StatePayload {
  csrf: string;
  callback: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, state } = req.query;

  // Default error redirect
  const defaultCallback = 'http://localhost:3000/oauth/callback';

  if (!code || !state) {
    return res.redirect(`${defaultCallback}?error=missing_params&provider=github`);
  }

  // Decode state to get CSRF token and callback URL
  let statePayload: StatePayload;
  try {
    statePayload = JSON.parse(Buffer.from(state as string, 'base64url').toString());
  } catch {
    return res.redirect(`${defaultCallback}?error=invalid_state&provider=github`);
  }

  // Verify CSRF token from cookie
  const cookies = req.headers.cookie || '';
  const storedState = cookies.match(/github_oauth_state=([^;]+)/)?.[1];

  if (!storedState || storedState !== statePayload.csrf) {
    return res.redirect(`${statePayload.callback || defaultCallback}?error=csrf_mismatch&provider=github`);
  }

  // Exchange code for access token
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const redirectUri = process.env.GITHUB_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return res.redirect(`${statePayload.callback}?error=config_error&provider=github`);
  }

  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
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
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error || !tokenData.access_token) {
      console.error('GitHub token exchange error:', tokenData);
      return res.redirect(`${statePayload.callback}?error=token_exchange_failed&provider=github`);
    }

    // Get user info
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    const userData = await userResponse.json();

    // Clear CSRF cookie
    res.setHeader(
      'Set-Cookie',
      `github_oauth_state=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/`
    );

    // Encode token data for redirect
    const tokenPayload = encodeURIComponent(
      JSON.stringify({
        accessToken: tokenData.access_token,
        username: userData.login,
        userId: userData.id?.toString(),
      })
    );

    // Redirect back to app with token data
    res.redirect(`${statePayload.callback}?data=${tokenPayload}&provider=github`);
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    return res.redirect(`${statePayload.callback}?error=oauth_failed&provider=github`);
  }
}
