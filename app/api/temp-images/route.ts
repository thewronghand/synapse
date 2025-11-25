import { NextRequest, NextResponse } from 'next/server';
import { deleteTempImages } from '@/lib/image-utils';

/**
 * DELETE /api/temp-images
 * Delete temp images from content
 * Body: { content: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const { content } = await request.json();

    if (!content) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing content',
        },
        { status: 400 }
      );
    }

    await deleteTempImages(content);

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
