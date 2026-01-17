import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getNotesDir } from '@/lib/notes-path';
import { parseFrontmatter, extractTitle, sanitizeFilename } from '@/lib/document-parser';

interface MigrationResult {
  oldFilename: string;
  newFilename: string;
  title: string;
  status: 'renamed' | 'skipped' | 'error';
  reason?: string;
}

/**
 * GET /api/migrate
 * 마이그레이션 미리보기 (실제 변경 없음)
 */
export async function GET() {
  try {
    const notesDir = getNotesDir();
    const results = await analyzeFiles(notesDir);

    const toRename = results.filter(r => r.status === 'renamed');
    const toSkip = results.filter(r => r.status === 'skipped');

    return NextResponse.json({
      success: true,
      data: {
        preview: true,
        total: results.length,
        toRename: toRename.length,
        toSkip: toSkip.length,
        details: results,
      },
    });
  } catch (error) {
    console.error('Migration preview error:', error);
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
 * POST /api/migrate
 * 실제 마이그레이션 수행
 */
export async function POST() {
  try {
    const notesDir = getNotesDir();
    const results = await analyzeFiles(notesDir);

    const toRename = results.filter(r => r.status === 'renamed');

    if (toRename.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          message: '변경할 파일이 없습니다.',
          renamed: 0,
          skipped: results.filter(r => r.status === 'skipped').length,
          errors: 0,
        },
      });
    }

    // 실제 파일명 변경
    let successCount = 0;
    let errorCount = 0;

    for (const result of toRename) {
      const oldPath = path.join(notesDir, result.oldFilename);
      const newPath = path.join(notesDir, result.newFilename);

      try {
        await fs.rename(oldPath, newPath);
        result.status = 'renamed';
        successCount++;
        console.log(`[Migration] Renamed: ${result.oldFilename} → ${result.newFilename}`);
      } catch (error) {
        result.status = 'error';
        result.reason = error instanceof Error ? error.message : 'Unknown error';
        errorCount++;
        console.error(`[Migration] Error: ${result.oldFilename}: ${result.reason}`);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        message: `마이그레이션 완료! ${successCount}개 파일 변경됨`,
        renamed: successCount,
        skipped: results.filter(r => r.status === 'skipped').length,
        errors: errorCount,
        details: results,
      },
    });
  } catch (error) {
    console.error('Migration error:', error);
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
 * 파일 분석 및 새 파일명 결정
 */
async function analyzeFiles(notesDir: string): Promise<MigrationResult[]> {
  const files = await fs.readdir(notesDir);
  const markdownFiles = files.filter(f => f.endsWith('.md'));

  const results: MigrationResult[] = [];
  const newFilenames = new Set<string>();

  for (const file of markdownFiles) {
    const filePath = path.join(notesDir, file);
    const content = await fs.readFile(filePath, 'utf-8');

    // 제목 추출
    const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);
    let title = extractTitle(contentWithoutFrontmatter, frontmatter);

    // frontmatter나 H1에서 제목을 찾지 못하면 파일명에서 추출
    if (!title) {
      title = getTitleFromFilename(file);
    }

    // 파일명 생성
    const safeFilename = sanitizeFilename(title);
    let newFilename = `${safeFilename}.md`;

    // 중복 파일명 처리
    if (newFilenames.has(newFilename) && file !== newFilename) {
      let counter = 1;
      const baseName = safeFilename;
      while (newFilenames.has(newFilename)) {
        newFilename = `${baseName}-${counter}.md`;
        counter++;
      }
    }

    newFilenames.add(newFilename);

    if (file === newFilename) {
      results.push({
        oldFilename: file,
        newFilename: newFilename,
        title,
        status: 'skipped',
        reason: '이미 제목 기반 파일명',
      });
    } else {
      results.push({
        oldFilename: file,
        newFilename: newFilename,
        title,
        status: 'renamed',
      });
    }
  }

  return results;
}

/**
 * 파일명에서 제목 추출 (UUID 등 제거)
 */
function getTitleFromFilename(filename: string): string {
  // .md 확장자 제거
  let name = filename.replace(/\.md$/, '');

  // UUID 패턴 제거 (예: -a1b2c3d4, -a1b2c3d4-e5f6-7890-abcd-ef1234567890)
  name = name.replace(/-[a-f0-9]{8}(-[a-f0-9]{4}){0,3}(-[a-f0-9]{12})?$/i, '');

  // 숫자 접미사 제거 (예: -1, -2)
  name = name.replace(/-\d+$/, '');

  return name.normalize('NFC').trim() || filename.replace(/\.md$/, '');
}
