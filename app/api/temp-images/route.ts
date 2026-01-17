import { NextRequest, NextResponse } from 'next/server';
import { deleteTempImages } from '@/lib/image-utils';

/**
 * DELETE /api/temp-images
 * Delete temp images from content
 * Body: { content: string, folder: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const { content, folder } = await request.json();

    if (!content) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing content',
        },
        { status: 400 }
      );
    }

    if (!folder) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing folder',
        },
        { status: 400 }
      );
    }

    await deleteTempImages(content, folder);

    return NextResponse.json({
      success: true,
      data: { message: 'Temp images deleted' },
    });
  } catch (error) {
    console.error('Error deleting temp images:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete temp images',
      },
      { status: 500 }
    );
  }
}
