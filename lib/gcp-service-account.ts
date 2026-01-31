import fs from "fs/promises";
import { getConfigFilePath, getConfigDir } from "@/lib/notes-path";

export interface GcpServiceAccountInfo {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
  universe_domain?: string;
  [key: string]: unknown;
}

// 외부에 노출해도 안전한 정보만 포함
export interface GcpServiceAccountStatus {
  connected: boolean;
  projectId?: string;
  clientEmail?: string;
}

function getGcsBucketFilePath(): string {
  return getConfigFilePath("gcs-bucket", "bucket.json");
}

function getSAFilePath(): string {
  return getConfigFilePath("vertex-service-account", "service-account.json");
}

async function ensureConfigDir(subdir: string): Promise<void> {
  await fs.mkdir(getConfigDir(subdir), { recursive: true });
}

// SA JSON의 필수 필드 검증
export function validateServiceAccount(
  data: Record<string, unknown>
): data is GcpServiceAccountInfo {
  return (
    data.type === "service_account" &&
    typeof data.project_id === "string" &&
    typeof data.private_key === "string" &&
    typeof data.client_email === "string"
  );
}

export async function saveGcpServiceAccount(
  sa: GcpServiceAccountInfo
): Promise<void> {
  await ensureConfigDir("vertex-service-account");
  await fs.writeFile(getSAFilePath(), JSON.stringify(sa, null, 2));
}

export async function loadGcpServiceAccount(): Promise<GcpServiceAccountInfo | null> {
  try {
    const data = await fs.readFile(getSAFilePath(), "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function hasGcpServiceAccount(): Promise<boolean> {
  const sa = await loadGcpServiceAccount();
  return sa !== null && !!sa.project_id;
}

export async function deleteGcpServiceAccount(): Promise<void> {
  try {
    await fs.unlink(getSAFilePath());
  } catch {
    // 파일이 없으면 무시
  }
}

export async function getGcpServiceAccountStatus(): Promise<GcpServiceAccountStatus> {
  const sa = await loadGcpServiceAccount();
  if (!sa) {
    return { connected: false };
  }
  return {
    connected: true,
    projectId: sa.project_id,
    clientEmail: sa.client_email,
  };
}

export async function saveGcsBucketName(bucketName: string): Promise<void> {
  await ensureConfigDir("gcs-bucket");
  await fs.writeFile(
    getGcsBucketFilePath(),
    JSON.stringify({ bucketName }, null, 2)
  );
}

export async function loadGcsBucketName(): Promise<string | null> {
  try {
    const data = await fs.readFile(getGcsBucketFilePath(), "utf-8");
    const parsed = JSON.parse(data);
    return parsed.bucketName || null;
  } catch {
    return null;
  }
}

export async function deleteGcsBucketName(): Promise<void> {
  try {
    await fs.unlink(getGcsBucketFilePath());
  } catch {
    // 파일이 없으면 무시
  }
}
