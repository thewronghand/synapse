import fs from "fs/promises";
import { getConfigFilePath, getConfigDir } from "@/lib/notes-path";

const CONFIG_SUBDIR = "font";
const CONFIG_FILENAME = "settings.json";

export type FontId = "spoqa" | "ibm-plex" | "wanted-sans" | "custom";

export interface FontOption {
  id: FontId;
  label: string;
  description: string;
  // 내장 여부 (false면 다운로드 필요)
  builtin: boolean;
}

export const FONT_OPTIONS: FontOption[] = [
  {
    id: "spoqa",
    label: "Spoqa Han Sans Neo",
    description: "깔끔하고 심플한 한영 폰트 (기본값)",
    builtin: true,
  },
  {
    id: "ibm-plex",
    label: "IBM Plex Sans KR",
    description: "기술적이고 프로페셔널한 느낌",
    builtin: false,
  },
  {
    id: "wanted-sans",
    label: "Wanted Sans",
    description: "모던하고 세련된 디자인",
    builtin: false,
  },
];

export interface FontSettings {
  fontId: FontId;
  // 커스텀 폰트 파일명 (custom일 때)
  customFontName?: string;
}

const DEFAULT_SETTINGS: FontSettings = {
  fontId: "spoqa",
};

function getSettingsPath(): string {
  return getConfigFilePath(CONFIG_SUBDIR, CONFIG_FILENAME);
}

export async function loadFontSettings(): Promise<FontSettings> {
  try {
    const data = await fs.readFile(getSettingsPath(), "utf-8");
    return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveFontSettings(
  settings: Partial<FontSettings>
): Promise<FontSettings> {
  const dir = getConfigDir(CONFIG_SUBDIR);
  await fs.mkdir(dir, { recursive: true });

  const current = await loadFontSettings();
  const updated = { ...current, ...settings };

  await fs.writeFile(getSettingsPath(), JSON.stringify(updated, null, 2));
  return updated;
}
