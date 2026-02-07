import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import {
  parseFrontmatter,
  extractTitle,
  getTitleFromFilename,
} from "@/lib/document-parser";
import { getNotesDir } from "@/lib/notes-path";

const NOTES_DIR = getNotesDir();

interface SearchResultItem {
  title: string;
  folder: string;
  snippet: string;
  tags: string[];
}

/**
 * searchNotes Tool
 * 문서 내용을 검색합니다.
 */
export const searchNotesTool = createTool({
  id: "search-notes",
  description:
    "노트 내용을 검색합니다. 키워드로 노트를 찾고 매칭되는 부분을 스니펫으로 반환합니다.",
  inputSchema: z.object({
    query: z.string().describe("검색할 키워드"),
    folder: z
      .string()
      .optional()
      .describe("특정 폴더에서만 검색 (생략하면 전체 검색)"),
    limit: z
      .number()
      .optional()
      .default(10)
      .describe("최대 결과 개수 (기본값: 10)"),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        title: z.string(),
        folder: z.string(),
        snippet: z.string(),
        tags: z.array(z.string()),
      })
    ),
    total: z.number(),
    message: z.string(),
  }),
  execute: async ({ query, folder, limit = 10 }) => {
    try {
      if (!query || query.trim().length === 0) {
        return {
          results: [],
          total: 0,
          message: "검색어를 입력해주세요.",
        };
      }

      const results: SearchResultItem[] = [];
      const lowerQuery = query.toLowerCase();
      const entries = await fs.readdir(NOTES_DIR, { withFileTypes: true });
      const folders = entries.filter(
        (e) => e.isDirectory() && e.name !== ".trash"
      );

      for (const folderEntry of folders) {
        if (folder && folderEntry.name !== folder) continue;
        if (results.length >= limit) break;

        const folderPath = path.join(NOTES_DIR, folderEntry.name);
        const files = await fs.readdir(folderPath);
        const markdownFiles = files.filter((f) => f.endsWith(".md"));

        for (const file of markdownFiles) {
          if (results.length >= limit) break;

          const filePath = path.join(folderPath, file);
          const content = await fs.readFile(filePath, "utf-8");
          const { frontmatter, contentWithoutFrontmatter } =
            parseFrontmatter(content);
          const filenameTitle = getTitleFromFilename(file);
          const title =
            extractTitle(contentWithoutFrontmatter, frontmatter) ||
            filenameTitle;

          const lowerContent = contentWithoutFrontmatter.toLowerCase();
          const matchIndex = lowerContent.indexOf(lowerQuery);

          if (matchIndex !== -1) {
            const snippet = extractSnippet(
              contentWithoutFrontmatter,
              matchIndex,
              query.length
            );
            results.push({
              title,
              folder: folderEntry.name,
              snippet,
              tags: frontmatter.tags || [],
            });
          }
        }
      }

      return {
        results,
        total: results.length,
        message:
          results.length > 0
            ? `"${query}"로 ${results.length}개의 노트를 찾았습니다.`
            : `"${query}"에 해당하는 노트를 찾지 못했습니다.`,
      };
    } catch (error) {
      console.error("[searchNotes] Error:", error);
      return {
        results: [],
        total: 0,
        message: `검색 중 오류가 발생했습니다: ${error}`,
      };
    }
  },
});

/**
 * 매칭 부분 주변의 스니펫 추출
 */
function extractSnippet(
  content: string,
  matchIndex: number,
  queryLength: number,
  contextChars: number = 60
): string {
  const start = Math.max(0, matchIndex - contextChars);
  const end = Math.min(content.length, matchIndex + queryLength + contextChars);

  let snippet = content.slice(start, end);

  // 마크다운 문법 제거
  snippet = snippet
    .replace(/\n+/g, " ")
    .replace(/#{1,6}\s*/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .trim();

  const prefix = start > 0 ? "..." : "";
  const suffix = end < content.length ? "..." : "";

  return prefix + snippet + suffix;
}
