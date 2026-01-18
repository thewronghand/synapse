import fs from 'fs/promises';
import { getDataFilePath, ensureUserDataDir } from './data-path';

export interface GitHubTokenInfo {
  accessToken: string;
  username?: string;
  userId?: string;
  createdAt: string;
}

const TOKEN_FILENAME = '.github-token.json';

function getTokenFilePath(): string {
  return getDataFilePath(TOKEN_FILENAME);
}

export async function saveGitHubToken(tokenInfo: GitHubTokenInfo): Promise<void> {
  await ensureUserDataDir();
  await fs.writeFile(getTokenFilePath(), JSON.stringify(tokenInfo, null, 2));
}

export async function loadGitHubToken(): Promise<GitHubTokenInfo | null> {
  try {
    const data = await fs.readFile(getTokenFilePath(), 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

export async function hasGitHubToken(): Promise<boolean> {
  const token = await loadGitHubToken();
  return token !== null && !!token.accessToken;
}

export async function deleteGitHubToken(): Promise<void> {
  try {
    await fs.unlink(getTokenFilePath());
  } catch (error) {
    // File doesn't exist, ignore
  }
}
