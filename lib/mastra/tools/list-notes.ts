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

interface NoteListItem {
  title: string;
  folder: string;
  tags: string[];
  updatedAt: string;
}

/**
 * listNotes Tool
 * 문서 목록을 조회합니다.
 */
export const listNotesTool = createTool({
  id: "list-notes",
  description:
    "노트 목록을 조회합니다. 폴더별로 필터링하거나 전체 목록을 가져올 수 있습니다.",
  inputSchema: z.object({
    folder: z
      .string()
      .optional()
      .describe("특정 폴더의 노트만 조회 (생략하면 전체 조회)"),
    limit: z
      .number()
      .optional()
      .default(50)
      .describe("최대 조회 개수 (기본값: 50)"),
  }),
  outputSchema: z.object({
    notes: z.array(
      z.object({
        title: z.string(),
        folder: z.string(),
        tags: z.array(z.string()),
        updatedAt: z.string(),
      })
    ),
    total: z.number(),
    message: z.string(),
  }),
  execute: async ({ folder, limit = 50 }) => {
    try {
      const notes: NoteListItem[] = [];
      const entries = await fs.readdir(NOTES_DIR, { withFileTypes: true });
      const folders = entries.filter((e) => e.isDirectory());

      for (const folderEntry of folders) {
        // .trash 폴더 제외
        if (folderEntry.name === ".trash") continue;
        // 폴더 필터링
        if (folder && folderEntry.name !== folder) continue;

        const folderPath = path.join(NOTES_DIR, folderEntry.name);
        const files = await fs.readdir(folderPath);
        const markdownFiles = files.filter((f) => f.endsWith(".md"));

        for (const file of markdownFiles) {
          if (notes.length >= limit) break;

          const filePath = path.join(folderPath, file);
          const content = await fs.readFile(filePath, "utf-8");
          const stats = await fs.stat(filePath);
          const { frontmatter, contentWithoutFrontmatter } =
            parseFrontmatter(content);
          const filenameTitle = getTitleFromFilename(file);
          const title =
            extractTitle(contentWithoutFrontmatter, frontmatter) ||
            filenameTitle;

          notes.push({
            title,
            folder: folderEntry.name,
            tags: frontmatter.tags || [],
            updatedAt: stats.mtime.toISOString(),
          });
        }

        if (notes.length >= limit) break;
      }

      // 최신순 정렬
      notes.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

      const folderMsg = folder ? `${folder} 폴더의` : "전체";
      return {
        notes: notes.slice(0, limit),
        total: notes.length,
        message: `${folderMsg} 노트 ${notes.length}개를 찾았습니다.`,
      };
    } catch (error) {
      console.error("[listNotes] Error:", error);
      return {
        notes: [],
        total: 0,
        message: `노트 목록 조회 중 오류가 발생했습니다: ${error}`,
      };
    }
  },
});
