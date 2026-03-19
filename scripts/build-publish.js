/**
 * 퍼블리시 모드 빌드 스크립트
 * Vercel 배포 환경을 로컬에서 재현하여 빌드 검증
 *
 * 동작:
 * 1. 스텁 대상 파일 백업
 * 2. 스텁으로 교체 (publish route.ts와 동일한 스텁)
 * 3. CI=1 NEXT_PUBLIC_IS_PUBLISHED=true next build
 * 4. 원본 복원 (성공/실패 무관)
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");

// publish route.ts의 publishStubs와 동일한 스텁 목록
const stubs = [
  {
    path: "contexts/NavigationGuardContext.tsx",
    content: `"use client";
import React from "react";
export function NavigationGuardProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
export function useNavigationGuard() {
  return { isDirty: false, setIsDirty: (_dirty: boolean) => {}, confirmNavigation: (fn: () => void) => fn() };
}
`,
  },
  {
    path: "hooks/useBeforeUnload.ts",
    content: `"use client";
export function useBeforeUnload(_shouldWarn: boolean) {}
`,
  },
  {
    path: "hooks/useNotesWatcher.ts",
    content: `"use client";
interface UseNotesWatcherOptions {
  onNotesChanged?: (event: { event: string; path: string; stats?: unknown }) => void;
  debounceMs?: number;
  enabled?: boolean;
}
export function useNotesWatcher(_options?: UseNotesWatcherOptions) {}
export function useNotesAutoRefresh(_fetchFn: () => void | Promise<void>) {}
`,
  },
  {
    path: "mastra/agents/meeting-summary.ts",
    content: `export function createMeetingSummaryAgent(_sa: Record<string, unknown>): never {
  throw new Error("meeting-summary agent is not available in published mode");
}
`,
  },
  {
    path: "app/api/ai/summarize/route.ts",
    content: `import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json({ success: false, error: "이 기능은 퍼블리시 모드에서 사용할 수 없습니다." }, { status: 403 });
}
`,
  },
  {
    path: "app/api/ai/transcribe/route.ts",
    content: `import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json({ success: false, error: "이 기능은 퍼블리시 모드에서 사용할 수 없습니다." }, { status: 403 });
}
`,
  },
  {
    path: "app/api/chat/route.ts",
    content: `import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json({ success: false, error: "이 기능은 퍼블리시 모드에서 사용할 수 없습니다." }, { status: 403 });
}
`,
  },
  {
    path: "app/api/voice-memos/route.ts",
    content: `import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ success: false, error: "이 기능은 퍼블리시 모드에서 사용할 수 없습니다." }, { status: 403 });
}
export async function POST() {
  return NextResponse.json({ success: false, error: "이 기능은 퍼블리시 모드에서 사용할 수 없습니다." }, { status: 403 });
}
`,
  },
];

const backups = new Map();

function backupFiles() {
  console.log("[build-publish] 원본 파일 백업 중...");
  for (const stub of stubs) {
    const filePath = path.join(ROOT, stub.path);
    if (fs.existsSync(filePath)) {
      backups.set(stub.path, fs.readFileSync(filePath, "utf-8"));
    }
  }
  console.log(`[build-publish] ${backups.size}개 파일 백업 완료`);
}

function applyStubs() {
  console.log("[build-publish] 스텁 파일 적용 중...");
  for (const stub of stubs) {
    const filePath = path.join(ROOT, stub.path);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, stub.content, "utf-8");
  }
  console.log(`[build-publish] ${stubs.length}개 스텁 적용 완료`);
}

function restoreFiles() {
  console.log("[build-publish] 원본 파일 복원 중...");
  let restored = 0;
  for (const [stubPath, content] of backups) {
    const filePath = path.join(ROOT, stubPath);
    fs.writeFileSync(filePath, content, "utf-8");
    restored++;
  }
  console.log(`[build-publish] ${restored}개 파일 복원 완료`);
}

function build() {
  console.log("[build-publish] 빌드 시작 (CI=1, NEXT_PUBLIC_IS_PUBLISHED=true)...\n");
  execSync("next build", {
    cwd: ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      CI: "1",
      NEXT_PUBLIC_IS_PUBLISHED: "true",
    },
  });
}

// 메인 실행
let exitCode = 0;

try {
  backupFiles();
  applyStubs();
  build();
  console.log("\n[build-publish] ✅ 퍼블리시 빌드 성공!");
} catch (err) {
  console.error("\n[build-publish] ❌ 퍼블리시 빌드 실패!");
  exitCode = 1;
} finally {
  restoreFiles();
}

process.exit(exitCode);
