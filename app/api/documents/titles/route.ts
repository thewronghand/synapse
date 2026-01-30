import { NextRequest, NextResponse } from 'next/server';
import { documentCache } from '@/lib/document-cache';
import { isPublishedMode } from '@/lib/env';
import fs from 'fs/promises';
import path from 'path';

/**
 * GET /api/documents/titles
 * Get document titles from cache (제목 기반)
 * Query params:
 *   - folder: Filter by folder (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const folder = searchParams.get('folder');

    // 퍼블리시 모드: 정적 JSON에서 읽기
    if (isPublishedMode()) {
      const jsonPath = path.join(process.cwd(), 'public', 'data', 'documents.json');
      const jsonData = await fs.readFile(jsonPath, 'utf-8');
      const documents: { title: unknown; folder: string }[] = JSON.parse(jsonData);
      const titles = folder
        ? documents.filter((d) => d.folder === folder).map((d) => String(d.title))
        : documents.map((d) => String(d.title));

      return NextResponse.json({
        success: true,
        data: {
          titles,
          cached: false,
          count: titles.length,
        },
      });
    }

    // Initialize cache if not ready
    if (!documentCache.isReady()) {
      await documentCache.initialize();
    }

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
