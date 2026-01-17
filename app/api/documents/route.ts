import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import fss from 'fs';
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
import { ensureDefaultFolder, DEFAULT_FOLDER_NAME } from '@/lib/folder-utils';

const NOTES_DIR = getNotesDir();

/**
 * GET /api/documents
 * Get all documents (supports folder filtering)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const folder = searchParams.get('folder'); // Optional folder filter

    const documents = await getAllDocuments(folder || undefined);

    return NextResponse.json({
      success: true,
      data: {
        documents,
        total: documents.length,
        folder: folder || 'all',
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
 * Body: { title: string, content: string, folder?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const title = body.title || body.slug;
    const content = body.content;
    const folder = body.folder || DEFAULT_FOLDER_NAME;

    if (!title || !content) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing title or content',
        },
        { status: 400 }
      );
    }

    // Check for duplicate title only within the same folder (allows same title in different folders)
    if (documentCache.hasTitleInFolder(title, folder)) {
      return NextResponse.json(
        {
          success: false,
          error: '이 폴더에 동일한 제목의 문서가 이미 존재합니다',
        },
        { status: 409 }
      );
    }

    // Ensure folder exists
    await ensureDefaultFolder();
    const folderPath = path.join(NOTES_DIR, folder);
    if (!fss.existsSync(folderPath)) {
      await fs.mkdir(folderPath, { recursive: true });
    }

    // Create filename from title
    const safeFilename = sanitizeFilename(title);
    const filename = `${safeFilename}.md`;
    const filePath = path.join(folderPath, filename);

    // Check if file already exists
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

    // Move temp images and write file
    const updatedContent = await moveImagesFromTemp(content, folder);
    await fs.writeFile(filePath, updatedContent, 'utf-8');

    // Update tag cache
    const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(updatedContent);
    if (frontmatter.tags && Array.isArray(frontmatter.tags)) {
      tagCache.addTags(frontmatter.tags);
    }

    // Get extracted title
    const extractedTitle = extractTitle(contentWithoutFrontmatter, frontmatter) || title;

    // Update document cache with folder
    documentCache.addDocument(extractedTitle, filename, folder);
    console.log(`[DocumentCache] Added document: ${extractedTitle} in ${folder}/`);

    // Update graph cache
    await graphCache.addDocument(extractedTitle, filename, updatedContent);

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
 * Helper: Get all documents (with optional folder filter)
 */
