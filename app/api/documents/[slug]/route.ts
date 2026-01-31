import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import fss from 'fs';
import path from 'path';
import {
  parseFrontmatter,
  extractTitle,
  extractWikiLinks,
  getTitleFromFilename,
  sanitizeFilename,
  titlesMatch,
  updateWikiLinksInContent,
} from '@/lib/document-parser';
import { Document } from '@/types';
import { tagCache } from '@/lib/tag-cache';
import { documentCache } from '@/lib/document-cache';
import { graphCache } from '@/lib/graph-cache';
import { getNotesDir } from '@/lib/notes-path';
import { isPublishedMode } from '@/lib/env';
import { ensureDefaultFolder } from '@/lib/folder-utils';
import { moveImagesFromTemp } from '@/lib/image-utils';
import { moveAudioFromTemp } from '@/lib/audio-utils';

const NOTES_DIR = getNotesDir();

interface FoundDocument {
  filename: string;
  folder: string;
  title: string;
}

/**
 * Find a document file by title (searches all folders)
 */
async function findFileByTitle(requestedTitle: string): Promise<FoundDocument | null> {
  // First, check cache
  const cached = documentCache.getByTitle(requestedTitle);
  if (cached) {
    const filePath = cached.folder
      ? path.join(NOTES_DIR, cached.folder, cached.filename)
      : path.join(NOTES_DIR, cached.filename);

    if (fss.existsSync(filePath)) {
      return {
        filename: cached.filename,
        folder: cached.folder,
        title: cached.title,
      };
    }
  }

  // Fallback: scan all folders
  await ensureDefaultFolder();
  const entries = await fs.readdir(NOTES_DIR, { withFileTypes: true });
  const folders = entries.filter((e) => e.isDirectory());
  const rootFiles = entries.filter((e) => e.isFile() && e.name.endsWith('.md'));

  // Search in folders
  for (const folder of folders) {
    const folderPath = path.join(NOTES_DIR, folder.name);
    const files = await fs.readdir(folderPath);
    const markdownFiles = files.filter((f) => f.endsWith('.md'));

    for (const file of markdownFiles) {
      const filePath = path.join(folderPath, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);
      const filenameTitle = getTitleFromFilename(file);
      const title = extractTitle(contentWithoutFrontmatter, frontmatter) || filenameTitle;

      if (titlesMatch(title, requestedTitle)) {
        return { filename: file, folder: folder.name, title };
      }
    }
  }

  // Search root files (legacy)
  for (const file of rootFiles) {
    const filePath = path.join(NOTES_DIR, file.name);
    const content = await fs.readFile(filePath, 'utf-8');
    const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);
    const filenameTitle = getTitleFromFilename(file.name);
    const title = extractTitle(contentWithoutFrontmatter, frontmatter) || filenameTitle;

    if (titlesMatch(title, requestedTitle)) {
      return { filename: file.name, folder: '', title };
    }
  }

  return null;
}

/**
 * GET /api/documents/[slug]
 * Get a single document by title
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const requestedTitle = decodeURIComponent(slug).normalize('NFC');
    const document = await getDocumentByTitle(requestedTitle);

    return NextResponse.json({
      success: true,
      data: { document },
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Document not found',
      },
      { status: 404 }
    );
  }
}

/**
 * PUT /api/documents/[slug]
 * Update a document
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const requestedTitle = decodeURIComponent(slug).normalize('NFC');
    const body = await request.json();
    const { content, newTitle } = body;

    if (!content) {
      return NextResponse.json(
        { success: false, error: 'Missing content' },
        { status: 400 }
      );
    }

    // Find the existing file
    const found = await findFileByTitle(requestedTitle);
    if (!found) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    const { filename: oldFilename, folder, title: oldTitle } = found;
    const oldFilePath = folder
      ? path.join(NOTES_DIR, folder, oldFilename)
      : path.join(NOTES_DIR, oldFilename);

    // Move temp images and audio to permanent location
    let processedContent = await moveImagesFromTemp(content, folder || 'default');
    processedContent = await moveAudioFromTemp(processedContent, folder || 'default');

    // Parse the new content
    const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(processedContent);
    const extractedNewTitle =
      newTitle || extractTitle(contentWithoutFrontmatter, frontmatter) || oldTitle;

    const titleChanged = !titlesMatch(oldTitle, extractedNewTitle);

    if (titleChanged) {
      // Check for duplicate title within the same folder (allows same title in different folders)
      if (documentCache.hasTitleInFolder(extractedNewTitle, folder)) {
        const existingDoc = documentCache.getByTitle(extractedNewTitle);
        // Only block if it's a different file (not just renaming case normalization)
        if (existingDoc && (existingDoc.filename !== oldFilename || existingDoc.folder !== folder)) {
          return NextResponse.json(
            { success: false, error: '이 폴더에 동일한 제목의 문서가 이미 존재합니다' },
            { status: 409 }
          );
        }
      }

      // Create new filename
      const newSafeFilename = sanitizeFilename(extractedNewTitle);
      const newFilename = `${newSafeFilename}.md`;
      const newFilePath = folder
        ? path.join(NOTES_DIR, folder, newFilename)
        : path.join(NOTES_DIR, newFilename);

      // Check if new filename already exists
      if (newFilename !== oldFilename) {
        try {
          await fs.access(newFilePath);
          return NextResponse.json(
            { success: false, error: '동일한 파일명의 문서가 이미 존재합니다' },
            { status: 409 }
          );
        } catch {
          // OK
        }
      }

      // Update references only within the same folder (folder isolation)
      await updateReferencingDocuments(oldTitle, extractedNewTitle, folder);

      // Rename file
      if (newFilename !== oldFilename) {
        await fs.rename(oldFilePath, newFilePath);
      }

      // Write content
      await fs.writeFile(newFilePath, processedContent, 'utf-8');

      // Update caches
      documentCache.updateDocument(oldTitle, extractedNewTitle, newFilename, folder);
      graphCache.renameDocument(oldTitle, extractedNewTitle, newFilename, processedContent);

      console.log(`[Document] Renamed: ${oldTitle} -> ${extractedNewTitle}`);
    } else {
      await fs.writeFile(oldFilePath, processedContent, 'utf-8');
      documentCache.updateDocument(oldTitle, oldTitle, oldFilename, folder);
      await graphCache.updateDocument(oldTitle, oldFilename, processedContent);
      console.log(`[Document] Updated: ${oldTitle}`);
    }

    // Update tag cache
    if (frontmatter.tags && Array.isArray(frontmatter.tags)) {
      tagCache.addTags(frontmatter.tags);
    }

    const document = await getDocumentByTitle(extractedNewTitle);

    return NextResponse.json({
      success: true,
      data: { document },
    });
  } catch (error) {
    console.error('Error updating document:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update document' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/documents/[slug]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const requestedTitle = decodeURIComponent(slug).normalize('NFC');

    const found = await findFileByTitle(requestedTitle);
    if (!found) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    const { filename, folder, title } = found;
    const filePath = folder
      ? path.join(NOTES_DIR, folder, filename)
      : path.join(NOTES_DIR, filename);

    await fs.unlink(filePath);
    documentCache.removeDocument(title);
    graphCache.removeDocument(title);

    console.log(`[Document] Deleted: ${title}`);
    await tagCache.refreshTags();

    return NextResponse.json({
      success: true,
      data: { message: 'Document deleted' },
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}

/**
 * Helper: Get document by title
 */
