import fs from 'fs/promises';
import path from 'path';
import { getImagesDir, getTempImagesDir } from './notes-path';

const IMAGES_DIR = getImagesDir();
const TEMP_DIR = getTempImagesDir();

/**
 * Move images from temp to permanent storage
 * Extracts image paths from markdown content and moves them
 */
export async function moveImagesFromTemp(content: string): Promise<string> {
  // Extract all image paths from markdown: ![alt](/api/images/temp/filename.png)
  const imageRegex = /!\[([^\]]*)\]\(\/api\/images\/temp\/([^)]+)\)/g;
  const matches = Array.from(content.matchAll(imageRegex));

  if (matches.length === 0) {
    return content; // No temp images found
  }

  let updatedContent = content;

  for (const match of matches) {
    const filename = match[2];
    const tempPath = path.join(TEMP_DIR, filename);
    const permanentPath = path.join(IMAGES_DIR, filename);

    try {
      // Check if temp file exists
      await fs.access(tempPath);

      // Move file from temp to permanent location
      await fs.rename(tempPath, permanentPath);

      // Update content to remove /temp/ from path
      const oldPath = `/api/images/temp/${filename}`;
      const newPath = `/api/images/${filename}`;
      updatedContent = updatedContent.replace(oldPath, newPath);

      console.log(`[ImageUtils] Moved temp image to permanent: ${filename}`);
    } catch (error) {
      console.error(`[ImageUtils] Failed to move temp image ${filename}:`, error);
      // Continue with other images even if one fails
    }
  }

  return updatedContent;
}

/**
 * Delete temp images referenced in content
 */
export async function deleteTempImages(content: string): Promise<void> {
  const imageRegex = /!\[([^\]]*)\]\(\/api\/images\/temp\/([^)]+)\)/g;
  const matches = Array.from(content.matchAll(imageRegex));

  for (const match of matches) {
    const filename = match[2];
    const tempPath = path.join(TEMP_DIR, filename);

    try {
      await fs.unlink(tempPath);
      console.log(`[ImageUtils] Deleted temp image: ${filename}`);
    } catch (error) {
      // Ignore errors (file might not exist)
    }
  }
}

/**
 * Delete a specific temp image file
 */
export async function deleteTempImage(filename: string): Promise<void> {
  const tempPath = path.join(TEMP_DIR, filename);

  try {
    await fs.unlink(tempPath);
    console.log(`[ImageUtils] Deleted temp image: ${filename}`);
  } catch (error) {
    // Ignore errors (file might not exist)
  }
}
