import { NextResponse } from 'next/server';
import { documentCache } from '@/lib/document-cache';
import { isPublishedMode } from '@/lib/env';
import fs from 'fs/promises';
import path from 'path';

/**
 * GET /api/titles
 * Get all document titles from cache
 */
export async function GET() {
  try {
    // In published mode, read from JSON file
    if (isPublishedMode()) {
      const jsonPath = path.join(process.cwd(), 'public', 'data', 'titles.json');
      const jsonData = await fs.readFile(jsonPath, 'utf-8');
      const titles = JSON.parse(jsonData);

      return NextResponse.json({
        success: true,
        data: {
          titles,
          cached: false,
          count: titles.length
        },
      });
    }

    // In normal mode, use cache
    // Ensure cache is initialized
    if (!documentCache.isReady()) {
      await documentCache.initialize();
    }

    const titles = documentCache.getTitles();

    return NextResponse.json({
      success: true,
      data: {
        titles,
        cached: true,
        count: titles.length
      },
    });
  } catch (error) {
    console.error('Error fetching titles:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch titles',
      },
      { status: 500 }
    );
  }
}
