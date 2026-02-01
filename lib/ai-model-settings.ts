import fs from "fs/promises";
import { getConfigFilePath } from "@/lib/notes-path";

const CONFIG_SUBDIR = "ai-model";
const CONFIG_FILENAME = "settings.json";

export interface AIModelOption {
  id: string;
  label: string;
  description: string;
}

export const AI_MODELS: AIModelOption[] = [
  {
    id: "gemini-2.0-flash",
    label: "Gemini 2.0 Flash",
    description: "안정적인 이전 세대 모델",
  },
  {
    id: "gemini-3-flash-preview",
    label: "Gemini 3 Flash (Preview)",
    description: "빠르고 효율적인 최신 모델 (기본값)",
  },
  {
    id: "gemini-3-pro-preview",
    label: "Gemini 3 Pro (Preview)",
    description: "더 높은 품질의 응답 (느림)",
  },
];;

export const DEFAULT_MODEL_ID = "gemini-3-flash-preview";;

interface AIModelSettings {
  modelId: string;
}

function getSettingsPath(): string {
  return getConfigFilePath(CONFIG_SUBDIR, CONFIG_FILENAME);
}

export async function loadAIModelSettings(): Promise<AIModelSettings> {
  try {
    const filePath = getSettingsPath();
    const content = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(content) as AIModelSettings;

    // 저장된 모델이 유효한지 확인
    const isValid = AI_MODELS.some((m) => m.id === data.modelId);
    if (!isValid) {
      return { modelId: DEFAULT_MODEL_ID };
    }

    return data;
  } catch {
    return { modelId: DEFAULT_MODEL_ID };
  }
}

export async function saveAIModelSettings(
  settings: AIModelSettings
): Promise<void> {
  const filePath = getSettingsPath();
  const dir = filePath.replace(/\/[^/]+$/, "");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(settings, null, 2), "utf-8");
}
