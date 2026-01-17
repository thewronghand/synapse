import { NextResponse } from 'next/server';
import { documentCache } from '@/lib/document-cache';

/**
 * GET /api/documents/titles
 * Get all document titles from cache (제목 기반)
 */
export async function GET() {
  try {
    // Initialize cache if not ready
    if (!documentCache.isReady()) {
      await documentCache.initialize();
    }

    const documents = documentCache.getDocuments();
    const titles = documents.map((doc) => doc.title);

    return NextResponse.json({
      success: true,
      data: {
        titles,
        cached: true,
        count: titles.length,
      },
    });
  } catch (error) {
    console.error('Error fetching document titles:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch document titles',
      },
      { status: 500 }
    );
  }
}
