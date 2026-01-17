import { NextRequest, NextResponse } from 'next/server';
import { tagCache } from '@/lib/tag-cache';
import { isPublishedMode } from '@/lib/env';
import { parseFrontmatter } from '@/lib/document-parser';
import { getNotesDir } from '@/lib/notes-path';
import fs from 'fs/promises';
import fss from 'fs';
import path from 'path';

/**
 * GET /api/tags
 * Get unique tags from cache
 * Query params:
 *   - folder: Filter by folder (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const folder = searchParams.get('folder');

    // In published mode, read from JSON file
    if (isPublishedMode()) {
      const docsJsonPath = path.join(process.cwd(), 'public', 'data', 'documents.json');
      const docs = JSON.parse(await fs.readFile(docsJsonPath, 'utf-8'));

      const tagSet = new Set<string>();
      docs.forEach((doc: { folder?: string; frontmatter?: { tags?: string[] } }) => {
        // Filter by folder if specified
        if (folder && doc.folder !== folder) return;

        if (doc.frontmatter?.tags && Array.isArray(doc.frontmatter.tags)) {
          doc.frontmatter.tags.forEach((tag: string) => {
            if (tag && typeof tag === 'string') {
              tagSet.add(tag.trim());
            }
          });
        }
      });

      const tags = Array.from(tagSet).sort();

      return NextResponse.json({
        success: true,
        data: {
          tags,
          cached: false,
          count: tags.length
        },
      });
    }

    // If folder is specified, scan the folder for tags
    if (folder) {
      const notesDir = getNotesDir();
      const folderPath = path.join(notesDir, folder);
      const tagSet = new Set<string>();

      if (fss.existsSync(folderPath)) {
        const files = await fs.readdir(folderPath);
        const markdownFiles = files.filter(f => f.endsWith('.md'));

        for (const file of markdownFiles) {
          const filePath = path.join(folderPath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const { frontmatter } = parseFrontmatter(content);

          if (frontmatter.tags && Array.isArray(frontmatter.tags)) {
            frontmatter.tags.forEach((tag: string) => {
              if (tag && typeof tag === 'string') {
                tagSet.add(tag.trim());
              }
            });
          }
        }
      }

      const tags = Array.from(tagSet).sort();

      return NextResponse.json({
        success: true,
        data: {
          tags,
          cached: false,
          count: tags.length
        },
      });
    }

    // No folder specified - use tag cache for all tags
    if (!tagCache.isReady()) {
      await tagCache.initialize();
    }

    const tags = tagCache.getTags();

    return NextResponse.json({
      success: true,
      data: {
        tags,
        cached: true,
        count: tags.length
      },
    });
  } catch (error) {
    console.error('Error fetching tags:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch tags',
      },
      { status: 500 }
    );
  }
}
