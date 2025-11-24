import { NextResponse } from 'next/server';
import { tagCache } from '@/lib/tag-cache';

/**
 * GET /api/tags
 * Get all unique tags from cache
 */
export async function GET() {
  try {
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
