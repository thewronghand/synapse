import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import fs from "fs/promises";
import fss from "fs";
import path from "path";
import { getNotesDir } from "@/lib/notes-path";
import { documentCache } from "@/lib/document-cache";
import { graphCache } from "@/lib/graph-cache";
import { fileLock } from "@/lib/file-lock";

const NOTES_DIR = getNotesDir();
const TRASH_FOLDER = ".trash";

/**
 * deleteFolder Tool
 * 폴더를 삭제합니다.
 * - 빈 폴더: 즉시 삭제
 * - 노트가 있는 폴더: force=true일 때만 삭제 (노트는 휴지통으로 이동)
 */
export const deleteFolderTool = createTool({
  id: "delete-folder",
  description:
    "폴더를 삭제합니다. 빈 폴더는 바로 삭제되고, 노트가 있는 폴더는 force=true 옵션 사용 시 노트를 휴지통으로 이동 후 삭제합니다.",
  inputSchema: z.object({
    folder: z.string().describe("삭제할 폴더명"),
    force: z
      .boolean()
      .optional()
      .default(false)
      .describe("true면 폴더 내 노트를 휴지통으로 이동 후 삭제 (기본값: false)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    folder: z.string().optional(),
    movedNotes: z.number().optional(),
    message: z.string(),
  }),
  execute: async ({ folder, force = false }) => {
    // 폴더별 락을 사용하여 동시 삭제 방지
    return fileLock.withLock(`folder:${folder}`, async () => {
      try {
        // 보호된 폴더 체크
        if (folder === "default" || folder === TRASH_FOLDER) {
          return {
            success: false,
            message: `"${folder}" 폴더는 삭제할 수 없습니다.`,
          };
        }

        const folderPath = path.join(NOTES_DIR, folder);

        // 폴더 존재 확인
        if (!fss.existsSync(folderPath)) {
          return {
            success: false,
            message: `"${folder}" 폴더가 존재하지 않습니다.`,
          };
        }

        // 폴더 내 파일 목록
        const files = await fs.readdir(folderPath);
        const markdownFiles = files.filter((f) => f.endsWith(".md"));

        // 빈 폴더가 아니고 force가 false면 거부
        if (markdownFiles.length > 0 && !force) {
          return {
            success: false,
            message: `"${folder}" 폴더에 ${markdownFiles.length}개의 노트가 있습니다. force=true 옵션을 사용하면 노트를 휴지통으로 이동 후 폴더를 삭제합니다.`,
          };
        }

        let movedNotes = 0;

        // 노트가 있으면 휴지통으로 이동
        if (markdownFiles.length > 0) {
          const trashPath = path.join(NOTES_DIR, TRASH_FOLDER);
          if (!fss.existsSync(trashPath)) {
            await fs.mkdir(trashPath, { recursive: true });
          }

          for (const file of markdownFiles) {
            const srcPath = path.join(folderPath, file);
            let destFilename = file;

            // 휴지통에 같은 파일명이 있으면 타임스탬프 추가
            let destPath = path.join(trashPath, destFilename);
            if (fss.existsSync(destPath)) {
              const timestamp = Date.now();
              const ext = path.extname(file);
              const base = path.basename(file, ext);
              destFilename = `${base}_${timestamp}${ext}`;
              destPath = path.join(trashPath, destFilename);
            }

            await fs.rename(srcPath, destPath);
            movedNotes++;

            // 캐시에서 문서 제거
            // 파일명에서 제목 추출 (간단히 .md 제거)
            const titleFromFilename = file.replace(/\.md$/, "");
            documentCache.removeDocument(titleFromFilename);
            graphCache.removeDocument(titleFromFilename);
          }
        }

        // 폴더 내 다른 파일/폴더도 삭제 (images, audio 등)
        const remainingFiles = await fs.readdir(folderPath);
        for (const item of remainingFiles) {
          const itemPath = path.join(folderPath, item);
          const stat = await fs.stat(itemPath);
          if (stat.isDirectory()) {
            await fs.rm(itemPath, { recursive: true });
          } else {
            await fs.unlink(itemPath);
          }
        }

        // 폴더 삭제
        await fs.rmdir(folderPath);

        console.log(`[deleteFolder] Deleted: ${folder}, moved ${movedNotes} notes to trash`);

        return {
          success: true,
          folder,
          movedNotes,
          message:
            movedNotes > 0
              ? `"${folder}" 폴더가 삭제되었습니다. ${movedNotes}개의 노트가 휴지통으로 이동되었습니다.`
              : `"${folder}" 폴더가 삭제되었습니다.`,
        };
      } catch (error) {
        console.error("[deleteFolder] Error:", error);
        return {
          success: false,
          message: `폴더 삭제 중 오류가 발생했습니다: ${error}`,
        };
      }
    });
  },
});
