import fs from "fs/promises";
import path from "path";
import { getFolderAudioDir, getFolderTempAudioDir } from "@/lib/notes-path";

// 폴더의 오디오 디렉토리들이 존재하는지 확인하고 생성
async function ensureFolderAudioDirs(folder: string): Promise<void> {
  const audioDir = getFolderAudioDir(folder);
  const tempDir = getFolderTempAudioDir(folder);

  await fs.mkdir(audioDir, { recursive: true });
  await fs.mkdir(tempDir, { recursive: true });
}

// 마크다운 콘텐츠에서 temp 오디오 참조를 찾아 영구 저장소로 이동
export async function moveAudioFromTemp(
  content: string,
  folder: string
): Promise<string> {
  // <audio src="/api/audio/folder/temp/filename.webm" ...> 패턴 매칭
  const audioRegex = new RegExp(
    `/api/audio/${escapeRegex(folder)}/temp/([^"\\s>]+)`,
    "g"
  );
  const matches = Array.from(content.matchAll(audioRegex));

  if (matches.length === 0) {
    return content;
  }

  await ensureFolderAudioDirs(folder);

  const audioDir = getFolderAudioDir(folder);
  const tempDir = getFolderTempAudioDir(folder);

  let updatedContent = content;

  for (const match of matches) {
    const filename = match[1];
    const tempPath = path.join(tempDir, filename);
    const permanentPath = path.join(audioDir, filename);

    try {
      await fs.access(tempPath);
      await fs.rename(tempPath, permanentPath);

      const oldPath = `/api/audio/${folder}/temp/${filename}`;
      const newPath = `/api/audio/${folder}/${filename}`;
      updatedContent = updatedContent.replace(oldPath, newPath);

      console.log(
        `[AudioUtils] Moved temp audio to permanent: ${folder}/${filename}`
      );
    } catch (error) {
      console.error(
        `[AudioUtils] Failed to move temp audio ${folder}/${filename}:`,
        error
      );
    }
  }

  return updatedContent;
}

// 정규식 특수문자 이스케이프
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
