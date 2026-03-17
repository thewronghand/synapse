import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import {
  parseFrontmatter,
  extractTitle,
  getTitleFromFilename,
} from "@/lib/document-parser";
import { getNotesDir } from "@/lib/notes-path";
import { embedDocument } from "@/lib/mastra/embedding";
import { initVectorIndex, getVectorStore, INDEX_NAME, resetVectorStore } from "@/lib/mastra/vector-store";

const NOTES_DIR = getNotesDir();

/**
 * POST /api/settings/embeddings
 * 전체 문서 일괄 임베딩 (재동기화)
 */
export async function POST() {
  try {
    await initVectorIndex();

    // 기존 인덱스 삭제 후 재생성
    const store = getVectorStore();
    try {
      await store.deleteIndex({ indexName: INDEX_NAME });
    } catch {
      // 인덱스가 없으면 무시
    }
    resetVectorStore();
    await initVectorIndex();

    const entries = await fs.readdir(NOTES_DIR, { withFileTypes: true });
    const folders = entries.filter(
      (e) => e.isDirectory() && e.name !== ".trash"
    );

    let totalDocuments = 0;
    let totalChunks = 0;
    const errors: string[] = [];

    for (const folder of folders) {
      const folderPath = path.join(NOTES_DIR, folder.name);
      const files = await fs.readdir(folderPath);
      const markdownFiles = files.filter((f) => f.endsWith(".md"));

      for (const file of markdownFiles) {
        try {
          const filePath = path.join(folderPath, file);
          const content = await fs.readFile(filePath, "utf-8");
          const { frontmatter, contentWithoutFrontmatter } =
            parseFrontmatter(content);
          const filenameTitle = getTitleFromFilename(file);
          const title =
            extractTitle(contentWithoutFrontmatter, frontmatter) ||
            filenameTitle;

          await embedDocument(content, title, folder.name, file);
          totalDocuments++;
        } catch (err) {
          const errorMsg = `${folder.name}/${file}: ${err}`;
          console.error("[Embeddings Sync] 실패:", errorMsg);
          errors.push(errorMsg);
        }
      }
    }

    console.log(
      `[Embeddings Sync] 완료: ${totalDocuments}개 문서 임베딩`
    );

    return NextResponse.json({
      success: true,
      data: {
        totalDocuments,
        totalChunks,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error("[Embeddings Sync] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: `임베딩 동기화 실패: ${error}`,
      },
      { status: 500 }
    );
  }
}
