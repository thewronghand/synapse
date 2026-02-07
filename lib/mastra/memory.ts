import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import path from "path";
import { getSynapseRootDir } from "@/lib/notes-path";

// Mastra 데이터 저장 경로
function getMastraDataDir(): string {
  return path.join(getSynapseRootDir(), ".synapse", "mastra");
}

// Memory 인스턴스 생성 (lazy initialization)
let memoryInstance: Memory | null = null;

export function getMemory(): Memory {
  if (memoryInstance) {
    return memoryInstance;
  }

  const dataDir = getMastraDataDir();

  memoryInstance = new Memory({
    // 메시지 저장소 (LibSQL)
    storage: new LibSQLStore({
      id: "synapse-memory",
      url: `file:${path.join(dataDir, "memory.db")}`,
    }),

    // 벡터 저장소 (Phase 3에서 활성화 예정)
    // vector: new LibSQLVector({
    //   url: `file:${path.join(dataDir, "vector.db")}`,
    // }),

    // 임베딩 모델 (Phase 3에서 설정)
    // embedder: ...

    options: {
      // 최근 메시지 개수
      lastMessages: 20,

      // Observational Memory: 대화에서 사실 추출 및 장기 기억
      // Claude의 Memory/Compact와 유사
      // TODO: Phase 2에서 활성화 - 모델 연동 필요
      // observationalMemory: true,

      // Semantic Recall: 벡터 기반 과거 대화 검색 (Phase 3)
      // semanticRecall: {
      //   topK: 3,
      //   messageRange: 2,
      //   scope: "resource",
      // },

      // Working Memory: 세션 간 지속되는 사용자 정보
      workingMemory: {
        enabled: true,
        scope: "resource",
        template: `# 사용자 정보
- **이름**:
- **관심사**:
- **작업 중인 주제**:
- **선호하는 응답 스타일**:
`,
      },
    },
  });

  return memoryInstance;
}

// 테스트/개발용: 메모리 인스턴스 초기화
export function resetMemory(): void {
  memoryInstance = null;
}

// Working Memory 조회
export async function getWorkingMemory(
  resourceId: string
): Promise<string | null> {
  const memory = getMemory();
  // resource-scoped working memory는 threadId 없이 resourceId만으로 조회
  // 임의의 threadId를 사용하되 resource 범위의 메모리를 가져옴
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
  const memory = getMemory();
  await memory.updateWorkingMemory({
    threadId: `resource-${resourceId}`,
    resourceId,
    workingMemory: content,
  });
}

// Working Memory 리셋 (빈 문자열로 초기화)
export async function resetWorkingMemory(resourceId: string): Promise<void> {
  const memory = getMemory();
  await memory.updateWorkingMemory({
    threadId: `resource-${resourceId}`,
    resourceId,
    workingMemory: "",
  });
}

// Working Memory 템플릿 조회
export function getWorkingMemoryTemplate(): string {
  return `# 사용자 정보
- **이름**:
- **관심사**:
- **작업 중인 주제**:
- **선호하는 응답 스타일**:
`;
}
