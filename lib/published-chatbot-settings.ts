import fs from "fs/promises";
import { getConfigFilePath, getConfigDir } from "@/lib/notes-path";

const CONFIG_SUBDIR = "published-chatbot";
const CONFIG_FILENAME = "settings.json";

export interface PublishedChatbotSettings {
  // 챗봇 활성화 여부
  enabled: boolean;
  // 1일 최대 사용 횟수 (0 = 무제한)
  dailyLimit: number;
  // 퍼블리시 챗봇용 커스텀 지시사항
  customInstructions: string;
}

const DEFAULT_SETTINGS: PublishedChatbotSettings = {
  enabled: false,
  dailyLimit: 50,
  customInstructions: "",
};

function getSettingsPath(): string {
  return getConfigFilePath(CONFIG_SUBDIR, CONFIG_FILENAME);
}

export async function loadPublishedChatbotSettings(): Promise<PublishedChatbotSettings> {
  try {
    const data = await fs.readFile(getSettingsPath(), "utf-8");
    return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function savePublishedChatbotSettings(
  settings: Partial<PublishedChatbotSettings>
): Promise<PublishedChatbotSettings> {
  const dir = getConfigDir(CONFIG_SUBDIR);
  await fs.mkdir(dir, { recursive: true });

  const current = await loadPublishedChatbotSettings();
  const updated = { ...current, ...settings };

  await fs.writeFile(getSettingsPath(), JSON.stringify(updated, null, 2));
  return updated;
}
