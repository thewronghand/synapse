import path from 'path';

/**
 * Get the notes directory path
 * - In Electron: Uses user's Documents/Synapse/notes
 * - In development: Uses project's notes directory
 */
export function getNotesDir(): string {
  // Check if running in Electron (environment variable set by main.js)
  if (process.env.NOTES_DIR) {
    return process.env.NOTES_DIR;
  }

  // Fallback to project notes directory (for development)
  return path.join(process.cwd(), 'notes');
}

/**
 * Get the images directory path
 */
export function getImagesDir(): string {
  return path.join(getNotesDir(), 'images');
}

/**
 * Get the temp images directory path
 */
export function getTempImagesDir(): string {
  return path.join(getNotesDir(), 'images', 'temp');
}
