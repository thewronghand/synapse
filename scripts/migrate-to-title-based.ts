/**
 * 마이그레이션 스크립트: UUID 기반 파일명 → 제목 기반 파일명
 *
 * 이 스크립트는 기존 노트 파일들을 제목 기반 파일명으로 변환합니다.
 *
 * 사용법:
 *   npx ts-node --esm scripts/migrate-to-title-based.ts
 *
 * 또는 컴파일 후 실행:
 *   npx tsc scripts/migrate-to-title-based.ts --outDir scripts/dist
 *   node scripts/dist/migrate-to-title-based.js
 */

import fs from 'fs/promises';
import path from 'path';

// 파일 시스템 금지 문자
const FORBIDDEN_CHARS = /[/\\:*?"<>|]/g;

interface MigrationResult {
  oldFilename: string;
  newFilename: string;
  title: string;
  status: 'renamed' | 'skipped' | 'error';
  reason?: string;
}

/**
 * frontmatter에서 title 추출
 */
function extractTitleFromContent(content: string): string | null {
  // 1. frontmatter의 title 확인
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    const titleMatch = frontmatterMatch[1].match(/title:\s*(.+)/);
    if (titleMatch) {
      return titleMatch[1].trim().replace(/^["']|["']$/g, '');
    }
  }

  // 2. 첫 번째 H1 헤딩 확인
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) {
    return h1Match[1].trim();
  }

  return null;
}

/**
 * 파일명에서 제목 추출 (UUID 제거)
 */
function getTitleFromFilename(filename: string): string {
  // .md 확장자 제거
  let name = filename.replace(/\.md$/, '');

  // UUID 패턴 제거 (예: -a1b2c3d4 형태)
  // 일반적인 UUID 형태: 8-4-4-4-12 또는 짧은 형태
  name = name.replace(/-[a-f0-9]{8}(-[a-f0-9]{4}){0,3}(-[a-f0-9]{12})?$/i, '');

  // 숫자로만 끝나는 접미사 제거 (예: -1, -2)
  name = name.replace(/-\d+$/, '');

  return name.normalize('NFC');
}

/**
 * 제목을 안전한 파일명으로 변환
 */
function sanitizeFilename(title: string): string {
  return title
    .normalize('NFC')
    .trim()
    .replace(FORBIDDEN_CHARS, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * 중복 파일명 처리
 */
function getUniqueFilename(baseFilename: string, existingFilenames: Set<string>): string {
  if (!existingFilenames.has(baseFilename)) {
    return baseFilename;
  }

  let counter = 1;
  let newFilename = baseFilename;
  const name = baseFilename.replace(/\.md$/, '');

  while (existingFilenames.has(newFilename)) {
    newFilename = `${name}-${counter}.md`;
    counter++;
  }

  return newFilename;
}

async function migrate(): Promise<void> {
  const notesDir = process.env.NOTES_DIR || path.join(process.cwd(), 'notes');

  console.log('========================================');
  console.log('  파일명 마이그레이션: UUID → 제목 기반');
  console.log('========================================');
  console.log(`\n노트 디렉토리: ${notesDir}\n`);

  // 디렉토리 존재 확인
  try {
    await fs.access(notesDir);
  } catch {
    console.error(`오류: 노트 디렉토리를 찾을 수 없습니다: ${notesDir}`);
    process.exit(1);
  }

  // 마크다운 파일 목록 가져오기
  const files = await fs.readdir(notesDir);
  const markdownFiles = files.filter(f => f.endsWith('.md'));

  if (markdownFiles.length === 0) {
    console.log('마이그레이션할 마크다운 파일이 없습니다.');
    return;
  }

  console.log(`총 ${markdownFiles.length}개의 마크다운 파일 발견\n`);

  const results: MigrationResult[] = [];
  const newFilenames = new Set<string>();

  // 1단계: 새 파일명 결정
  for (const file of markdownFiles) {
    const filePath = path.join(notesDir, file);
    const content = await fs.readFile(filePath, 'utf-8');

    // 제목 추출 (content에서 먼저, 없으면 파일명에서)
    let title = extractTitleFromContent(content);
    if (!title) {
      title = getTitleFromFilename(file);
    }

    // 파일명 생성
    const safeFilename = sanitizeFilename(title);
    const newFilename = getUniqueFilename(`${safeFilename}.md`, newFilenames);
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

  // 2단계: 변경 사항 미리보기
  console.log('변경 예정 사항:\n');
  console.log('─'.repeat(80));

  const toRename = results.filter(r => r.status === 'renamed');
  const toSkip = results.filter(r => r.status === 'skipped');

  if (toRename.length > 0) {
    console.log('\n이름 변경될 파일:');
    for (const result of toRename) {
      console.log(`  ${result.oldFilename}`);
      console.log(`    → ${result.newFilename}`);
      console.log(`    (제목: ${result.title})\n`);
    }
  }

  if (toSkip.length > 0) {
    console.log('\n건너뛸 파일:');
    for (const result of toSkip) {
      console.log(`  ${result.oldFilename} - ${result.reason}`);
    }
  }

  console.log('\n' + '─'.repeat(80));
  console.log(`\n총계: ${toRename.length}개 변경 예정, ${toSkip.length}개 건너뜀\n`);

  if (toRename.length === 0) {
    console.log('변경할 파일이 없습니다. 마이그레이션 완료!');
    return;
  }

  // 3단계: 사용자 확인
  console.log('⚠️  경고: 이 작업은 되돌릴 수 없습니다.');
  console.log('계속하려면 환경 변수 MIGRATE_CONFIRM=yes를 설정하고 다시 실행하세요.\n');
  console.log('예시: MIGRATE_CONFIRM=yes npx ts-node scripts/migrate-to-title-based.ts\n');

  if (process.env.MIGRATE_CONFIRM !== 'yes') {
    console.log('마이그레이션이 취소되었습니다.');
    return;
  }

  // 4단계: 실제 마이그레이션 수행
  console.log('마이그레이션 시작...\n');

  for (const result of toRename) {
    const oldPath = path.join(notesDir, result.oldFilename);
    const newPath = path.join(notesDir, result.newFilename);

    try {
      await fs.rename(oldPath, newPath);
      console.log(`✓ ${result.oldFilename} → ${result.newFilename}`);
    } catch (error) {
      result.status = 'error';
      result.reason = error instanceof Error ? error.message : String(error);
      console.error(`✗ ${result.oldFilename}: ${result.reason}`);
    }
  }

  // 5단계: 결과 요약
  const successCount = results.filter(r => r.status === 'renamed').length;
  const skipCount = results.filter(r => r.status === 'skipped').length;
  const errorCount = results.filter(r => r.status === 'error').length;

  console.log('\n' + '═'.repeat(80));
  console.log('마이그레이션 완료!');
  console.log(`  성공: ${successCount}개`);
  console.log(`  건너뜀: ${skipCount}개`);
  console.log(`  오류: ${errorCount}개`);
  console.log('═'.repeat(80));

  if (errorCount > 0) {
    console.log('\n오류가 발생한 파일:');
    for (const result of results.filter(r => r.status === 'error')) {
      console.log(`  ${result.oldFilename}: ${result.reason}`);
    }
  }
}

// 실행
migrate().catch(console.error);
