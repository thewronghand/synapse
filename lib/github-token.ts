import fs from 'fs/promises';
import path from 'path';

export interface GitHubTokenInfo {
  accessToken: string;
  username?: string;
  userId?: string;
  createdAt: string;
}

const TOKEN_FILE_PATH = path.join(process.cwd(), '.github-token.json');

export async function saveGitHubToken(tokenInfo: GitHubTokenInfo): Promise<void> {
  await fs.writeFile(TOKEN_FILE_PATH, JSON.stringify(tokenInfo, null, 2));
}

export async function loadGitHubToken(): Promise<GitHubTokenInfo | null> {
  try {
    const data = await fs.readFile(TOKEN_FILE_PATH, 'utf-8');
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
    await fs.unlink(TOKEN_FILE_PATH);
  } catch (error) {
    // File doesn't exist, ignore
  }
}
