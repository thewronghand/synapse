import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { moveNoteToFolder } from "@/lib/folder-utils";
import fs from "fs/promises";
import fss from "fs";
import path from "path";
import {
  parseFrontmatter,
  extractTitle,
  getTitleFromFilename,
  titlesMatch,
} from "@/lib/document-parser";
import { getNotesDir } from "@/lib/notes-path";
import { documentCache } from "@/lib/document-cache";
import { graphCache } from "@/lib/graph-cache";
import { fileLock } from "@/lib/file-lock";

const NOTES_DIR = getNotesDir();

/**
 * moveNote Tool
 * 노트를 다른 폴더로 이동합니다.
 */
export const moveNoteTool = createTool({
  id: "move-note",
  description:
    "노트를 다른 폴더로 이동합니다. 원본 폴더와 대상 폴더를 지정해야 합니다.",
  inputSchema: z.object({
    title: z.string().describe("이동할 노트의 제목"),
    fromFolder: z.string().describe("현재 노트가 있는 폴더"),
    toFolder: z.string().describe("이동할 대상 폴더"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    title: z.string().optional(),
    fromFolder: z.string().optional(),
    toFolder: z.string().optional(),
    message: z.string(),
  }),
  execute: async ({ title, fromFolder, toFolder }) => {
    // 파일별 락을 사용하여 동시 이동 방지
    return fileLock.withLock(`note:${title}`, async () => {
    try {
      const requestedTitle = title.normalize("NFC");

      // 같은 폴더로 이동 시도
      if (fromFolder === toFolder) {
        return {
          success: false,
          message: "같은 폴더로는 이동할 수 없습니다.",
        };
      }

      // 노트 찾기 (fromFolder에서)
      const found = await findNoteInFolder(requestedTitle, fromFolder);
      if (!found) {
        return {
          success: false,
          message: `"${title}" 노트를 ${fromFolder} 폴더에서 찾을 수 없습니다.`,
        };
      }

      // 이동 실행
      const result = await moveNoteToFolder(found.filename, fromFolder, toFolder);

      if (!result.success) {
        return {
          success: false,
          message: result.error || "노트 이동에 실패했습니다.",
        };
      }

      // 캐시 업데이트
      documentCache.updateDocument(found.currentTitle, found.currentTitle, found.filename, toFolder);

      // 그래프 캐시도 무효화 (폴더 이동 시 그래프 재생성 필요)
      graphCache.invalidate();

      console.log(`[moveNote] Moved: ${found.currentTitle} from ${fromFolder} to ${toFolder}`);

      return {
        success: true,
        title: found.currentTitle,
        fromFolder,
        toFolder,
        message: `"${found.currentTitle}" 노트가 ${fromFolder}에서 ${toFolder}로 이동되었습니다.`,
      };
    } catch (error) {
      console.error("[moveNote] Error:", error);
      return {
        success: false,
        message: `노트 이동 중 오류가 발생했습니다: ${error}`,
      };
    }
    }); // fileLock.withLock 종료
  },
});

/**
 * 특정 폴더에서 제목으로 노트 찾기
 */
async function findNoteInFolder(
  requestedTitle: string,
  folder: string
): Promise<{
  filename: string;
  currentTitle: string;
} | null> {
  const folderPath = path.join(NOTES_DIR, folder);
  if (!fss.existsSync(folderPath)) {
    return null;
  }

  const files = await fs.readdir(folderPath);
  const markdownFiles = files.filter((f) => f.endsWith(".md"));

  for (const file of markdownFiles) {
    const filePath = path.join(folderPath, file);
    const content = await fs.readFile(filePath, "utf-8");
    const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);
    const filenameTitle = getTitleFromFilename(file);
    const docTitle = extractTitle(contentWithoutFrontmatter, frontmatter) || filenameTitle;

    if (titlesMatch(docTitle, requestedTitle)) {
      return {
        filename: file,
        currentTitle: docTitle,
      };
    }
  }

  return null;
}
