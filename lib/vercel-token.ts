import fs from 'fs/promises';
import { getDataFilePath, ensureUserDataDir } from './data-path';

export interface VercelTokenInfo {
  accessToken: string;
  teamId?: string;
  userId?: string;
  installationId?: string;
  createdAt: string;
}

const TOKEN_FILENAME = '.vercel-token.json';

function getTokenFilePath(): string {
  return getDataFilePath(TOKEN_FILENAME);
}

/**
 * Save Vercel OAuth token to local storage
 */
export async function saveVercelToken(tokenInfo: VercelTokenInfo): Promise<void> {
  await ensureUserDataDir();
  await fs.writeFile(getTokenFilePath(), JSON.stringify(tokenInfo, null, 2));
}

/**
 * Load Vercel OAuth token from local storage
 */
export async function loadVercelToken(): Promise<VercelTokenInfo | null> {
  try {
    const data = await fs.readFile(getTokenFilePath(), 'utf-8');
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
    await fs.unlink(getTokenFilePath());
  } catch (error) {
    // File doesn't exist, ignore
  }
}