async function getDocumentByTitle(requestedTitle: string): Promise<Document> {
  if (isPublishedMode()) {
    const jsonPath = path.join(
      process.cwd(),
      'public',
      'data',
      'docs',
      `${encodeURIComponent(requestedTitle)}.json`
    );
    const jsonData = await fs.readFile(jsonPath, 'utf-8');
    return JSON.parse(jsonData);
  }

  const found = await findFileByTitle(requestedTitle);
  if (!found) {
    throw new Error(`Document not found: ${requestedTitle}`);
  }

  const { filename, folder, title } = found;
  const filePath = folder
    ? path.join(NOTES_DIR, folder, filename)
    : path.join(NOTES_DIR, filename);

  const content = await fs.readFile(filePath, 'utf-8');
  const stats = await fs.stat(filePath);
  const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);
  const links = extractWikiLinks(content);
  // Calculate backlinks only from the same folder (folder isolation)
  const backlinks = await calculateBacklinksForDocument(title, folder);

  return {
    slug: title,
    title,
    folder: folder || '',
    filePath: folder ? `notes/${folder}/${filename}` : `notes/${filename}`,
    content,
    contentWithoutFrontmatter,
    frontmatter,
    links,
    backlinks,
    createdAt: stats.birthtime,
    updatedAt: stats.mtime,
  };
}

/**
 * Helper: Calculate backlinks for a document (folder-scoped)
 * Only returns backlinks from documents in the same folder
 */
async function calculateBacklinksForDocument(targetTitle: string, targetFolder: string): Promise<string[]> {
  const backlinks: string[] = [];
  const normalizedTarget = targetTitle.normalize('NFC').toLowerCase();

  // Only scan the same folder for backlinks (folder isolation)
  const folderToScan = targetFolder || 'default';
  const folderPath = path.join(NOTES_DIR, folderToScan);

  try {
    const files = await fs.readdir(folderPath);
    const markdownFiles = files.filter((f) => f.endsWith('.md'));

    for (const file of markdownFiles) {
      const filePath = path.join(folderPath, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);
      const filenameTitle = getTitleFromFilename(file);
      const docTitle = extractTitle(contentWithoutFrontmatter, frontmatter) || filenameTitle;

      if (titlesMatch(docTitle, targetTitle)) continue;

      const links = extractWikiLinks(content);
      if (links.some((link) => link.normalize('NFC').toLowerCase() === normalizedTarget)) {
        backlinks.push(docTitle);
      }
    }
  } catch (error) {
    console.error(`[calculateBacklinksForDocument] Error scanning folder ${folderToScan}:`, error);
  }

  return backlinks;
}

/**
 * Helper: Update wiki links in documents that reference the old title (folder-scoped)
 * Only updates references within the same folder (folder isolation)
 */
async function updateReferencingDocuments(oldTitle: string, newTitle: string, targetFolder: string): Promise<void> {
  // Only update references in the same folder (folder isolation)
  const folderToUpdate = targetFolder || 'default';
  const folderPath = path.join(NOTES_DIR, folderToUpdate);

  try {
    const files = await fs.readdir(folderPath);
    const markdownFiles = files.filter((f) => f.endsWith('.md'));

    for (const file of markdownFiles) {
      const filePath = path.join(folderPath, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const links = extractWikiLinks(content);

      if (links.some((link) => titlesMatch(link, oldTitle))) {
        const updatedContent = updateWikiLinksInContent(content, oldTitle, newTitle);
        if (updatedContent !== content) {
          await fs.writeFile(filePath, updatedContent, 'utf-8');
          console.log(`[Document] Updated references in: ${folderToUpdate}/${file}`);
        }
      }
    }
  } catch (error) {
    console.error(`[updateReferencingDocuments] Error updating folder ${folderToUpdate}:`, error);
  }
}
