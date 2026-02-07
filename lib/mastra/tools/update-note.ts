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
  sanitizeFilename,
} from "@/lib/document-parser";
import { getNotesDir } from "@/lib/notes-path";
import { documentCache } from "@/lib/document-cache";
import { tagCache } from "@/lib/tag-cache";
import { graphCache } from "@/lib/graph-cache";

const NOTES_DIR = getNotesDir();

/**
 * updateNote Tool
 * 기존 문서를 수정합니다.
 */
export const updateNoteTool = createTool({
  id: "update-note",
  description:
    "기존 노트를 수정합니다. 내용을 변경하거나 제목을 바꿀 수 있습니다.",
  inputSchema: z.object({
    title: z.string().describe("수정할 노트의 현재 제목"),
    folder: z
      .string()
      .optional()
      .describe("노트가 있는 폴더명 (생략하면 전체 폴더에서 검색)"),
    content: z.string().optional().describe("새로운 내용 (마크다운 형식)"),
    newTitle: z.string().optional().describe("새로운 제목 (변경할 경우)"),
    appendContent: z
      .string()
      .optional()
      .describe("기존 내용 끝에 추가할 텍스트"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    title: z.string().optional(),
    folder: z.string().optional(),
    message: z.string(),
  }),
  execute: async ({ title, folder: targetFolder, content, newTitle, appendContent }) => {
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

      const { filePath, folder, filename, currentTitle, currentContent } = found;

      // 새 내용 결정
      let finalContent: string;
      if (content !== undefined) {
        // 전체 내용 교체
        finalContent = content;
      } else if (appendContent !== undefined) {
        // 기존 내용에 추가
        const { contentWithoutFrontmatter } = parseFrontmatter(currentContent);
        finalContent = currentContent.replace(
          contentWithoutFrontmatter,
          contentWithoutFrontmatter + "\n\n" + appendContent
        );
      } else {
        finalContent = currentContent;
      }

      // 제목 변경 처리
      const finalTitle = newTitle?.normalize("NFC").trim() || currentTitle;
      const titleChanged = !titlesMatch(currentTitle, finalTitle);

      if (titleChanged) {
        // 중복 체크
        if (documentCache.hasTitleInFolder(finalTitle, folder)) {
          const existingDoc = documentCache.getByTitle(finalTitle);
          if (existingDoc && existingDoc.filename !== filename) {
            return {
              success: false,
              message: `"${finalTitle}" 제목의 노트가 이미 ${folder} 폴더에 존재합니다.`,
            };
          }
        }

        // 새 파일명 생성
        const newSafeFilename = sanitizeFilename(finalTitle);
        const newFilename = `${newSafeFilename}.md`;
        const newFilePath = path.join(NOTES_DIR, folder, newFilename);

        // 파일명 충돌 확인
        if (newFilename !== filename && fss.existsSync(newFilePath)) {
          return {
            success: false,
            message: `동일한 파일명의 노트가 이미 존재합니다: ${newFilename}`,
          };
        }

        // 파일 이름 변경
        if (newFilename !== filename) {
          await fs.rename(filePath, newFilePath);
        }

        // 내용 저장
        await fs.writeFile(newFilePath, finalContent, "utf-8");

        // 캐시 업데이트
        documentCache.updateDocument(currentTitle, finalTitle, newFilename, folder);
        graphCache.renameDocument(currentTitle, finalTitle, newFilename, finalContent);

        console.log(`[updateNote] Renamed: ${currentTitle} -> ${finalTitle}`);
      } else {
        // 내용만 업데이트
        await fs.writeFile(filePath, finalContent, "utf-8");

        documentCache.updateDocument(currentTitle, currentTitle, filename, folder);
        await graphCache.updateDocument(currentTitle, filename, finalContent);

        console.log(`[updateNote] Updated: ${currentTitle}`);
      }

      // 태그 캐시 업데이트
      const { frontmatter } = parseFrontmatter(finalContent);
      if (frontmatter.tags && Array.isArray(frontmatter.tags)) {
        tagCache.addTags(frontmatter.tags);
      }

      return {
        success: true,
        title: finalTitle,
        folder,
        message: titleChanged
          ? `노트 제목이 "${currentTitle}"에서 "${finalTitle}"로 변경되었습니다.`
          : `"${finalTitle}" 노트가 업데이트되었습니다.`,
      };
    } catch (error) {
      console.error("[updateNote] Error:", error);
      return {
        success: false,
        message: `노트 수정 중 오류가 발생했습니다: ${error}`,
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
  currentContent: string;
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
          currentContent: content,
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
      const content = await fs.readFile(filePath, "utf-8");
      return {
        filePath,
        folder: cached.folder,
        filename: cached.filename,
        currentTitle: cached.title,
        currentContent: content,
      };
    }
  }

  // 전체 폴더 스캔
  const entries = await fs.readdir(NOTES_DIR, { withFileTypes: true });
  const folders = entries.filter((e) => e.isDirectory() && e.name !== ".trash");

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
          currentContent: content,
        };
      }
    }
  }

  return null;
}
