import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getNotesDir } from '@/lib/notes-path';

/**
 * GET /api/images/[...path]
 * Serve images from folder-based structure
 *
 * Path formats:
 *   /api/images/{folder}/{filename}           -> notes/{folder}/images/{filename}
 *   /api/images/{folder}/temp/{filename}      -> notes/{folder}/images/temp/{filename}
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;

    // Minimum: folder + filename (e.g., ['default', 'image.png'])
    if (pathSegments.length < 2) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid image path format',
        },
        { status: 400 }
      );
    }

    const folder = pathSegments[0];
    let filename: string;
    let isTemp = false;

    // Check if it's a temp image: /api/images/{folder}/temp/{filename}
    if (pathSegments[1] === 'temp' && pathSegments.length >= 3) {
      isTemp = true;
      filename = pathSegments.slice(2).join('/');
    } else {
      // Regular image: /api/images/{folder}/{filename}
      filename = pathSegments.slice(1).join('/');
    }

    // Security: prevent directory traversal
    if (folder.includes('..') || folder.includes('~') ||
        filename.includes('..') || filename.includes('~')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid file path',
        },
        { status: 400 }
      );
    }

    const notesDir = getNotesDir();
    const filePath = isTemp
      ? path.join(notesDir, folder, 'images', 'temp', filename)
      : path.join(notesDir, folder, 'images', filename);

    // Check if file exists and is within notes directory
    const realPath = await fs.realpath(filePath);
    if (!realPath.startsWith(notesDir)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid file path',
        },
        { status: 403 }
      );
    }

    // Read file
    const fileBuffer = await fs.readFile(filePath);
    const stats = await fs.stat(filePath);

    // Determine content type based on extension
    const ext = path.extname(filename).toLowerCase();
    const contentTypeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    };

    const contentType = contentTypeMap[ext] || 'application/octet-stream';

    // Return image with appropriate headers
    // Temp images get shorter cache, permanent images get long cache
    const cacheControl = isTemp
      ? 'public, max-age=3600'
      : 'public, max-age=31536000, immutable';

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': stats.size.toString(),
        'Cache-Control': cacheControl,
      },
    });
  } catch (error) {
    console.error('Error serving image:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Image not found',
      },
      { status: 404 }
    );
  }
}
