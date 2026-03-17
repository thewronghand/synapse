import { LibSQLVector } from "@mastra/libsql";
import path from "path";
import { getSynapseRootDir } from "@/lib/notes-path";

// 벡터 스토어 인스턴스 (lazy initialization)
let vectorStoreInstance: LibSQLVector | null = null;

const INDEX_NAME = "document_chunks";
const EMBEDDING_DIMENSION = 768; // text-embedding-004 기본 차원

function getVectorDbUrl(): string {
  const dataDir = path.join(getSynapseRootDir(), ".synapse", "mastra");
  return `file:${path.join(dataDir, "vector.db")}`;
}

export function getVectorStore(): LibSQLVector {
  if (vectorStoreInstance) {
    return vectorStoreInstance;
  }

  vectorStoreInstance = new LibSQLVector({
    url: getVectorDbUrl(),
    id: "synapse-vector",
  });

  return vectorStoreInstance;
}

// 벡터 인덱스 초기화 (앱 시작 시 1회 호출)
let indexInitialized = false;

export async function initVectorIndex(): Promise<void> {
  if (indexInitialized) return;

  const store = getVectorStore();

  await store.createIndex({
    indexName: INDEX_NAME,
    dimension: EMBEDDING_DIMENSION,
  });

  indexInitialized = true;
  console.log("[VectorStore] 인덱스 초기화 완료");
}

// 벡터 저장 (문서 임베딩 결과)
export async function upsertChunks(
  vectors: number[][],
  metadata: Record<string, string>[]
): Promise<string[]> {
  const store = getVectorStore();

  return store.upsert({
    indexName: INDEX_NAME,
    vectors,
    metadata,
  });
}

// 벡터 유사도 검색
export async function queryChunks(
  queryVector: number[],
  topK: number = 5,
  filter?: Record<string, string>
) {
  const store = getVectorStore();

  return store.query({
    indexName: INDEX_NAME,
    queryVector,
    topK,
    filter: filter as Record<string, string> | undefined,
  });
}

// 특정 문서의 청크 삭제 (문서 경로 기준)
export async function deleteChunksByDocument(
  folder: string,
  filename: string
): Promise<void> {
  const store = getVectorStore();
  const documentPath = `${folder}/${filename}`;

  await store.deleteVectors({
    indexName: INDEX_NAME,
    filter: { documentPath },
  });

  console.log(`[VectorStore] 청크 삭제: ${documentPath}`);
}

// 벡터 스토어 초기화 (테스트/개발용)
export function resetVectorStore(): void {
  vectorStoreInstance = null;
  indexInitialized = false;
}

export { INDEX_NAME, EMBEDDING_DIMENSION };
