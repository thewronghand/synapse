import fs from "fs/promises";
import path from "path";

interface EmbeddingChunk {
  text: string;
  vector: number[];
  title: string;
  folder: string;
}

// 캐시된 임베딩 데이터
let cachedEmbeddings: EmbeddingChunk[] | null = null;

// 임베딩 데이터 로드 (JSON 파일에서)
async function loadEmbeddings(): Promise<EmbeddingChunk[]> {
  if (cachedEmbeddings) return cachedEmbeddings;

  const jsonPath = path.join(process.cwd(), "public", "data", "embeddings.json");
  const data = await fs.readFile(jsonPath, "utf-8");
  cachedEmbeddings = JSON.parse(data) as EmbeddingChunk[];
  return cachedEmbeddings;
}

// 코사인 유사도 계산
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

// 쿼리 벡터로 유사 청크 검색
export async function searchPublishedEmbeddings(
  queryVector: number[],
  topK: number = 5
): Promise<{ text: string; title: string; folder: string; score: number }[]> {
  const embeddings = await loadEmbeddings();

  // 모든 청크에 대해 유사도 계산
  const scored = embeddings.map((chunk) => ({
    text: chunk.text,
    title: chunk.title,
    folder: chunk.folder,
    score: cosineSimilarity(queryVector, chunk.vector),
  }));

  // 점수순 정렬 후 상위 N개 반환
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
