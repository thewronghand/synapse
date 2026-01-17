import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
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

const NOTES_DIR = getNotesDir();

/**
 * Find a document file by title (case-insensitive, NFC normalized)
 */
async function findFileByTitle(requestedTitle: string): Promise<{ filename: string; title: string } | null> {
  const files = await fs.readdir(NOTES_DIR);
  const markdownFiles = files.filter((file) => file.endsWith('.md'));

  for (const file of markdownFiles) {
    const filePath = path.join(NOTES_DIR, file);
    const content = await fs.readFile(filePath, 'utf-8');
    const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);
    const filenameTitle = getTitleFromFilename(file);
    const title = extractTitle(contentWithoutFrontmatter, frontmatter) || filenameTitle;

    if (titlesMatch(title, requestedTitle)) {
      return { filename: file, title };
    }
  }

  return null;
}

/**
 * GET /api/documents/[slug]
 * Get a single document by title (slug is now title)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    // Decode URL-encoded title
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
 * Body: { content: string, newTitle?: string }
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
        {
          success: false,
          error: 'Missing content',
        },
        { status: 400 }
      );
    }

    // Find the existing file
    const found = await findFileByTitle(requestedTitle);
    if (!found) {
      return NextResponse.json(
        {
          success: false,
          error: 'Document not found',
        },
        { status: 404 }
      );
    }

    const { filename: oldFilename, title: oldTitle } = found;
    const oldFilePath = path.join(NOTES_DIR, oldFilename);

    // Parse the new content to get the new title
    const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);
    const extractedNewTitle = newTitle || extractTitle(contentWithoutFrontmatter, frontmatter) || oldTitle;

    // Check if title is changing
    const titleChanged = !titlesMatch(oldTitle, extractedNewTitle);

    if (titleChanged) {
      // Check for duplicate title
      if (documentCache.hasTitle(extractedNewTitle)) {
        const existingDoc = documentCache.getByTitle(extractedNewTitle);
        // Make sure it's not the same document
        if (existingDoc && existingDoc.filename !== oldFilename) {
          return NextResponse.json(
            {
              success: false,
              error: '동일한 제목의 문서가 이미 존재합니다',
            },
            { status: 409 }
          );
        }
      }

      // Create new filename
      const newSafeFilename = sanitizeFilename(extractedNewTitle);
      const newFilename = `${newSafeFilename}.md`;
      const newFilePath = path.join(NOTES_DIR, newFilename);

      // Check if new filename already exists (different title but same sanitized name)
      if (newFilename !== oldFilename) {
        try {
          await fs.access(newFilePath);
          return NextResponse.json(
            {
              success: false,
              error: '동일한 파일명의 문서가 이미 존재합니다',
            },
            { status: 409 }
          );
        } catch {
          // File doesn't exist, continue
        }
      }

      // Update all documents that reference this document
      await updateReferencingDocuments(oldTitle, extractedNewTitle);

      // Rename the file
      if (newFilename !== oldFilename) {
        await fs.rename(oldFilePath, newFilePath);
      }

      // Write updated content
      await fs.writeFile(newFilePath, content, 'utf-8');

      // Update caches
      documentCache.updateDocument(oldTitle, extractedNewTitle, newFilename);
      graphCache.renameDocument(oldTitle, extractedNewTitle, newFilename, content);

      console.log(`[Document] Renamed: ${oldTitle} -> ${extractedNewTitle}`);
    } else {
      // Title didn't change, just update content
      await fs.writeFile(oldFilePath, content, 'utf-8');

      // Update caches
      documentCache.updateDocument(oldTitle, oldTitle, oldFilename);
      await graphCache.updateDocument(oldTitle, oldFilename, content);

      console.log(`[Document] Updated: ${oldTitle}`);
    }

    // Update tag cache
    if (frontmatter.tags && Array.isArray(frontmatter.tags)) {
      tagCache.addTags(frontmatter.tags);
    }

    // Get updated document
    const document = await getDocumentByTitle(extractedNewTitle);

    return NextResponse.json({
      success: true,
      data: { document },
    });
  } catch (error) {
    console.error('Error updating document:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update document',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/documents/[slug]
 * Delete a document
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const requestedTitle = decodeURIComponent(slug).normalize('NFC');

    // Find the file
    const found = await findFileByTitle(requestedTitle);
    if (!found) {
      return NextResponse.json(
        {
          success: false,
          error: 'Document not found',
        },
        { status: 404 }
      );
    }

    const { filename, title } = found;
    const filePath = path.join(NOTES_DIR, filename);

    // Delete file
    await fs.unlink(filePath);

    // Remove document from caches
    documentCache.removeDocument(title);
    graphCache.removeDocument(title);

    console.log(`[Document] Deleted: ${title}`);

    // Refresh tag cache since we don't know which tags are no longer used
    await tagCache.refreshTags();

    return NextResponse.json({
      success: true,
      data: { message: 'Document deleted' },
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete document',
      },
      { status: 500 }
    );
  }
}

/**
 * Helper: Get single document by title
 */
