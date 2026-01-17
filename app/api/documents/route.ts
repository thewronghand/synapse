import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import {
  parseFrontmatter,
  extractTitle,
  extractWikiLinks,
  calculateBacklinks,
  getTitleFromFilename,
  sanitizeFilename,
  titlesMatch,
} from '@/lib/document-parser';
import { Document } from '@/types';
import { tagCache } from '@/lib/tag-cache';
import { documentCache } from '@/lib/document-cache';
import { graphCache } from '@/lib/graph-cache';
import { moveImagesFromTemp } from '@/lib/image-utils';
import { getNotesDir } from '@/lib/notes-path';
import { isPublishedMode } from '@/lib/env';

const NOTES_DIR = getNotesDir();

/**
 * GET /api/documents
 * Get all documents
 */
export async function GET() {
  try {
    const documents = await getAllDocuments();

    return NextResponse.json({
      success: true,
      data: {
        documents,
        total: documents.length,
      },
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch documents',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/documents
 * Create a new document
 * Body: { title: string, content: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Support both 'slug' (legacy) and 'title' (new) parameter names
    const title = body.title || body.slug;
    const content = body.content;

    if (!title || !content) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing title or content',
        },
        { status: 400 }
      );
    }

    // Check for duplicate title
    if (documentCache.hasTitle(title)) {
      return NextResponse.json(
        {
          success: false,
          error: '동일한 제목의 문서가 이미 존재합니다',
        },
        { status: 409 }
      );
    }

    // Create filename from title (sanitize for filesystem)
    const safeFilename = sanitizeFilename(title);
    const filename = `${safeFilename}.md`;
    const filePath = path.join(NOTES_DIR, filename);

    // Check if file already exists (edge case: different title but same sanitized filename)
    try {
      await fs.access(filePath);
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

    // Move temp images to permanent location and update content
    const updatedContent = await moveImagesFromTemp(content);

    // Write file with updated content
    await fs.writeFile(filePath, updatedContent, 'utf-8');

    // Update tag cache with new tags
    const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(updatedContent);
    if (frontmatter.tags && Array.isArray(frontmatter.tags)) {
      tagCache.addTags(frontmatter.tags);
      console.log(`[TagCache] Added tags from new document: ${frontmatter.tags.join(', ')}`);
    }

    // Get extracted title (from frontmatter or content)
    const extractedTitle = extractTitle(contentWithoutFrontmatter, frontmatter);

    // Update document cache
    documentCache.addDocument(extractedTitle, filename);
    console.log(`[DocumentCache] Added document: ${extractedTitle} (${filename})`);

    // Update graph cache
    await graphCache.addDocument(extractedTitle, filename, updatedContent);
    console.log(`[GraphCache] Added document: ${extractedTitle}`);

    // Get the created document
    const document = await getDocumentByTitle(extractedTitle);

    return NextResponse.json({
      success: true,
      data: { document },
    });
  } catch (error) {
    console.error('Error creating document:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create document',
      },
      { status: 500 }
    );
  }
}

/**
 * Helper: Get all documents
 */
async function getAllDocuments(): Promise<Document[]> {
  // In published mode, read from JSON file
  if (isPublishedMode()) {
    const jsonPath = path.join(process.cwd(), 'public', 'data', 'documents.json');
    const jsonData = await fs.readFile(jsonPath, 'utf-8');
    return JSON.parse(jsonData);
  }

  // In normal mode, read from markdown files
  const files = await fs.readdir(NOTES_DIR);
  const markdownFiles = files.filter((file) => file.endsWith('.md'));

  const documentsWithoutBacklinks = await Promise.all(
    markdownFiles.map(async (file) => {
      const filePath = path.join(NOTES_DIR, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const stats = await fs.stat(filePath);

      const filenameTitle = getTitleFromFilename(file);
      const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);
      const title = extractTitle(contentWithoutFrontmatter, frontmatter) || filenameTitle;
      const links = extractWikiLinks(content);

      return {
        slug: title, // Use title as slug for backward compatibility
        title,
        filePath: `notes/${file}`,
        filename: file,
        content,
        contentWithoutFrontmatter,
        frontmatter,
        links,
        backlinks: [], // Will be calculated below
        createdAt: stats.birthtime,
        updatedAt: stats.mtime,
      };
    })
  );

  // Calculate backlinks using title-based system
  const backlinksMap = calculateBacklinks(
    documentsWithoutBacklinks.map(doc => ({ title: doc.title, links: doc.links }))
  );

  // Add backlinks to documents
  const documents = documentsWithoutBacklinks.map((doc) => ({
    ...doc,
    backlinks: backlinksMap.get(doc.title.normalize('NFC').toLowerCase()) || [],
  }));

  return documents;
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

  // In normal mode, find the file by title
  const files = await fs.readdir(NOTES_DIR);
  const markdownFiles = files.filter((file) => file.endsWith('.md'));

  // Find matching file
  let matchingFile: string | undefined;
  for (const file of markdownFiles) {
    const filePath = path.join(NOTES_DIR, file);
    const content = await fs.readFile(filePath, 'utf-8');
    const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);
    const filenameTitle = getTitleFromFilename(file);
    const title = extractTitle(contentWithoutFrontmatter, frontmatter) || filenameTitle;

    if (titlesMatch(title, requestedTitle)) {
      matchingFile = file;
      break;
    }
  }

  if (!matchingFile) {
    throw new Error(`Document not found: ${requestedTitle}`);
  }

  const filePath = path.join(NOTES_DIR, matchingFile);
  const content = await fs.readFile(filePath, 'utf-8');
  const stats = await fs.stat(filePath);

  const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);
  const filenameTitle = getTitleFromFilename(matchingFile);
  const title = extractTitle(contentWithoutFrontmatter, frontmatter) || filenameTitle;
  const links = extractWikiLinks(content);

  // Get all documents to calculate backlinks
  const allDocuments = await getAllDocuments();
  const normalizedTitle = title.normalize('NFC').toLowerCase();
  const backlinks = allDocuments.find(d =>
    d.title.normalize('NFC').toLowerCase() === normalizedTitle
  )?.backlinks || [];

  return {
    slug: title, // Use title as slug for backward compatibility
    title,
    filePath: `notes/${matchingFile}`,
    content,
    contentWithoutFrontmatter,
    frontmatter,
    links,
    backlinks,
    createdAt: stats.birthtime,
    updatedAt: stats.mtime,
  };
}
