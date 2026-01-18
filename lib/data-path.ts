import path from 'path';
import fs from 'fs/promises';

/**
 * Get the user data directory path for storing app data (tokens, settings, etc.)
 * - In Electron: Uses app.getPath('userData') via USER_DATA_DIR env variable
 * - In development: Uses project root directory
 */
export function getUserDataDir(): string {
  // Check if running in Electron (environment variable set by main.js)
  if (process.env.USER_DATA_DIR) {
    return process.env.USER_DATA_DIR;
  }

  // Fallback to project directory (for development)
  return process.cwd();
}

/**
 * Get the path for a specific data file in the user data directory
 * @param filename - The filename (e.g., '.github-token.json')
 */
export function getDataFilePath(filename: string): string {
  return path.join(getUserDataDir(), filename);
}

/**
 * Ensure the user data directory exists
 */
export async function ensureUserDataDir(): Promise<void> {
  const dir = getUserDataDir();
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    // Directory already exists or other error (will fail on file write)
  }
}
