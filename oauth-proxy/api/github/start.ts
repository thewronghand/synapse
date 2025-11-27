import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = process.env.GITHUB_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return res.status(500).json({ error: 'GitHub OAuth not configured' });
  }

  // Get callback URL from query params (where to redirect after OAuth)
  const callbackUrl = (req.query.callback_url as string) || 'http://localhost:3000/oauth/callback';

  // Generate CSRF state token
  const csrfToken = crypto.randomBytes(32).toString('hex');

  // Encode callback URL and CSRF token in state
  const statePayload = JSON.stringify({ csrf: csrfToken, callback: callbackUrl });
  const encodedState = Buffer.from(statePayload).toString('base64url');

  // Build GitHub OAuth URL
  const authUrl = new URL('https://github.com/login/oauth/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', encodedState);
  authUrl.searchParams.set('scope', 'repo');

  // Set CSRF cookie for verification in callback
  res.setHeader(
    'Set-Cookie',
    `github_oauth_state=${csrfToken}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/`
  );

  res.redirect(authUrl.toString());
}
