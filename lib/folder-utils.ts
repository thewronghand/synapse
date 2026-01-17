import fs from 'fs/promises';
import fss from 'fs';
import path from 'path';
import { getNotesDir } from './notes-path';

const DEFAULT_FOLDER = 'default';

export interface FolderInfo {
  name: string;
  noteCount: number;
}

/**
 * notes 디렉토리 하위의 폴더 목록 조회 (1단계만)
 */
export async function getFolders(): Promise<FolderInfo[]> {
  const notesDir = getNotesDir();
  await ensureDefaultFolder();

  const entries = await fs.readdir(notesDir, { withFileTypes: true });
  const folders: FolderInfo[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const folderPath = path.join(notesDir, entry.name);
      const files = await fs.readdir(folderPath);
      const noteCount = files.filter(f => f.endsWith('.md')).length;
      folders.push({ name: entry.name, noteCount });
    }
  }

  // default 폴더를 맨 앞으로
  folders.sort((a, b) => {
    if (a.name === DEFAULT_FOLDER) return -1;
    if (b.name === DEFAULT_FOLDER) return 1;
    return a.name.localeCompare(b.name, 'ko');
  });

  return folders;
}

/**
 * default 폴더가 없으면 생성
 */
export async function ensureDefaultFolder(): Promise<void> {
  const notesDir = getNotesDir();
  const defaultPath = path.join(notesDir, DEFAULT_FOLDER);

  if (!fss.existsSync(defaultPath)) {
    await fs.mkdir(defaultPath, { recursive: true });
    console.log('[Folder] Created default folder');
  }
}

/**
 * 폴더 생성
 */
export async function createFolder(name: string): Promise<{ success: boolean; error?: string }> {
  const sanitized = sanitizeFolderName(name);
  if (!sanitized) {
    return { success: false, error: '유효하지 않은 폴더명입니다.' };
  }

  const notesDir = getNotesDir();
  const folderPath = path.join(notesDir, sanitized);

  if (fss.existsSync(folderPath)) {
    return { success: false, error: '이미 존재하는 폴더입니다.' };
  }

  try {
    await fs.mkdir(folderPath, { recursive: true });
    return { success: true };
  } catch (error) {
    console.error('[Folder] Create error:', error);
    return { success: false, error: '폴더 생성 중 오류가 발생했습니다.' };
  }
}

/**
 * 폴더 이름 변경
 */
export async function renameFolder(
  oldName: string,
  newName: string
): Promise<{ success: boolean; error?: string }> {
  if (oldName === DEFAULT_FOLDER) {
    return { success: false, error: 'default 폴더는 이름을 변경할 수 없습니다.' };
  }

  const sanitized = sanitizeFolderName(newName);
  if (!sanitized) {
    return { success: false, error: '유효하지 않은 폴더명입니다.' };
  }

  const notesDir = getNotesDir();
  const oldPath = path.join(notesDir, oldName);
  const newPath = path.join(notesDir, sanitized);

  if (!fss.existsSync(oldPath)) {
    return { success: false, error: '폴더를 찾을 수 없습니다.' };
  }

  if (fss.existsSync(newPath)) {
    return { success: false, error: '이미 존재하는 폴더명입니다.' };
  }

  try {
    await fs.rename(oldPath, newPath);
    return { success: true };
  } catch (error) {
    console.error('[Folder] Rename error:', error);
    return { success: false, error: '폴더 이름 변경 중 오류가 발생했습니다.' };
  }
}

/**
 * 폴더 삭제 (내부 파일도 함께 삭제)
 */
export async function deleteFolder(
  name: string
): Promise<{ success: boolean; error?: string }> {
  if (name === DEFAULT_FOLDER) {
    return { success: false, error: 'default 폴더는 삭제할 수 없습니다.' };
  }

  const notesDir = getNotesDir();
  const folderPath = path.join(notesDir, name);

  if (!fss.existsSync(folderPath)) {
    return { success: false, error: '폴더를 찾을 수 없습니다.' };
  }

  try {
    // 폴더 내 파일들을 default로 이동할지, 삭제할지 선택 가능
    // 여기서는 완전 삭제 (사용자 확인 후 호출되어야 함)
    await fs.rm(folderPath, { recursive: true, force: true });
    return { success: true };
  } catch (error) {
    console.error('[Folder] Delete error:', error);
    return { success: false, error: '폴더 삭제 중 오류가 발생했습니다.' };
  }
}

