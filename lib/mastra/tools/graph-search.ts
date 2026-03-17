/**
 * Graph RAG 검색 Tool
 * 벡터 유사도 검색 + 위키링크 그래프 탐색을 결합한 검색
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { searchByEmbedding } from "@/lib/mastra/embedding";
import { graphCache } from "@/lib/graph-cache";
import type { DigitalGardenNode } from "@/types";

export const graphSearchTool = createTool({
  id: "graph-search",
  description:
    "위키링크 그래프를 활용한 의미 기반 문서 검색. 검색된 문서와 위키링크로 연결된 관련 문서까지 함께 반환합니다. 문서의 내용이나 주제에 대해 질문할 때 사용하세요.",
  inputSchema: z.object({
    query: z.string().describe("검색할 내용 (자연어)"),
    topK: z.number().optional().default(3).describe("직접 관련 문서 수"),
    depth: z
      .number()
      .optional()
      .default(1)
      .describe("위키링크 탐색 깊이 (1=직접 연결, 2=2단계까지)"),
    folder: z.string().optional().describe("특정 폴더에서만 검색"),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        title: z.string(),
        folder: z.string(),
        snippet: z.string(),
        score: z.number(),
        source: z.enum(["direct", "graph"]), // direct=벡터검색 결과, graph=위키링크 확장
      })
    ),
    total: z.number(),
    message: z.string(),
  }),
  execute: async ({ query, topK = 3, depth = 1, folder }) => {
    try {
      // 1. 벡터 유사도 검색
      const directResults = await searchByEmbedding(query, topK, folder);

      if (directResults.length === 0) {
        return {
          results: [],
          total: 0,
          message: `"${query}"와 관련된 문서를 찾지 못했습니다.`,
        };
      }

      // 2. graphCache 초기화
      await graphCache.initialize();

      // 3. 직접 결과의 위키링크 이웃 수집
      const seen = new Set<string>(); // normalized title
      const allResults: Array<{
        title: string;
        folder: string;
        snippet: string;
        score: number;
        source: "direct" | "graph";
      }> = [];

      // 직접 검색 결과 추가
      for (const r of directResults) {
        const key = r.title.normalize("NFC").toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          allResults.push({
            title: r.title,
            folder: r.folder,
            snippet: r.text.slice(0, 200) + (r.text.length > 200 ? "..." : ""),
            score: r.score,
            source: "direct",
          });
        }
      }

      // 4. 위키링크 이웃 탐색 (depth만큼)
      let currentTitles = directResults.map((r) => r.title);

      for (let d = 0; d < depth; d++) {
        const neighborTitles: string[] = [];

        // getGraph()를 통해 그래프 데이터 접근
        const graph = await graphCache.getGraph();
        const nodes = graph.nodes as { [url: string]: DigitalGardenNode };

        for (const title of currentTitles) {
          const encodedUrl = `/${encodeURIComponent(title)}`;
          const node = nodes[encodedUrl];

          if (node && node.neighbors) {
            for (const neighborUrl of node.neighbors) {
              // URL에서 제목 추출 ("/" 제거 후 디코딩)
              const neighborTitle = decodeURIComponent(neighborUrl.slice(1));
              const key = neighborTitle.normalize("NFC").toLowerCase();

              if (!seen.has(key)) {
                seen.add(key);
                neighborTitles.push(neighborTitle);
              }
            }
          }
        }

        // 이웃 문서들의 스니펫을 벡터 검색으로 가져오기
        if (neighborTitles.length > 0) {
          for (const nTitle of neighborTitles) {
            try {
              const neighborResults = await searchByEmbedding(nTitle, 1);
              const match = neighborResults.find(
                (r) =>
                  r.title.normalize("NFC").toLowerCase() ===
                  nTitle.normalize("NFC").toLowerCase()
              );

              if (match) {
                allResults.push({
                  title: match.title,
                  folder: match.folder,
                  snippet:
                    match.text.slice(0, 200) +
                    (match.text.length > 200 ? "..." : ""),
                  score: match.score * 0.8, // 그래프 확장은 약간 낮은 점수
                  source: "graph",
                });
              } else if (neighborResults.length > 0) {
                // 정확한 제목 매칭이 안 되면 첫 번째 결과 사용
                allResults.push({
                  title: nTitle,
                  folder: neighborResults[0].folder,
                  snippet:
                    neighborResults[0].text.slice(0, 200) +
                    (neighborResults[0].text.length > 200 ? "..." : ""),
                  score: neighborResults[0].score * 0.7,
                  source: "graph",
                });
              }
            } catch {
              // 개별 이웃 검색 실패는 무시
            }
          }
        }

        currentTitles = neighborTitles;
      }

      // 5. 점수순 정렬
      allResults.sort((a, b) => b.score - a.score);

      const directCount = allResults.filter((r) => r.source === "direct").length;
      const graphCount = allResults.filter((r) => r.source === "graph").length;

      return {
        results: allResults,
        total: allResults.length,
        message: `"${query}"로 ${directCount}개 직접 관련 + ${graphCount}개 연결 문서를 찾았습니다.`,
      };
    } catch (error) {
      console.error("[graphSearch] Error:", error);
      return {
        results: [],
        total: 0,
        message: `검색 중 오류가 발생했습니다: ${error}`,
      };
    }
  },
});
