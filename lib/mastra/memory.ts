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

    options: {
      // 최근 메시지 개수
      lastMessages: 20,

      // Observational Memory: 대화에서 사실 추출 및 장기 기억
      // Claude의 Memory/Compact와 유사
      observationalMemory: {
        model: "google/gemini-2.5-flash",
        scope: "resource",
        observation: {
          messageTokens: 50_000,
        },
        reflection: {
          observationTokens: 60_000,
        },
      },

      // Working Memory: 세션 간 지속되는 사용자 정보
      workingMemory: {
        enabled: true,
        scope: "resource",
        template: `# 사용자 프로필
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
  return `# 사용자 프로필
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
}
