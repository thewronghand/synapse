import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import {
  parseFrontmatter,
  extractTitle,
  extractWikiLinks,
  calculateBacklinks,
  getSlugFromFilePath,
} from '@/lib/document-parser';
import { Document } from '@/types';

const NOTES_DIR = path.join(process.cwd(), 'notes');

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
 * Body: { slug: string, content: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { slug, content } = await request.json();

    if (!slug || !content) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing slug or content',
        },
        { status: 400 }
      );
    }

    const filePath = path.join(NOTES_DIR, `${slug}.md`);

    // Check if file already exists
    try {
      await fs.access(filePath);
      return NextResponse.json(
        {
          success: false,
          error: 'Document already exists',
        },
        { status: 409 }
      );
    } catch {
      // File doesn't exist, proceed
    }

    // Write file
    await fs.writeFile(filePath, content, 'utf-8');

    // Get the created document
    const document = await getDocumentBySlug(slug);

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
  const files = await fs.readdir(NOTES_DIR);
  const markdownFiles = files.filter((file) => file.endsWith('.md'));

  const documentsWithoutBacklinks = await Promise.all(
    markdownFiles.map(async (file) => {
      const filePath = path.join(NOTES_DIR, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const stats = await fs.stat(filePath);

      const slug = getSlugFromFilePath(file);
      const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);
      const title = extractTitle(contentWithoutFrontmatter, frontmatter);
      const links = extractWikiLinks(content);

      return {
        slug,
        filePath: `notes/${file}`,
        title,
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

  // Calculate backlinks
  const backlinksMap = calculateBacklinks(documentsWithoutBacklinks);

  // Add backlinks to documents
  const documents = documentsWithoutBacklinks.map((doc) => ({
    ...doc,
    backlinks: backlinksMap.get(doc.slug) || [],
  }));

  return documents;
}

/**
 * Helper: Get single document by slug
 */
async function getDocumentBySlug(slug: string): Promise<Document> {
  const filePath = path.join(NOTES_DIR, `${slug}.md`);
  const content = await fs.readFile(filePath, 'utf-8');
  const stats = await fs.stat(filePath);

  const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);
  const title = extractTitle(contentWithoutFrontmatter, frontmatter);
  const links = extractWikiLinks(content);

  // Get all documents to calculate backlinks
  const allDocuments = await getAllDocuments();
  const backlinks =
    allDocuments.find((d) => d.slug === slug)?.backlinks || [];

  return {
    slug,
    filePath: `notes/${slug}.md`,
    title,
    content,
    contentWithoutFrontmatter,
    frontmatter,
    links,
    backlinks,
    createdAt: stats.birthtime,
    updatedAt: stats.mtime,
  };
}
