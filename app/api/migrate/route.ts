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
        stack: error instanceof Error ? error.stack : undefined,
        debugInfo: String(error),
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
      // oldFilename and newFilename may contain folder path (e.g., "folder/file.md")
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
        stack: error instanceof Error ? error.stack : undefined,
        debugInfo: String(error),
      },
      { status: 500 }
    );
  }
}

interface FileEntry {
  filename: string;
  folder: string; // '' for root, 'foldername' for subfolders
}

/**
 * 파일 분석 및 새 파일명 결정 (서브디렉토리 포함)
 */
async function analyzeFiles(notesDir: string): Promise<MigrationResult[]> {
  const fileEntries: FileEntry[] = [];

  // Get all entries in notes directory
  const entries = await fs.readdir(notesDir, { withFileTypes: true });

  // Process root level markdown files
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      fileEntries.push({ filename: entry.name, folder: '' });
    }
  }

  // Process subdirectories
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const folderPath = path.join(notesDir, entry.name);
      const folderFiles = await fs.readdir(folderPath);
      const markdownFiles = folderFiles.filter(f => f.endsWith('.md'));

      for (const file of markdownFiles) {
        fileEntries.push({ filename: file, folder: entry.name });
      }
    }
  }

  const results: MigrationResult[] = [];
  // Track new filenames per folder to avoid duplicates within same folder
  const newFilenamesPerFolder = new Map<string, Set<string>>();

  for (const { filename, folder } of fileEntries) {
    const filePath = folder
      ? path.join(notesDir, folder, filename)
      : path.join(notesDir, filename);
    const content = await fs.readFile(filePath, 'utf-8');

    // 제목 추출
    const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);
    let title = extractTitle(contentWithoutFrontmatter, frontmatter);

    // frontmatter나 H1에서 제목을 찾지 못하면 파일명에서 추출
    if (!title) {
      title = getTitleFromFilename(filename);
    }

    // 파일명 생성
    const safeFilename = sanitizeFilename(title);
    let newFilename = `${safeFilename}.md`;

    // Get or create filename set for this folder
    if (!newFilenamesPerFolder.has(folder)) {
      newFilenamesPerFolder.set(folder, new Set<string>());
    }
    const folderFilenames = newFilenamesPerFolder.get(folder)!;

    // 중복 파일명 처리 (같은 폴더 내에서만)
    if (folderFilenames.has(newFilename) && filename !== newFilename) {
      let counter = 1;
      const baseName = safeFilename;
      while (folderFilenames.has(newFilename)) {
        newFilename = `${baseName}-${counter}.md`;
        counter++;
      }
    }

    folderFilenames.add(newFilename);

    const displayOldPath = folder ? `${folder}/${filename}` : filename;
    const displayNewPath = folder ? `${folder}/${newFilename}` : newFilename;

    if (filename === newFilename) {
      results.push({
        oldFilename: displayOldPath,
        newFilename: displayNewPath,
        title,
        status: 'skipped',
        reason: '이미 제목 기반 파일명',
      });
    } else {
      results.push({
        oldFilename: displayOldPath,
        newFilename: displayNewPath,
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
