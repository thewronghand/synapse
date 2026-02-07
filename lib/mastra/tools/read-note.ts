import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import fs from "fs/promises";
import fss from "fs";
import path from "path";
import {
  parseFrontmatter,
  extractTitle,
  extractWikiLinks,
  getTitleFromFilename,
  titlesMatch,
} from "@/lib/document-parser";
import { getNotesDir } from "@/lib/notes-path";
import { documentCache } from "@/lib/document-cache";

const NOTES_DIR = getNotesDir();

/**
 * readNote Tool
 * 특정 문서의 내용을 읽습니다.
 */
export const readNoteTool = createTool({
  id: "read-note",
  description:
    "특정 노트의 내용을 읽습니다. 제목으로 노트를 찾아 전체 내용을 반환합니다.",
  inputSchema: z.object({
    title: z.string().describe("읽을 노트의 제목"),
    folder: z
      .string()
      .optional()
      .describe("노트가 있는 폴더명 (생략하면 전체 폴더에서 검색)"),
  }),
  outputSchema: z.object({
    found: z.boolean(),
    title: z.string().optional(),
    folder: z.string().optional(),
    content: z.string().optional(),
    tags: z.array(z.string()).optional(),
    links: z.array(z.string()).optional(),
    updatedAt: z.string().optional(),
    message: z.string(),
  }),
  execute: async ({ title, folder: targetFolder }) => {
    try {
      const requestedTitle = title.normalize("NFC");

      // 특정 폴더가 지정된 경우 해당 폴더만 검색
      if (targetFolder) {
        const folderPath = path.join(NOTES_DIR, targetFolder);
        if (!fss.existsSync(folderPath)) {
          return {
            found: false,
            message: `"${targetFolder}" 폴더를 찾을 수 없습니다.`,
          };
        }

        const files = await fs.readdir(folderPath);
        const markdownFiles = files.filter((f) => f.endsWith(".md"));

        for (const file of markdownFiles) {
          const filePath = path.join(folderPath, file);
          const content = await fs.readFile(filePath, "utf-8");
          const { frontmatter, contentWithoutFrontmatter } =
            parseFrontmatter(content);
          const filenameTitle = getTitleFromFilename(file);
          const docTitle =
            extractTitle(contentWithoutFrontmatter, frontmatter) ||
            filenameTitle;

          if (titlesMatch(docTitle, requestedTitle)) {
            const stats = await fs.stat(filePath);
            const links = extractWikiLinks(content);

            return {
              found: true,
              title: docTitle,
              folder: targetFolder,
              content: contentWithoutFrontmatter,
              tags: frontmatter.tags || [],
              links,
              updatedAt: stats.mtime.toISOString(),
              message: `"${docTitle}" 노트를 ${targetFolder} 폴더에서 찾았습니다.`,
            };
          }
        }

        return {
          found: false,
          message: `"${title}" 노트를 ${targetFolder} 폴더에서 찾을 수 없습니다.`,
        };
      }

      // 폴더 미지정: 캐시에서 먼저 찾기
      const cached = documentCache.getByTitle(requestedTitle);
      if (cached && cached.folder) {
        const filePath = path.join(NOTES_DIR, cached.folder, cached.filename);
        if (fss.existsSync(filePath)) {
          const content = await fs.readFile(filePath, "utf-8");
          const stats = await fs.stat(filePath);
          const { frontmatter, contentWithoutFrontmatter } =
            parseFrontmatter(content);
          const links = extractWikiLinks(content);

          return {
            found: true,
            title: cached.title,
            folder: cached.folder,
            content: contentWithoutFrontmatter,
            tags: frontmatter.tags || [],
            links,
            updatedAt: stats.mtime.toISOString(),
            message: `"${cached.title}" 노트를 찾았습니다 (${cached.folder} 폴더).`,
          };
        }
      }

      // 캐시에 없으면 전체 폴더 스캔
      const entries = await fs.readdir(NOTES_DIR, { withFileTypes: true });
      const folders = entries.filter(
        (e) => e.isDirectory() && e.name !== ".trash"
      );

      for (const folder of folders) {
        const folderPath = path.join(NOTES_DIR, folder.name);
        const files = await fs.readdir(folderPath);
        const markdownFiles = files.filter((f) => f.endsWith(".md"));

        for (const file of markdownFiles) {
          const filePath = path.join(folderPath, file);
          const content = await fs.readFile(filePath, "utf-8");
          const { frontmatter, contentWithoutFrontmatter } =
            parseFrontmatter(content);
          const filenameTitle = getTitleFromFilename(file);
          const docTitle =
            extractTitle(contentWithoutFrontmatter, frontmatter) ||
            filenameTitle;

          if (titlesMatch(docTitle, requestedTitle)) {
            const stats = await fs.stat(filePath);
            const links = extractWikiLinks(content);

            return {
              found: true,
              title: docTitle,
              folder: folder.name,
              content: contentWithoutFrontmatter,
              tags: frontmatter.tags || [],
              links,
              updatedAt: stats.mtime.toISOString(),
              message: `"${docTitle}" 노트를 찾았습니다 (${folder.name} 폴더).`,
            };
          }
        }
      }

      return {
        found: false,
        message: `"${title}" 노트를 찾을 수 없습니다.`,
      };
    } catch (error) {
      console.error("[readNote] Error:", error);
      return {
        found: false,
        message: `노트 읽기 중 오류가 발생했습니다: ${error}`,
      };
    }
  },
});
