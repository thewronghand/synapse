import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import fs from "fs/promises";
import fss from "fs";
import path from "path";
import { sanitizeFilename, parseFrontmatter, extractTitle } from "@/lib/document-parser";
import { getNotesDir } from "@/lib/notes-path";
import { documentCache } from "@/lib/document-cache";
import { tagCache } from "@/lib/tag-cache";
import { graphCache } from "@/lib/graph-cache";
import { DEFAULT_FOLDER_NAME } from "@/lib/folder-utils";

const NOTES_DIR = getNotesDir();

/**
 * createNote Tool
 * 새로운 문서를 생성합니다.
 */
export const createNoteTool = createTool({
  id: "create-note",
  description:
    "새로운 노트를 생성합니다. 제목과 내용을 지정하고, 선택적으로 폴더와 태그를 설정할 수 있습니다.",
  inputSchema: z.object({
    title: z.string().describe("노트 제목"),
    content: z.string().describe("노트 내용 (마크다운 형식)"),
    folder: z
      .string()
      .optional()
      .default(DEFAULT_FOLDER_NAME)
      .describe(`저장할 폴더 (기본값: ${DEFAULT_FOLDER_NAME})`),
    tags: z
      .array(z.string())
      .optional()
      .describe("태그 목록 (선택사항)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    title: z.string().optional(),
    folder: z.string().optional(),
    message: z.string(),
  }),
  execute: async ({ title, content, folder = DEFAULT_FOLDER_NAME, tags }) => {
    try {
      const normalizedTitle = title.normalize("NFC").trim();

      // 중복 제목 체크 (같은 폴더 내)
      if (documentCache.hasTitleInFolder(normalizedTitle, folder)) {
        return {
          success: false,
          message: `"${normalizedTitle}" 제목의 노트가 이미 ${folder} 폴더에 존재합니다.`,
        };
      }

      // 폴더 존재 확인 및 생성
      const folderPath = path.join(NOTES_DIR, folder);
      if (!fss.existsSync(folderPath)) {
        await fs.mkdir(folderPath, { recursive: true });
      }

      // 파일명 생성
      const safeFilename = sanitizeFilename(normalizedTitle);
      const filename = `${safeFilename}.md`;
      const filePath = path.join(folderPath, filename);

      // 파일 존재 확인
      if (fss.existsSync(filePath)) {
        return {
          success: false,
          message: `동일한 파일명의 노트가 이미 존재합니다: ${filename}`,
        };
      }

      // frontmatter 생성
      let finalContent = content;
      if (tags && tags.length > 0) {
        const frontmatter = `---\ntitle: "${normalizedTitle}"\ntags:\n${tags.map((t) => `  - ${t}`).join("\n")}\n---\n\n`;
        finalContent = frontmatter + content;
      } else {
        // 제목만 frontmatter에 추가
        const frontmatter = `---\ntitle: "${normalizedTitle}"\n---\n\n`;
        finalContent = frontmatter + content;
      }

      // 파일 작성
      await fs.writeFile(filePath, finalContent, "utf-8");

      // 캐시 업데이트
      const { frontmatter: fm, contentWithoutFrontmatter } = parseFrontmatter(finalContent);
      const extractedTitle = extractTitle(contentWithoutFrontmatter, fm) || normalizedTitle;

      documentCache.addDocument(extractedTitle, filename, folder);

      if (fm.tags && Array.isArray(fm.tags)) {
        tagCache.addTags(fm.tags);
      }

      await graphCache.addDocument(extractedTitle, filename, finalContent);

      console.log(`[createNote] Created: ${folder}/${filename}`);

      return {
        success: true,
        title: extractedTitle,
        folder,
        message: `"${extractedTitle}" 노트가 ${folder} 폴더에 생성되었습니다.`,
      };
    } catch (error) {
      console.error("[createNote] Error:", error);
      return {
        success: false,
        message: `노트 생성 중 오류가 발생했습니다: ${error}`,
      };
    }
  },
});
