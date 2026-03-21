import { embed, embedMany } from "ai";
import { createVertex } from "@ai-sdk/google-vertex";
import { MDocument } from "@mastra/rag";
import {
  loadGcpServiceAccount,
  type GcpServiceAccountInfo,
} from "@/lib/gcp-service-account";
import {
  upsertChunks,
  deleteChunksByDocument,
  queryChunks,
  initVectorIndex,
} from "@/lib/mastra/vector-store";

const EMBEDDING_MODEL_ID = "text-embedding-004";

// 캐시된 SA
let cachedSa: GcpServiceAccountInfo | null = null;

// Vertex AI 임베딩 모델 생성
async function getEmbeddingModel() {
  if (!cachedSa) {
    cachedSa = await loadGcpServiceAccount();
  }

  if (!cachedSa) {
    throw new Error("GCP 서비스 어카운트가 설정되지 않았습니다.");
  }

  const vertex = createVertex({
    project: cachedSa.project_id,
    location: "us-central1",
    googleAuthOptions: {
      credentials: {
        client_email: cachedSa.client_email,
        private_key: cachedSa.private_key,
      },
    },
  });

  return vertex.embeddingModel(EMBEDDING_MODEL_ID);
}

// 마크다운 문서를 청크로 분리
async function chunkMarkdown(
  content: string
): Promise<{ text: string; metadata: Record<string, string> }[]> {
  const doc = MDocument.fromMarkdown(content);

  const chunks = await doc.chunk({
    strategy: "markdown",
    maxSize: 512,
    overlap: 50,
  });

  // 짧은 청크 필터 (헤딩만 있는 등 의미 없는 청크 제외)
  const MIN_CHUNK_LENGTH = 20;

  return chunks
    .map((chunk) => ({
      text: typeof chunk === "string" ? chunk : chunk.text,
      metadata:
        typeof chunk === "string" ? {} : (chunk.metadata as Record<string, string>) || {},
    }))
    .filter((chunk) => chunk.text.trim().length >= MIN_CHUNK_LENGTH);
}

// 문서 임베딩 생성 및 저장
export async function embedDocument(
  content: string,
  title: string,
  folder: string,
  filename: string
): Promise<void> {
  // 인덱스 초기화 확인
  await initVectorIndex();

  const model = await getEmbeddingModel();

  // 청킹
  const chunks = await chunkMarkdown(content);

  if (chunks.length === 0) {
    console.log(`[Embedding] 빈 문서 스킵: ${title}`);
    return;
  }

  // 임베딩 생성
  const { embeddings } = await embedMany({
    model,
    values: chunks.map((c) => c.text),
  });

  // 메타데이터 구성
  const documentPath = `${folder}/${filename}`;
  const metadata = chunks.map((chunk, i) => ({
    text: chunk.text,
    title,
    folder,
    filename,
    documentPath,
    chunkIndex: String(i),
  }));

  // 벡터 저장
  await upsertChunks(embeddings, metadata);

  console.log(
    `[Embedding] 저장 완료: ${title} (${chunks.length}개 청크)`
  );
}

// 문서 임베딩 업데이트 (기존 삭제 후 재생성)
export async function updateDocumentEmbedding(
  content: string,
  title: string,
  folder: string,
  filename: string
): Promise<void> {
  await deleteChunksByDocument(folder, filename);
  await embedDocument(content, title, folder, filename);
}

// 문서 임베딩 삭제
export async function deleteDocumentEmbedding(
  folder: string,
  filename: string
): Promise<void> {
  await initVectorIndex();
  await deleteChunksByDocument(folder, filename);
}

// 쿼리 텍스트로 유사 문서 검색
export async function searchByEmbedding(
  query: string,
  topK: number = 5,
  folder?: string
): Promise<
  {
    text: string;
    title: string;
    folder: string;
    score: number;
  }[]
> {
  await initVectorIndex();

  const model = await getEmbeddingModel();

  // 쿼리 임베딩 생성
  const { embedding } = await embed({
    model,
    value: query,
  });

  // 필터 설정
  const filter = folder ? { folder } : undefined;

  // 벡터 검색
  const results = await queryChunks(embedding, topK, filter);

  return results.map((r) => ({
    text: r.metadata?.text || "",
    title: r.metadata?.title || "",
    folder: r.metadata?.folder || "",
    score: r.score,
  }));
}

// 문서 목록을 임베딩하여 JSON export용 데이터 생성
export async function generateEmbeddingsForExport(
  documents: { title: string; folder: string; content: string }[]
): Promise<
  {
    text: string;
    vector: number[];
    title: string;
    folder: string;
  }[]
> {
  const model = await getEmbeddingModel();
  const allChunks: {
    text: string;
    vector: number[];
    title: string;
    folder: string;
  }[] = [];

  for (const doc of documents) {
    const chunks = await chunkMarkdown(doc.content);
    if (chunks.length === 0) continue;

    const { embeddings } = await embedMany({
      model,
      values: chunks.map((c) => c.text),
    });

    for (let i = 0; i < chunks.length; i++) {
      allChunks.push({
        text: chunks[i].text,
        vector: embeddings[i],
        title: doc.title,
        folder: doc.folder,
      });
    }
  }

  return allChunks;
}

// SA 캐시 초기화
export function clearEmbeddingCache(): void {
  cachedSa = null;
}
