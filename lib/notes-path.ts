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
 * Get the Synapse root directory (parent of notes)
 * - Electron: ~/Documents/Synapse
 * - Development: NOTES_DIR의 부모 또는 프로젝트 루트
 */
export function getSynapseRootDir(): string {
  return path.dirname(getNotesDir());
}

/**
 * Get the config directory path for a specific config type
 * @param subdir - 하위 디렉토리 이름 (e.g., 'vertex-service-account', 'gcs-bucket', 'phrase-sets')
 */
export function getConfigDir(subdir: string): string {
  return path.join(getSynapseRootDir(), 'config', subdir);
}

/**
 * Get a config file path
 * @param subdir - config 하위 디렉토리 (e.g., 'vertex-service-account')
 * @param filename - 파일명 (e.g., 'service-account.json')
 */
export function getConfigFilePath(subdir: string, filename: string): string {
  return path.join(getConfigDir(subdir), filename);
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
 * Get the audio directory path for a specific folder
 * @param folder - The folder name (e.g., 'default', 'my-notes')
 */
export function getFolderAudioDir(folder: string): string {
  return path.join(getNotesDir(), folder, 'audio');
}

/**
 * Get the temp audio directory path for a specific folder
 * @param folder - The folder name (e.g., 'default', 'my-notes')
 */
export function getFolderTempAudioDir(folder: string): string {
  return path.join(getNotesDir(), folder, 'audio', 'temp');
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
