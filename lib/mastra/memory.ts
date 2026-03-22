import { Memory } from "@mastra/memory";
import { LibSQLStore, LibSQLVector } from "@mastra/libsql";
import { createVertex } from "@ai-sdk/google-vertex";
import path from "path";
import { getSynapseRootDir } from "@/lib/notes-path";
import { loadGcpServiceAccount } from "@/lib/gcp-service-account";

// Mastra 데이터 저장 경로
function getMastraDataDir(): string {
  return path.join(getSynapseRootDir(), ".synapse", "mastra");
}

const WORKING_MEMORY_TEMPLATE = `# 사용자 프로필
- **이름**:
- **직업/역할**:
- **기술 수준**: (초급/중급/고급)

# 관심사 및 프로젝트
- **주요 관심 분야**:
- **진행 중인 프로젝트**:
- **자주 다루는 주제**:

# 선호도
- **응답 스타일**: (간결/상세/코드 중심)
- **언어 선호**: (한국어/영어/혼합)
- **기술 설명 수준**: (비유 사용/기술적 정확도 우선)

# 중요 컨텍스트
- **반복적으로 언급된 사항**:
- **특별 요청사항**:
`;

// Memory 인스턴스 (하나만 유지)
let memoryInstance: Memory | null = null;
let memoryInitPromise: Promise<Memory> | null = null;

// Memory 생성 (비동기 — SA가 있으면 Semantic Recall 포함)
async function createMemoryInstance(): Promise<Memory> {
  const dataDir = getMastraDataDir();
  const dbUrl = `file:${path.join(dataDir, "memory.db")}`;

  const sa = await loadGcpServiceAccount();

  // SA가 있으면 Vertex AI 모델을 사용한 풀 기능 Memory
  if (sa) {
    const vertex = createVertex({
      project: sa.project_id,
      location: "us-central1",
      googleAuthOptions: {
        credentials: {
          client_email: sa.client_email,
          private_key: sa.private_key,
        },
      },
    });

    return new Memory({
      storage: new LibSQLStore({
        id: "synapse-memory",
        url: dbUrl,
      }),
      vector: new LibSQLVector({
        id: "synapse-memory-vector",
        url: dbUrl,
      }),
      embedder: vertex.embeddingModel("text-embedding-004"),

      options: {
        lastMessages: 20,

        semanticRecall: {
          topK: 3,
          messageRange: 2,
          scope: "resource",
        },

        observationalMemory: {
          model: vertex("gemini-2.5-flash"),
          scope: "resource",
          observation: {
            messageTokens: 50_000,
          },
          reflection: {
            observationTokens: 60_000,
          },
        },

        workingMemory: {
          enabled: true,
          scope: "resource",
          template: WORKING_MEMORY_TEMPLATE,
        },
      },
    });
  }

  // SA 없으면 기본 Memory (Semantic Recall, Observational Memory 없이)
  return new Memory({
    storage: new LibSQLStore({
      id: "synapse-memory",
      url: dbUrl,
    }),

    options: {
      lastMessages: 20,

      workingMemory: {
        enabled: true,
        scope: "resource",
        template: WORKING_MEMORY_TEMPLATE,
      },
    },
  });
}

// Memory 가져오기 (비동기, 한번만 생성)
export async function getMemory(): Promise<Memory> {
  if (memoryInstance) return memoryInstance;

  if (!memoryInitPromise) {
    memoryInitPromise = createMemoryInstance().then((m) => {
      memoryInstance = m;
      memoryInitPromise = null;
      return m;
    });
  }

  return memoryInitPromise;
}

// 테스트/개발용: 메모리 인스턴스 초기화
export function resetMemory(): void {
  memoryInstance = null;
  memoryInitPromise = null;
}

// Working Memory 조회
export async function getWorkingMemory(
  resourceId: string
): Promise<string | null> {
  const memory = await getMemory();
  const result = await memory.getWorkingMemory({
    threadId: `resource-${resourceId}`,
    resourceId,
  });
  return result;
}

// Working Memory 수정
export async function updateWorkingMemory(
  resourceId: string,
  content: string
): Promise<void> {
  const memory = await getMemory();
  await memory.updateWorkingMemory({
    threadId: `resource-${resourceId}`,
    resourceId,
    workingMemory: content,
  });
}

// Working Memory 리셋 (빈 문자열로 초기화)
export async function resetWorkingMemory(resourceId: string): Promise<void> {
  const memory = await getMemory();
  await memory.updateWorkingMemory({
    threadId: `resource-${resourceId}`,
    resourceId,
    workingMemory: "",
  });
}

// Working Memory 템플릿 조회
export function getWorkingMemoryTemplate(): string {
  return WORKING_MEMORY_TEMPLATE;
}
