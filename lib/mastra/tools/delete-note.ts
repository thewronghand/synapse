import { createTool } from "@mastra/core/tools";
import { z } from "zod";
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
import { tagCache } from "@/lib/tag-cache";

const NOTES_DIR = getNotesDir();
const TRASH_FOLDER = ".trash";

/**
 * deleteNote Tool
 * 문서를 삭제합니다 (소프트 딜리트 - .trash 폴더로 이동).
 */
export const deleteNoteTool = createTool({
  id: "delete-note",
  description:
    "노트를 삭제합니다. 실제로 파일을 지우지 않고 .trash 폴더로 이동합니다 (소프트 딜리트). 나중에 복구할 수 있습니다.",
  inputSchema: z.object({
    title: z.string().describe("삭제할 노트의 제목"),
    folder: z
      .string()
      .optional()
      .describe("노트가 있는 폴더명 (생략하면 전체 폴더에서 검색)"),
    permanent: z
      .boolean()
      .optional()
      .default(false)
      .describe("true면 영구 삭제, false면 휴지통으로 이동 (기본값: false)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    title: z.string().optional(),
    permanent: z.boolean().optional(),
    message: z.string(),
  }),
  execute: async ({ title, folder: targetFolder, permanent = false }) => {
    try {
      const requestedTitle = title.normalize("NFC");

      // 노트 찾기
      const found = await findNoteByTitle(requestedTitle, targetFolder);
      if (!found) {
        return {
          success: false,
          message: `"${title}" 노트를 찾을 수 없습니다.`,
        };
      }

      const { filePath, folder, filename, currentTitle } = found;

      if (permanent) {
        // 영구 삭제
        await fs.unlink(filePath);
        console.log(`[deleteNote] Permanently deleted: ${currentTitle}`);
      } else {
        // 소프트 딜리트: .trash 폴더로 이동
        const trashPath = path.join(NOTES_DIR, TRASH_FOLDER);
        if (!fss.existsSync(trashPath)) {
          await fs.mkdir(trashPath, { recursive: true });
        }

        // 휴지통에 같은 파일명이 있으면 타임스탬프 추가
        let trashFilename = filename;
        const trashFilePath = path.join(trashPath, trashFilename);
        if (fss.existsSync(trashFilePath)) {
          const timestamp = Date.now();
          const ext = path.extname(filename);
          const base = path.basename(filename, ext);
          trashFilename = `${base}_${timestamp}${ext}`;
        }

        const finalTrashPath = path.join(trashPath, trashFilename);
        await fs.rename(filePath, finalTrashPath);
        console.log(`[deleteNote] Moved to trash: ${currentTitle} -> ${trashFilename}`);
      }

      // 캐시 업데이트
      documentCache.removeDocument(currentTitle);
      graphCache.removeDocument(currentTitle);
      await tagCache.refreshTags();

      return {
        success: true,
        title: currentTitle,
        permanent,
        message: permanent
          ? `"${currentTitle}" 노트가 영구 삭제되었습니다.`
          : `"${currentTitle}" 노트가 휴지통으로 이동되었습니다. 나중에 복구할 수 있습니다.`,
      };
    } catch (error) {
      console.error("[deleteNote] Error:", error);
      return {
        success: false,
        message: `노트 삭제 중 오류가 발생했습니다: ${error}`,
      };
    }
  },
});

/**
 * 제목으로 노트 파일 찾기
 */
async function findNoteByTitle(
  requestedTitle: string,
  targetFolder?: string
): Promise<{
  filePath: string;
  folder: string;
  filename: string;
  currentTitle: string;
} | null> {
  // 특정 폴더가 지정된 경우 해당 폴더만 검색
  if (targetFolder) {
    const folderPath = path.join(NOTES_DIR, targetFolder);
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
          filePath,
          folder: targetFolder,
          filename: file,
          currentTitle: docTitle,
        };
      }
    }
    return null;
  }

  // 폴더 미지정: 캐시에서 먼저 찾기
  const cached = documentCache.getByTitle(requestedTitle);
  if (cached && cached.folder) {
    const filePath = path.join(NOTES_DIR, cached.folder, cached.filename);
    if (fss.existsSync(filePath)) {
      return {
        filePath,
        folder: cached.folder,
        filename: cached.filename,
        currentTitle: cached.title,
      };
    }
  }

  // 전체 폴더 스캔
  const entries = await fs.readdir(NOTES_DIR, { withFileTypes: true });
  const folders = entries.filter((e) => e.isDirectory() && e.name !== TRASH_FOLDER);

  for (const folder of folders) {
    const folderPath = path.join(NOTES_DIR, folder.name);
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
          filePath,
          folder: folder.name,
          filename: file,
          currentTitle: docTitle,
        };
      }
    }
  }

  return null;
}
