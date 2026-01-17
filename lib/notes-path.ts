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
 * Get the images directory path for a specific folder
 * @param folder - The folder name (e.g., 'default', 'my-notes')
 */
export function getFolderImagesDir(folder: string): string {
  return path.join(getNotesDir(), folder, 'images');
}

/**
 * Get the temp images directory path for a specific folder
 * @param folder - The folder name (e.g., 'default', 'my-notes')
 */
export function getFolderTempImagesDir(folder: string): string {
  return path.join(getNotesDir(), folder, 'images', 'temp');
}

/**
 * @deprecated Use getFolderImagesDir instead
 * Get the images directory path (legacy - central images folder)
 */
export function getImagesDir(): string {
  return path.join(getNotesDir(), 'images');
}

/**
 * @deprecated Use getFolderTempImagesDir instead
 * Get the temp images directory path (legacy - central temp folder)
 */
export function getTempImagesDir(): string {
  return path.join(getNotesDir(), 'images', 'temp');
}