/**
 * 루트에 있는 노트들을 default 폴더로 마이그레이션
 */
export async function migrateRootNotesToDefault(): Promise<{
  success: boolean;
  migrated: number;
  error?: string;
}> {
  const notesDir = getNotesDir();
  await ensureDefaultFolder();

  const entries = await fs.readdir(notesDir, { withFileTypes: true });
  const rootNotes = entries.filter(
    e => e.isFile() && e.name.endsWith('.md')
  );

  if (rootNotes.length === 0) {
    return { success: true, migrated: 0 };
  }

  let migrated = 0;
  const defaultPath = path.join(notesDir, DEFAULT_FOLDER);

  for (const note of rootNotes) {
    const oldPath = path.join(notesDir, note.name);
    const newPath = path.join(defaultPath, note.name);

    try {
      // 같은 이름의 파일이 default에 이미 있으면 스킵
      if (fss.existsSync(newPath)) {
        console.log(`[Migration] Skipped (exists): ${note.name}`);
        continue;
      }

      await fs.rename(oldPath, newPath);
      migrated++;
      console.log(`[Migration] Moved: ${note.name} → default/`);
    } catch (error) {
      console.error(`[Migration] Error moving ${note.name}:`, error);
    }
  }

  return { success: true, migrated };
}

/**
 * 파일을 다른 폴더로 이동
 */
export async function moveNoteToFolder(
  filename: string,
  fromFolder: string,
  toFolder: string
): Promise<{ success: boolean; error?: string }> {
  const notesDir = getNotesDir();
  const oldPath = path.join(notesDir, fromFolder, filename);
  const newPath = path.join(notesDir, toFolder, filename);

  if (!fss.existsSync(oldPath)) {
    return { success: false, error: '파일을 찾을 수 없습니다.' };
  }

  const toFolderPath = path.join(notesDir, toFolder);
  if (!fss.existsSync(toFolderPath)) {
    return { success: false, error: '대상 폴더가 존재하지 않습니다.' };
  }

  if (fss.existsSync(newPath)) {
    return { success: false, error: '대상 폴더에 같은 이름의 파일이 있습니다.' };
  }

  try {
    await fs.rename(oldPath, newPath);
    return { success: true };
  } catch (error) {
    console.error('[Folder] Move error:', error);
    return { success: false, error: '파일 이동 중 오류가 발생했습니다.' };
  }
}

/**
 * 폴더명 유효성 검사 및 정리
 */
function sanitizeFolderName(name: string): string | null {
  if (!name || typeof name !== 'string') return null;

  const sanitized = name
    .normalize('NFC')
    .trim()
    .replace(/[/\\:*?"<>|]/g, '') // 금지 문자 제거
    .replace(/\s+/g, '-') // 공백을 하이픈으로
    .replace(/-+/g, '-') // 연속 하이픈 정리
    .replace(/^-|-$/g, ''); // 시작/끝 하이픈 제거

  if (!sanitized || sanitized.length === 0) return null;
  if (sanitized.length > 100) return null; // 너무 긴 이름 방지

  return sanitized;
}

/**
 * 파일 경로에서 폴더명 추출
 */
export function getFolderFromPath(filePath: string): string | null {
  // filePath: "notes/default/note.md" or "notes/note.md"
  const parts = filePath.split('/');

  // notes/folder/file.md 형태면 folder 반환
  if (parts.length >= 3 && parts[0] === 'notes') {
    return parts[1];
  }

  // notes/file.md 형태면 null (루트)
  return null;
}

export const DEFAULT_FOLDER_NAME = DEFAULT_FOLDER;
