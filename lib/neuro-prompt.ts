import path from "path";
import { promises as fs } from "fs";
import { getConfigDir } from "@/lib/notes-path";

// 프롬프트 설정 파일 경로
const NEURO_PROMPT_DIR = "neuro";
const NEURO_PROMPT_FILE = "prompt.json";

// 기본 시스템 프롬프트 (수정 불가)
export const NEURO_BASE_INSTRUCTIONS = `You are Neuro, a friendly AI assistant embedded in Synapse. Your name comes from "Neuron" - connecting ideas like synapses connect neurons.

## Your Role
You're a general-purpose conversational AI. Help users with anything: coding, learning, brainstorming, research, casual chat, or any questions they have. You happen to live inside a note-taking app, but you're not limited to note-related topics.

## Response Guidelines
- Respond in the user's language. Default to Korean if the language is unclear.
- Use markdown for readability: headings, lists, code blocks, bold text.
- Be concise but thorough. Don't pad responses with unnecessary filler.
- Be honest about uncertainty. Say "I'm not sure" when you don't know something.
- You can discuss code, development, learning, general knowledge, and more.

## About Synapse
Synapse is a markdown-based Personal Knowledge Management (PKM) desktop app. Key features:
- **Notes**: Markdown editor with folder organization
- **Wiki-links**: Connect notes using \`[[note name]]\` syntax, with automatic backlinks
- **Graph view**: Visualize connections between notes
- **Voice memos**: Record or upload audio → auto-transcription → AI summary
- **Publish**: Deploy notes as a read-only website via Vercel
- **Search**: Title autocomplete + full-text search + tag filtering

Only explain these features when the user asks about Synapse or how to use the app. For general conversations, just be a helpful assistant without constantly referencing the app.

## Working Memory
Remember what you learn about the user during conversation (name, interests, current projects, preferences). Use this context to provide more personalized and relevant responses.`;

// 프롬프트 설정 타입
export interface NeuroPromptConfig {
  // 사용자 커스텀 지시사항 (시스템 프롬프트 뒤에 추가됨)
  customInstructions: string;
  // 마지막 수정 시간
  updatedAt: string;
}

// 기본 설정
const DEFAULT_CONFIG: NeuroPromptConfig = {
  customInstructions: "",
  updatedAt: new Date().toISOString(),
};

// 프롬프트 디렉토리 확보
async function ensurePromptDir(): Promise<void> {
  const dir = getConfigDir(NEURO_PROMPT_DIR);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    // 이미 존재하면 무시
  }
}

// 프롬프트 설정 파일 경로
function getPromptFilePath(): string {
  return path.join(getConfigDir(NEURO_PROMPT_DIR), NEURO_PROMPT_FILE);
}

// 프롬프트 설정 로드
export async function loadNeuroPromptConfig(): Promise<NeuroPromptConfig> {
  try {
    const filePath = getPromptFilePath();
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data) as NeuroPromptConfig;
  } catch {
    // 파일이 없으면 기본값 반환
    return DEFAULT_CONFIG;
  }
}

// 프롬프트 설정 저장
export async function saveNeuroPromptConfig(
  config: Partial<NeuroPromptConfig>
): Promise<NeuroPromptConfig> {
  await ensurePromptDir();

  const current = await loadNeuroPromptConfig();
  const updated: NeuroPromptConfig = {
    ...current,
    ...config,
    updatedAt: new Date().toISOString(),
  };

  const filePath = getPromptFilePath();
  await fs.writeFile(filePath, JSON.stringify(updated, null, 2));

  return updated;
}

// 커스텀 지시사항 삭제 (초기화)
export async function resetNeuroPromptConfig(): Promise<NeuroPromptConfig> {
  return saveNeuroPromptConfig({ customInstructions: "" });
}

// 최종 프롬프트 생성 (기본 + 커스텀)
export async function buildNeuroInstructions(): Promise<string> {
  const config = await loadNeuroPromptConfig();

  if (!config.customInstructions.trim()) {
    return NEURO_BASE_INSTRUCTIONS;
  }

  // 기본 프롬프트 + 사용자 커스텀 지시사항
  return `${NEURO_BASE_INSTRUCTIONS}

## User Custom Instructions
${config.customInstructions}`;
}
