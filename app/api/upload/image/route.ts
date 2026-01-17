import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';
import { getFolderTempImagesDir } from '@/lib/notes-path';

/**
 * POST /api/upload/image
 * Upload an image file to a specific folder
 * Query params:
 *   - folder: The folder name (required, e.g., 'default')
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folder = searchParams.get('folder');

    if (!folder) {
      return NextResponse.json(
        {
          success: false,
          error: 'Folder parameter is required',
        },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('image') as File;

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: 'No image file provided',
        },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid file type. Only JPEG, PNG, GIF, WebP, and SVG are allowed.',
        },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        {
          success: false,
          error: 'File size exceeds 10MB limit',
        },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const randomId = randomBytes(6).toString('hex'); // 12 character random string
    const extension = path.extname(file.name) || '.png';
    const filename = `${timestamp}-${randomId}${extension}`;

    // Ensure temp directory exists for this folder
    const tempDir = getFolderTempImagesDir(folder);
    await fs.mkdir(tempDir, { recursive: true });

    // Save file to folder's temp directory
    const filePath = path.join(tempDir, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);

    // Return API path for markdown (with folder and temp prefix)
    const apiPath = `/api/images/${folder}/temp/${filename}`;

    console.log(`[ImageUpload] Uploaded temp image: ${folder}/${filename} (${Math.round(file.size / 1024)}KB)`);

    return NextResponse.json({
      success: true,
      data: {
        filename,
        path: apiPath,
        folder,
        size: file.size,
        type: file.type,
      },
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to upload image',
      },
      { status: 500 }
    );
  }
}
