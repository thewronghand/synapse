import fs from 'fs/promises';
import path from 'path';

export interface VercelTokenInfo {
  accessToken: string;
  teamId?: string;
  userId?: string;
  installationId?: string;
  createdAt: string;
}

const TOKEN_FILE_PATH = path.join(process.cwd(), '.vercel-token.json');

/**
 * Save Vercel OAuth token to local storage
 */
export async function saveVercelToken(tokenInfo: VercelTokenInfo): Promise<void> {
  await fs.writeFile(TOKEN_FILE_PATH, JSON.stringify(tokenInfo, null, 2));
}

/**
 * Load Vercel OAuth token from local storage
 */
export async function loadVercelToken(): Promise<VercelTokenInfo | null> {
  try {
    const data = await fs.readFile(TOKEN_FILE_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist or is invalid
    return null;
  }
}

/**
 * Check if Vercel token exists and is valid
 */
export async function hasVercelToken(): Promise<boolean> {
  const token = await loadVercelToken();
  return token !== null && !!token.accessToken;
}

/**
 * Delete Vercel OAuth token
 */
export async function deleteVercelToken(): Promise<void> {
  try {
    await fs.unlink(TOKEN_FILE_PATH);
  } catch (error) {
    // File doesn't exist, ignore
  }
}
