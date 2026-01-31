import fs from "fs/promises";
import path from "path";
import { getNotesDir, getFolderAudioDir, getFolderTempAudioDir } from "@/lib/notes-path";
import type { VoiceMemoMeta } from "@/types";

/**
 * 메타데이터 JSON 파일 경로 반환
 */
export function getVoiceMemoMetaPath(folder: string, id: string): string {
  return path.join(getFolderAudioDir(folder), `${id}.meta.json`);
}

/**
 * 메타데이터 읽기
 */
export async function readVoiceMemoMeta(
  folder: string,
  id: string
): Promise<VoiceMemoMeta | null> {
  try {
    const metaPath = getVoiceMemoMetaPath(folder, id);
    const content = await fs.readFile(metaPath, "utf-8");
    return JSON.parse(content) as VoiceMemoMeta;
  } catch {
    return null;
  }
}

/**
 * 메타데이터 쓰기
 */
export async function writeVoiceMemoMeta(
  folder: string,
  meta: VoiceMemoMeta
): Promise<void> {
  const metaPath = getVoiceMemoMetaPath(folder, meta.id);
  await fs.mkdir(path.dirname(metaPath), { recursive: true });
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), "utf-8");
}

/**
 * temp 디렉토리에서 영구 저장소로 오디오 파일 이동
 */
export async function moveAudioFromTemp(
  folder: string,
  filename: string
): Promise<void> {
  const tempPath = path.join(getFolderTempAudioDir(folder), filename);
  const permanentPath = path.join(getFolderAudioDir(folder), filename);

  await fs.mkdir(path.dirname(permanentPath), { recursive: true });
  await fs.rename(tempPath, permanentPath);
}

/**
 * 특정 폴더의 음성 메모 목록 조회
 */
async function listVoiceMemosInFolder(
  folder: string
): Promise<VoiceMemoMeta[]> {
  const audioDir = getFolderAudioDir(folder);
  try {
    const entries = await fs.readdir(audioDir);
    const metaFiles = entries.filter((f) => f.endsWith(".meta.json"));

    const memos: VoiceMemoMeta[] = [];
    for (const metaFile of metaFiles) {
      try {
        const content = await fs.readFile(
          path.join(audioDir, metaFile),
          "utf-8"
        );
        memos.push(JSON.parse(content) as VoiceMemoMeta);
      } catch {
        // 파싱 실패한 메타데이터는 건너뜀
      }
    }
    return memos;
  } catch {
    // 디렉토리가 없으면 빈 배열
    return [];
  }
}

/**
 * 모든 폴더 또는 특정 폴더의 음성 메모 목록 조회
 * createdAt 내림차순 정렬
 */
export async function listVoiceMemos(
  folder?: string
): Promise<VoiceMemoMeta[]> {
  if (folder) {
    const memos = await listVoiceMemosInFolder(folder);
    return memos.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  // 모든 폴더 스캔
  const notesDir = getNotesDir();
  const entries = await fs.readdir(notesDir, { withFileTypes: true });
  const folders = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name);

  const allMemos: VoiceMemoMeta[] = [];
  for (const f of folders) {
    const memos = await listVoiceMemosInFolder(f);
    allMemos.push(...memos);
  }

  return allMemos.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * 음성 메모 삭제 (오디오 파일 + 메타데이터)
 */
export async function deleteVoiceMemo(
  folder: string,
  id: string
): Promise<void> {
  const meta = await readVoiceMemoMeta(folder, id);
  if (!meta) {
    throw new Error("음성 메모를 찾을 수 없습니다");
  }

  const audioPath = path.join(getFolderAudioDir(folder), meta.filename);
  const metaPath = getVoiceMemoMetaPath(folder, id);

  // 오디오 파일 삭제
  try {
    await fs.unlink(audioPath);
  } catch {
    // 이미 삭제되었을 수 있음
  }

  // 메타데이터 삭제
  await fs.unlink(metaPath);
}

/**
 * ID로 모든 폴더에서 음성 메모 검색
 */
export async function findVoiceMemoById(
  id: string
): Promise<VoiceMemoMeta | null> {
  const notesDir = getNotesDir();
  const entries = await fs.readdir(notesDir, { withFileTypes: true });
  const folders = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name);

  for (const folder of folders) {
    const meta = await readVoiceMemoMeta(folder, id);
    if (meta) return meta;
  }
  return null;
}
