import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const IMAGES_DIR = path.join(process.cwd(), 'notes', 'images');

/**
 * GET /api/images/[...path]
 * Serve images from notes/images directory
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;
    const filename = pathSegments.join('/');

    // Security: prevent directory traversal
    if (filename.includes('..') || filename.includes('~')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid file path',
        },
        { status: 400 }
      );
    }

    const filePath = path.join(IMAGES_DIR, filename);

    // Check if file exists and is within IMAGES_DIR
    const realPath = await fs.realpath(filePath);
    if (!realPath.startsWith(IMAGES_DIR)) {
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
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': stats.size.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
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