async function getDocumentByTitle(requestedTitle: string): Promise<Document> {
  // In published mode, read from JSON file
  if (isPublishedMode()) {
    const jsonPath = path.join(process.cwd(), 'public', 'data', 'docs', `${encodeURIComponent(requestedTitle)}.json`);
    const jsonData = await fs.readFile(jsonPath, 'utf-8');
    return JSON.parse(jsonData);
  }

  // Find the file
  const found = await findFileByTitle(requestedTitle);
  if (!found) {
    throw new Error(`Document not found: ${requestedTitle}`);
  }

  const { filename, title } = found;
  const filePath = path.join(NOTES_DIR, filename);
  const content = await fs.readFile(filePath, 'utf-8');
  const stats = await fs.stat(filePath);

  const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);
  const links = extractWikiLinks(content);

  // Calculate backlinks
  const backlinks = await calculateBacklinksForDocument(title);

  return {
    slug: title, // Use title as slug for backward compatibility
    title,
    filePath: `notes/${filename}`,
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
 * Helper: Calculate backlinks for a specific document (by title)
 */
async function calculateBacklinksForDocument(targetTitle: string): Promise<string[]> {
  const backlinks: string[] = [];
  const normalizedTarget = targetTitle.normalize('NFC').toLowerCase();

  const files = await fs.readdir(NOTES_DIR);
  const markdownFiles = files.filter((file) => file.endsWith('.md'));

  for (const file of markdownFiles) {
    const filePath = path.join(NOTES_DIR, file);
    const content = await fs.readFile(filePath, 'utf-8');
    const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);
    const filenameTitle = getTitleFromFilename(file);
    const docTitle = extractTitle(contentWithoutFrontmatter, frontmatter) || filenameTitle;

    // Skip self
    if (titlesMatch(docTitle, targetTitle)) continue;

    // Get wiki links from this document
    const links = extractWikiLinks(content);

    // Check if any link matches the target title
    if (links.some(link => link.normalize('NFC').toLowerCase() === normalizedTarget)) {
      backlinks.push(docTitle);
    }
  }

  return backlinks;
}

/**
 * Helper: Update wiki links in all documents that reference the old title
 */
async function updateReferencingDocuments(oldTitle: string, newTitle: string): Promise<void> {
  const files = await fs.readdir(NOTES_DIR);
  const markdownFiles = files.filter((file) => file.endsWith('.md'));

  for (const file of markdownFiles) {
    const filePath = path.join(NOTES_DIR, file);
    const content = await fs.readFile(filePath, 'utf-8');
    const links = extractWikiLinks(content);

    // Check if this document references the old title
    const hasReference = links.some(link => titlesMatch(link, oldTitle));

    if (hasReference) {
      // Update wiki links in content
      const updatedContent = updateWikiLinksInContent(content, oldTitle, newTitle);

      if (updatedContent !== content) {
        await fs.writeFile(filePath, updatedContent, 'utf-8');
        console.log(`[Document] Updated references in: ${file}`);
      }
    }
  }
}