async function getAllDocuments(folderFilter?: string): Promise<Document[]> {
  // In published mode, read from JSON file
  if (isPublishedMode()) {
    const jsonPath = path.join(process.cwd(), 'public', 'data', 'documents.json');
    const jsonData = await fs.readFile(jsonPath, 'utf-8');
    const docs = JSON.parse(jsonData);
    if (folderFilter) {
      return docs.filter((d: Document) => d.folder === folderFilter);
    }
    return docs;
  }

  // Ensure default folder exists
  await ensureDefaultFolder();

  const entries = await fs.readdir(NOTES_DIR, { withFileTypes: true });
  const folders = entries.filter((e) => e.isDirectory());
  const rootFiles = entries.filter((e) => e.isFile() && e.name.endsWith('.md'));

  const documentsWithoutBacklinks: Document[] = [];

  // Process folders
  for (const folder of folders) {
    // Skip if filtering and this isn't the target folder
    if (folderFilter && folder.name !== folderFilter) continue;

    const folderPath = path.join(NOTES_DIR, folder.name);
    const files = await fs.readdir(folderPath);
    const markdownFiles = files.filter((f) => f.endsWith('.md'));

    const folderDocs = await Promise.all(
      markdownFiles.map(async (file) => {
        const filePath = path.join(folderPath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const stats = await fs.stat(filePath);

        const filenameTitle = getTitleFromFilename(file);
        const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);
        const title = extractTitle(contentWithoutFrontmatter, frontmatter) || filenameTitle;
        const links = extractWikiLinks(content);

        return {
          slug: title,
          title,
          folder: folder.name,
          filePath: `notes/${folder.name}/${file}`,
          content,
          contentWithoutFrontmatter,
          frontmatter,
          links,
          backlinks: [],
          createdAt: stats.birthtime,
          updatedAt: stats.mtime,
        };
      })
    );
    documentsWithoutBacklinks.push(...folderDocs);
  }

  // Process root-level files (legacy)
  if (rootFiles.length > 0 && !folderFilter) {
    const rootDocs = await Promise.all(
      rootFiles.map(async (fileEntry) => {
        const filePath = path.join(NOTES_DIR, fileEntry.name);
        const content = await fs.readFile(filePath, 'utf-8');
        const stats = await fs.stat(filePath);

        const filenameTitle = getTitleFromFilename(fileEntry.name);
        const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);
        const title = extractTitle(contentWithoutFrontmatter, frontmatter) || filenameTitle;
        const links = extractWikiLinks(content);

        return {
          slug: title,
          title,
          folder: '', // Root level
          filePath: `notes/${fileEntry.name}`,
          content,
          contentWithoutFrontmatter,
          frontmatter,
          links,
          backlinks: [],
          createdAt: stats.birthtime,
          updatedAt: stats.mtime,
        };
      })
    );
    documentsWithoutBacklinks.push(...rootDocs);
  }

  // Calculate backlinks per folder (folder isolation)
  // Group documents by folder first
  const documentsByFolder = new Map<string, Document[]>();
  for (const doc of documentsWithoutBacklinks) {
    const folder = doc.folder || 'default';
    if (!documentsByFolder.has(folder)) {
      documentsByFolder.set(folder, []);
    }
    documentsByFolder.get(folder)!.push(doc);
  }

  // Calculate backlinks within each folder separately
  const folderBacklinksMaps = new Map<string, Map<string, string[]>>();
  for (const [folder, docs] of documentsByFolder) {
    const backlinksMap = calculateBacklinks(
      docs.map((doc) => ({ title: doc.title, links: doc.links }))
    );
    folderBacklinksMaps.set(folder, backlinksMap);
  }

  // Add folder-scoped backlinks to documents
  const documents = documentsWithoutBacklinks.map((doc) => {
    const folder = doc.folder || 'default';
    const folderBacklinks = folderBacklinksMaps.get(folder);
    const backlinks = folderBacklinks?.get(doc.title.normalize('NFC').toLowerCase()) || [];
    return {
      ...doc,
      backlinks,
    };
  });

  return documents;
}

/**
 * Helper: Get single document by title
 */
async function getDocumentByTitle(requestedTitle: string): Promise<Document> {
  // In published mode, read from JSON file
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

  // Try to find via cache first
  const cachedDoc = documentCache.getByTitle(requestedTitle);
  if (cachedDoc && cachedDoc.folder) {
    const filePath = path.join(NOTES_DIR, cachedDoc.folder, cachedDoc.filename);
    if (fss.existsSync(filePath)) {
      const content = await fs.readFile(filePath, 'utf-8');
      const stats = await fs.stat(filePath);
      const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);
      const title = extractTitle(contentWithoutFrontmatter, frontmatter) || cachedDoc.title;
      const links = extractWikiLinks(content);

      const allDocuments = await getAllDocuments();
      const normalizedTitle = title.normalize('NFC').toLowerCase();
      const backlinks =
        allDocuments.find((d) => d.title.normalize('NFC').toLowerCase() === normalizedTitle)
          ?.backlinks || [];

      return {
        slug: title,
        title,
        folder: cachedDoc.folder,
        filePath: `notes/${cachedDoc.folder}/${cachedDoc.filename}`,
        content,
        contentWithoutFrontmatter,
        frontmatter,
        links,
        backlinks,
        createdAt: stats.birthtime,
        updatedAt: stats.mtime,
      };
    }
  }

  // Fallback: scan all folders
  const allDocuments = await getAllDocuments();
  const document = allDocuments.find((d) => titlesMatch(d.title, requestedTitle));

  if (!document) {
    throw new Error(`Document not found: ${requestedTitle}`);
  }

  return document;
}
