import { NextRequest, NextResponse } from 'next/server';
import { renameFolder, deleteFolder, getFolders } from '@/lib/folder-utils';

interface RouteParams {
  params: Promise<{ name: string }>;
}

/**
 * PUT /api/folders/[name]
 * 폴더 이름 변경
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { name: oldName } = await params;
    const body = await request.json();
    const { newName } = body;

    if (!newName || typeof newName !== 'string') {
      return NextResponse.json(
        { success: false, error: '새 폴더명을 입력해주세요.' },
        { status: 400 }
      );
    }

    const decodedOldName = decodeURIComponent(oldName);
    const result = await renameFolder(decodedOldName, newName);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    const folders = await getFolders();

    return NextResponse.json({
      success: true,
      data: {
        folders,
        renamed: { from: decodedOldName, to: newName },
      },
    });
  } catch (error) {
    console.error('Error renaming folder:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/folders/[name]
 * 폴더 삭제 (내부 파일도 함께 삭제)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { name } = await params;
    const decodedName = decodeURIComponent(name);

    const result = await deleteFolder(decodedName);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    const folders = await getFolders();

    return NextResponse.json({
      success: true,
      data: {
        folders,
        deleted: decodedName,
      },
    });
  } catch (error) {
    console.error('Error deleting folder:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
