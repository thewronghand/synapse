import { NextResponse } from 'next/server';
import { tagCache } from '@/lib/tag-cache';
import { isPublishedMode } from '@/lib/env';
import fs from 'fs/promises';
import path from 'path';

/**
 * GET /api/tags
 * Get all unique tags from cache
 */
export async function GET() {
  try {
    // In published mode, read from JSON file
    if (isPublishedMode()) {
      const jsonPath = path.join(process.cwd(), 'public', 'data', 'tags.json');
      const jsonData = await fs.readFile(jsonPath, 'utf-8');
      const tags = JSON.parse(jsonData);

      return NextResponse.json({
        success: true,
        data: {
          tags,
          cached: false,
          count: tags.length
        },
      });
    }

    // In normal mode, use cache
    // Ensure cache is initialized
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
