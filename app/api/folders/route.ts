import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import {
  getFolders,
  createFolder,
  migrateRootNotesToDefault,
  ensureDefaultFolder,
  FolderInfo,
} from '@/lib/folder-utils';
import { isPublishedMode } from '@/lib/env';

/**
 * GET /api/folders
 * 폴더 목록 조회 (초기화 포함)
 */
export async function GET(request: NextRequest) {
  try {
    // Published mode: read from JSON
    if (isPublishedMode()) {
      const jsonPath = path.join(process.cwd(), 'public', 'data', 'folders.json');
      const docsJsonPath = path.join(process.cwd(), 'public', 'data', 'documents.json');

      try {
        const folderNames: string[] = JSON.parse(await fs.readFile(jsonPath, 'utf-8'));
        const docs = JSON.parse(await fs.readFile(docsJsonPath, 'utf-8'));

        // Calculate note count per folder
        const folders: FolderInfo[] = folderNames.map(name => ({
          name,
          noteCount: docs.filter((d: { folder: string }) => d.folder === name).length,
        }));

        return NextResponse.json({
          success: true,
          data: {
            folders,
            count: folders.length,
          },
        });
      } catch {
        return NextResponse.json({
          success: true,
          data: { folders: [], count: 0 },
        });
      }
    }

    const searchParams = request.nextUrl.searchParams;
    const migrate = searchParams.get('migrate') === 'true';

    // default 폴더 확인/생성
    await ensureDefaultFolder();

    // 루트 노트 마이그레이션 요청 시
    if (migrate) {
      const result = await migrateRootNotesToDefault();
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 }
        );
      }
    }

    const folders = await getFolders();

    return NextResponse.json({
      success: true,
      data: {
        folders,
        count: folders.length,
      },
    });
  } catch (error) {
    console.error('Error fetching folders:', error);
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
 * POST /api/folders
 * 새 폴더 생성
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { success: false, error: '폴더명을 입력해주세요.' },
        { status: 400 }
      );
    }

    const result = await createFolder(name);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    // 생성 후 폴더 목록 반환
    const folders = await getFolders();

    return NextResponse.json({
      success: true,
      data: {
        folders,
        created: name,
      },
    });
  } catch (error) {
    console.error('Error creating folder:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
