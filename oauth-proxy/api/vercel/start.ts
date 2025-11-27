import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const clientId = process.env.VERCEL_CLIENT_ID;
  const redirectUri = process.env.VERCEL_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return res.status(500).json({ error: 'Vercel OAuth not configured' });
  }

  // Get callback URL from query params (where to redirect after OAuth)
  const callbackUrl = (req.query.callback_url as string) || 'http://localhost:3000/oauth/callback';

  // Generate CSRF state token
  const csrfToken = crypto.randomBytes(32).toString('hex');

  // Encode callback URL and CSRF token in state
  const statePayload = JSON.stringify({ csrf: csrfToken, callback: callbackUrl });
  const encodedState = Buffer.from(statePayload).toString('base64url');

  // Vercel uses integration installation flow
  // The integration page will redirect to our callback with code and configurationId
  const authUrl = new URL('https://vercel.com/integrations/synapse-notes/new');
  authUrl.searchParams.set('state', encodedState);

  // Set CSRF cookie for verification in callback
  res.setHeader(
    'Set-Cookie',
    `vercel_oauth_state=${csrfToken}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/`
  );

  res.redirect(authUrl.toString());
}
