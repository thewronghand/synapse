import fs from 'fs/promises';
import path from 'path';
import { getFolderImagesDir, getFolderTempImagesDir } from './notes-path';

/**
 * Ensure folder images directories exist
 */
async function ensureFolderImagesDirs(folder: string): Promise<void> {
  const imagesDir = getFolderImagesDir(folder);
  const tempDir = getFolderTempImagesDir(folder);

  await fs.mkdir(imagesDir, { recursive: true });
  await fs.mkdir(tempDir, { recursive: true });
}

/**
 * Move images from temp to permanent storage within a folder
 * Extracts image paths from markdown content and moves them
 * @param content - Markdown content
 * @param folder - The folder name where the document belongs
 */
export async function moveImagesFromTemp(content: string, folder: string): Promise<string> {
  // Extract all image paths from markdown: ![alt](/api/images/folder/temp/filename.png)
  const imageRegex = new RegExp(`!\\[([^\\]]*)\\]\\(/api/images/${folder}/temp/([^)]+)\\)`, 'g');
  const matches = Array.from(content.matchAll(imageRegex));

  if (matches.length === 0) {
    return content; // No temp images found
  }

  await ensureFolderImagesDirs(folder);

  const imagesDir = getFolderImagesDir(folder);
  const tempDir = getFolderTempImagesDir(folder);

  let updatedContent = content;

  for (const match of matches) {
    const filename = match[2];
    const tempPath = path.join(tempDir, filename);
    const permanentPath = path.join(imagesDir, filename);

    try {
      // Check if temp file exists
      await fs.access(tempPath);

      // Move file from temp to permanent location
      await fs.rename(tempPath, permanentPath);

      // Update content to remove /temp/ from path
      const oldPath = `/api/images/${folder}/temp/${filename}`;
      const newPath = `/api/images/${folder}/${filename}`;
      updatedContent = updatedContent.replace(oldPath, newPath);

      console.log(`[ImageUtils] Moved temp image to permanent: ${folder}/${filename}`);
    } catch (error) {
      console.error(`[ImageUtils] Failed to move temp image ${folder}/${filename}:`, error);
      // Continue with other images even if one fails
    }
  }

  return updatedContent;
}

/**
 * Delete temp images referenced in content
 * @param content - Markdown content
 * @param folder - The folder name where the document belongs
 */
export async function deleteTempImages(content: string, folder: string): Promise<void> {
  const imageRegex = new RegExp(`!\\[([^\\]]*)\\]\\(/api/images/${folder}/temp/([^)]+)\\)`, 'g');
  const matches = Array.from(content.matchAll(imageRegex));

  const tempDir = getFolderTempImagesDir(folder);

  for (const match of matches) {
    const filename = match[2];
    const tempPath = path.join(tempDir, filename);

    try {
      await fs.unlink(tempPath);
      console.log(`[ImageUtils] Deleted temp image: ${folder}/${filename}`);
    } catch (error) {
      // Ignore errors (file might not exist)
    }
  }
}

/**
 * Delete a specific temp image file
 * @param filename - The image filename
 * @param folder - The folder name where the image belongs
 */
export async function deleteTempImage(filename: string, folder: string): Promise<void> {
  const tempDir = getFolderTempImagesDir(folder);
  const tempPath = path.join(tempDir, filename);

  try {
    await fs.unlink(tempPath);
    console.log(`[ImageUtils] Deleted temp image: ${folder}/${filename}`);
  } catch (error) {
    // Ignore errors (file might not exist)
  }
}
