import { NextRequest, NextResponse } from 'next/server';
import { documentCache } from '@/lib/document-cache';

/**
 * GET /api/documents/titles
 * Get document titles from cache (제목 기반)
 * Query params:
 *   - folder: Filter by folder (optional)
 */
export async function GET(request: NextRequest) {
  try {
    // Initialize cache if not ready
    if (!documentCache.isReady()) {
      await documentCache.initialize();
    }

    const searchParams = request.nextUrl.searchParams;
    const folder = searchParams.get('folder');

    // Get documents filtered by folder if specified
    const documents = folder
      ? documentCache.getDocumentsByFolder(folder)
      : documentCache.getDocuments();
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
