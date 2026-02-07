import { Agent } from "@mastra/core/agent";
import { TokenLimiterProcessor } from "@mastra/core/processors";
import { createVertex } from "@ai-sdk/google-vertex";
import { getMemory } from "@/lib/mastra/memory";
import {
  loadGcpServiceAccount,
  type GcpServiceAccountInfo,
} from "@/lib/gcp-service-account";
import { loadAIModelSettings } from "@/lib/ai-model-settings";
import { buildNeuroInstructions, NEURO_BASE_INSTRUCTIONS } from "@/lib/neuro-prompt";

// 캐시된 SA 정보
let cachedSa: GcpServiceAccountInfo | null = null;

// 캐시된 Agent (성능 최적화)
let cachedAgent: Agent | null = null;

// Vertex AI 모델 생성 (동적)
async function createVertexModel() {
  // SA 로드 (캐시 활용)
  if (!cachedSa) {
    cachedSa = await loadGcpServiceAccount();
  }

  if (!cachedSa) {
    throw new Error("GCP 서비스 어카운트가 설정되지 않았습니다.");
  }

  // 모델 설정 로드
  const aiSettings = await loadAIModelSettings();

  // Gemini 3 모델은 global 리전 필요
  const isGemini3 = aiSettings.modelId.startsWith("gemini-3");
  const location = isGemini3 ? "global" : "us-central1";

  const vertex = createVertex({
    project: cachedSa.project_id,
    location,
    googleAuthOptions: {
      credentials: {
        client_email: cachedSa.client_email,
        private_key: cachedSa.private_key,
      },
    },
  });

  return vertex(aiSettings.modelId);
}

// Neuro Agent 생성 (내부용 - 항상 새로 생성)
async function createNeuroAgentInternal(): Promise<Agent> {
  console.log("[Neuro] createVertexModel 시작...");
  const model = await createVertexModel();
  console.log("[Neuro] createVertexModel 완료, Agent 생성 시작...");
  const memory = getMemory();

  // 외부 설정 파일에서 프롬프트 로드 (기본 + 커스텀 지시사항)
  const instructions = await buildNeuroInstructions();

  const agent = new Agent({
    id: "neuro",
    name: "Neuro",
    instructions,
    model,
    memory,
    // TokenLimiter: 컨텍스트 윈도우 초과 시 오래된 메시지 필터링
    // Gemini 2.0 Flash: 1M 토큰, 80% = 800,000 토큰
    inputProcessors: [new TokenLimiterProcessor(800000)],
    // Tools는 Phase 2에서 추가 예정
    // tools: { ... },
  });
  console.log("[Neuro] Agent 생성 완료");
  return agent;
}

// Neuro Agent 가져오기 (캐시 활용 - 권장)
// 첫 호출 시 생성, 이후 캐시된 Agent 반환
export async function getOrCreateNeuroAgent(): Promise<Agent> {
  if (!cachedAgent) {
    cachedAgent = await createNeuroAgentInternal();
  }
  return cachedAgent;
}

// Neuro Agent 생성 (하위 호환성 유지)
// @deprecated getOrCreateNeuroAgent() 사용 권장
export async function createNeuroAgent(): Promise<Agent> {
  return getOrCreateNeuroAgent();
}

// 기본 Agent (SA 없이 생성 - 나중에 모델 주입)
// Mastra 인스턴스 등록용 placeholder
export const neuroAgent = new Agent({
  id: "neuro",
  name: "Neuro",
  instructions: NEURO_BASE_INSTRUCTIONS,
  // model은 런타임에 동적으로 설정됨
  // 아래는 placeholder - 실제 사용 시 createNeuroAgent() 호출
  model: {
    specificationVersion: "v1",
    provider: "placeholder",
    modelId: "placeholder",
    defaultObjectGenerationMode: "json",
    async doGenerate() {
      throw new Error("Agent not initialized. Call createNeuroAgent() first.");
    },
    async doStream() {
      throw new Error("Agent not initialized. Call createNeuroAgent() first.");
    },
  },
});

// 캐시 초기화 (설정 변경 시 호출)
// SA, 모델, 프롬프트 설정이 바뀌면 Agent를 다시 생성해야 함
export function clearNeuroCache(): void {
  cachedSa = null;
  cachedAgent = null;
  console.log("[Neuro] 캐시 초기화됨");
}

// @deprecated clearNeuroCache() 사용 권장
export function clearSaCache(): void {
  clearNeuroCache();
}
