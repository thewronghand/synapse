import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import {
  parseFrontmatter,
  extractTitle,
  extractWikiLinks,
  calculateBacklinks,
} from '@/lib/document-parser';
import { Document } from '@/types';

const NOTES_DIR = path.join(process.cwd(), 'notes');

/**
 * GET /api/documents/[slug]
 * Get a single document by slug
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const document = await getDocumentBySlug(slug);

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
 * Body: { content: string }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { content } = await request.json();

    if (!content) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing content',
        },
        { status: 400 }
      );
    }

    const filePath = path.join(NOTES_DIR, `${slug}.md`);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Document not found',
        },
        { status: 404 }
      );
    }

    // Write updated content
    await fs.writeFile(filePath, content, 'utf-8');

    // Get updated document
    const document = await getDocumentBySlug(slug);

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
    const filePath = path.join(NOTES_DIR, `${slug}.md`);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Document not found',
        },
        { status: 404 }
      );
    }

    // Delete file
    await fs.unlink(filePath);

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
 * Helper: Get single document by slug
 */
async function getDocumentBySlug(slug: string): Promise<Document> {
  const filePath = path.join(NOTES_DIR, `${slug}.md`);
  const content = await fs.readFile(filePath, 'utf-8');
  const stats = await fs.stat(filePath);

  const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);
  const title = extractTitle(contentWithoutFrontmatter, frontmatter);
  const links = extractWikiLinks(content);

  // Calculate backlinks by checking all other documents
  const backlinks = await calculateBacklinksForDocument(slug);

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

/**
 * Helper: Calculate backlinks for a specific document
 */
async function calculateBacklinksForDocument(targetSlug: string): Promise<string[]> {
  const files = await fs.readdir(NOTES_DIR);
  const markdownFiles = files.filter((file) => file.endsWith('.md'));

  const backlinks: string[] = [];

  for (const file of markdownFiles) {
    const slug = file.replace('.md', '');
    if (slug === targetSlug) continue; // Skip self

    const filePath = path.join(NOTES_DIR, file);
    const content = await fs.readFile(filePath, 'utf-8');
    const links = extractWikiLinks(content);

    if (links.includes(targetSlug)) {
      backlinks.push(slug);
    }
  }

  return backlinks;
}
