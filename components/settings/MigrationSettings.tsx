"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MigrationResult {
  oldFilename: string;
  newFilename: string;
  title: string;
  status: "renamed" | "skipped" | "error";
  reason?: string;
}

interface MigrationPreview {
  total: number;
  toRename: number;
  toSkip: number;
  details: MigrationResult[];
}

export function MigrationSettings() {
  const confirm = useConfirm();

  const [migrationPreview, setMigrationPreview] =
    useState<MigrationPreview | null>(null);
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [showMigrationDetails, setShowMigrationDetails] = useState(false);
  const [showMigrationConfirm, setShowMigrationConfirm] = useState(false);
  const [showMigrationResult, setShowMigrationResult] = useState(false);
  const [migrationResultData, setMigrationResultData] = useState<{
    renamed: number;
    skipped: number;
    errors: number;
  } | null>(null);
  const [errorDetail, setErrorDetail] = useState<{
    error: string;
    stack?: string;
  } | null>(null);
  const [folderMigrationPreview, setFolderMigrationPreview] = useState<{
    count: number;
    files: string[];
  } | null>(null);
  const [folderMigrationLoading, setFolderMigrationLoading] = useState(false);
  const [isFolderMigrating, setIsFolderMigrating] = useState(false);

  async function handlePreviewFolderMigration() {
    setFolderMigrationLoading(true);
    setFolderMigrationPreview(null);
    try {
      const response = await fetch("/api/folders/migrate");
      const result = await response.json();
      if (result.success) {
        setFolderMigrationPreview(result.data);
      } else {
        toast.error(`미리보기 실패: ${result.error}`);
      }
    } catch (error) {
      console.error("Folder migration preview error:", error);
      toast.error("미리보기 중 오류가 발생했습니다.");
    } finally {
      setFolderMigrationLoading(false);
    }
  }

  async function handleExecuteFolderMigration() {
    if (!folderMigrationPreview || folderMigrationPreview.count === 0) {
      toast.info("이동할 파일이 없습니다.");
      return;
    }
    const confirmed = await confirm({
      title: "폴더 마이그레이션",
      description: (
        <>
          <strong>{folderMigrationPreview.count}개</strong>의 파일을 default
          폴더로 이동합니다.
          <br />
          <br />
          계속하시겠습니까?
        </>
      ),
      confirmLabel: "이동",
    });
    if (!confirmed) return;
    setIsFolderMigrating(true);
    try {
      const response = await fetch("/api/folders/migrate", { method: "POST" });
      const result = await response.json();
      if (result.success) {
        toast.success(
          `폴더 마이그레이션 완료! 이동됨: ${result.data.migrated}개`
        );
        setFolderMigrationPreview(null);
      } else {
        toast.error(`마이그레이션 실패: ${result.error}`);
      }
    } catch (error) {
      console.error("Folder migration error:", error);
      toast.error("마이그레이션 중 오류가 발생했습니다.");
    } finally {
      setIsFolderMigrating(false);
    }
  }

  async function handlePreviewMigration() {
    setMigrationLoading(true);
    setMigrationPreview(null);
    try {
      const response = await fetch("/api/migrate");
      const result = await response.json();
      if (result.success) {
        setMigrationPreview(result.data);
        setShowMigrationDetails(true);
      } else {
        console.error("Migration preview error:", result);
        toast.error(`미리보기 실패: ${result.error}`);
        if (result.stack) {
          setErrorDetail({ error: result.error, stack: result.stack });
        }
      }
    } catch (error) {
      console.error("Migration preview error:", error);
      toast.error("미리보기 중 오류가 발생했습니다.");
    } finally {
      setMigrationLoading(false);
    }
  }

  function handleExecuteMigration() {
    if (!migrationPreview || migrationPreview.toRename === 0) {
      toast.info("변경할 파일이 없습니다.");
      return;
    }
    setShowMigrationConfirm(true);
  }

  async function executeMigration() {
    setShowMigrationConfirm(false);
    setIsMigrating(true);
    try {
      const response = await fetch("/api/migrate", { method: "POST" });
      const result = await response.json();
      if (result.success) {
        setMigrationResultData(result.data);
        setShowMigrationResult(true);
        setMigrationPreview(null);
        setShowMigrationDetails(false);
      } else {
        console.error("Migration error:", result);
        toast.error(`마이그레이션 실패: ${result.error}`);
        if (result.stack) {
          setErrorDetail({ error: result.error, stack: result.stack });
        }
      }
    } catch (error) {
      console.error("Migration error:", error);
      toast.error("마이그레이션 중 오류가 발생했습니다.");
    } finally {
      setIsMigrating(false);
    }
  }

  return (
    <>
      {/* 파일명 마이그레이션 */}
      <section className="border rounded-lg p-6 bg-card">
        <h2 className="text-2xl font-semibold mb-4">파일명 마이그레이션</h2>
        <p className="text-muted-foreground mb-6">
          기존 파일명(UUID 기반)을 새 시스템(제목 기반)으로 변환합니다.
          마이그레이션 후 파일명이 문서 제목과 일치하게 됩니다.
        </p>

        <div className="space-y-4">
          {/* Preview Button */}
          <div>
            <Button
              onClick={handlePreviewMigration}
              disabled={migrationLoading || isMigrating}
              variant="outline"
              className="cursor-pointer"
            >
              {migrationLoading ? "분석 중..." : "미리보기"}
            </Button>
            <p className="text-sm text-muted-foreground mt-2">
              먼저 미리보기로 변경될 파일명을 확인하세요.
            </p>
          </div>

          {/* Preview Results */}
          {migrationPreview && (
            <div className="bg-muted rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">분석 결과</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    총 {migrationPreview.total}개 파일 중{" "}
                    <span className="text-primary font-medium">
                      {migrationPreview.toRename}개 변경 예정
                    </span>
                    ,{" "}
                    <span className="text-muted-foreground">
                      {migrationPreview.toSkip}개 건너뜀
                    </span>
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMigrationDetails(!showMigrationDetails)}
                  className="cursor-pointer"
                >
                  {showMigrationDetails ? "접기" : "상세보기"}
                </Button>
              </div>

              {/* Details */}
              {showMigrationDetails && migrationPreview.details.length > 0 && (
                <div className="border rounded-md bg-background max-h-64 overflow-y-auto">
                  <table className="w-full text-sm table-fixed">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left p-2 font-medium w-[40%]">
                          현재 파일명
                        </th>
                        <th className="text-left p-2 font-medium w-6">→</th>
                        <th className="text-left p-2 font-medium w-[40%]">
                          새 파일명
                        </th>
                        <th className="text-left p-2 font-medium w-16 shrink-0">
                          상태
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {migrationPreview.details.map((item, idx) => (
                        <tr
                          key={idx}
                          className={`border-t ${item.status === "skipped" ? "text-muted-foreground" : ""}`}
                        >
                          <td
                            className="p-2 font-mono text-xs truncate"
                            title={item.oldFilename}
                          >
                            {item.oldFilename}
                          </td>
                          <td className="p-2">→</td>
                          <td
                            className="p-2 font-mono text-xs truncate"
                            title={item.newFilename}
                          >
                            {item.newFilename}
                          </td>
                          <td className="p-2 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-xs ${
                                item.status === "renamed"
                                  ? "bg-primary/10 text-primary"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {item.status === "renamed" ? "변경" : "건너뜀"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Execute Button */}
              {migrationPreview.toRename > 0 && (
                <div className="pt-2">
                  <Button
                    onClick={handleExecuteMigration}
                    disabled={isMigrating}
                    className="cursor-pointer"
                  >
                    {isMigrating
                      ? "마이그레이션 중..."
                      : `${migrationPreview.toRename}개 파일 마이그레이션 실행`}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 폴더 마이그레이션 */}
      <section className="border rounded-lg p-6 bg-card">
        <h2 className="text-2xl font-semibold mb-4">폴더 마이그레이션</h2>
        <p className="text-muted-foreground mb-6">
          루트 디렉토리에 있는 노트들을 default 폴더로 이동합니다. 새 폴더
          시스템에서는 모든 노트가 폴더 안에 있어야 합니다.
        </p>

        <div className="space-y-4">
          {/* Preview Button */}
          <div>
            <Button
              onClick={handlePreviewFolderMigration}
              disabled={folderMigrationLoading || isFolderMigrating}
              variant="outline"
              className="cursor-pointer"
            >
              {folderMigrationLoading ? "분석 중..." : "루트 노트 확인"}
            </Button>
            <p className="text-sm text-muted-foreground mt-2">
              루트 디렉토리에 있는 노트 파일들을 확인합니다.
            </p>
          </div>

          {/* Preview Results */}
          {folderMigrationPreview && (
            <div className="bg-muted rounded-lg p-4 space-y-4">
              <div>
                <h3 className="font-semibold">분석 결과</h3>
                {folderMigrationPreview.count === 0 ? (
                  <p className="text-sm text-success mt-1">
                    루트 디렉토리에 노트가 없습니다. 모든 노트가 이미 폴더에
                    있습니다.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">
                    <span className="text-primary font-medium">
                      {folderMigrationPreview.count}개
                    </span>
                    의 노트가 루트 디렉토리에 있습니다.
                  </p>
                )}
              </div>

              {/* File List */}
              {folderMigrationPreview.count > 0 && (
                <div className="border rounded-md bg-background max-h-48 overflow-y-auto">
                  <ul className="divide-y">
                    {folderMigrationPreview.files.map((file, idx) => (
                      <li key={idx} className="px-3 py-2 text-sm font-mono">
                        {file}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Execute Button */}
              {folderMigrationPreview.count > 0 && (
                <div className="pt-2">
                  <Button
                    onClick={handleExecuteFolderMigration}
                    disabled={isFolderMigrating}
                    className="cursor-pointer"
                  >
                    {isFolderMigrating
                      ? "이동 중..."
                      : `${folderMigrationPreview.count}개 파일을 default 폴더로 이동`}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Migration Confirm Dialog */}
      <AlertDialog
        open={showMigrationConfirm}
        onOpenChange={setShowMigrationConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>마이그레이션 실행</AlertDialogTitle>
            <AlertDialogDescription>
              {migrationPreview?.toRename}개의 파일명을 변경합니다.
              계속하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={executeMigration}>
              실행
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Migration Result Dialog */}
      <AlertDialog
        open={showMigrationResult}
        onOpenChange={setShowMigrationResult}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>마이그레이션 완료</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>파일명 마이그레이션이 완료되었습니다.</p>
                <ul className="list-disc list-inside text-sm">
                  <li>변경됨: {migrationResultData?.renamed}개</li>
                  <li>건너뜀: {migrationResultData?.skipped}개</li>
                  <li>오류: {migrationResultData?.errors}개</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowMigrationResult(false)}>
              확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Error Detail Dialog */}
      <AlertDialog
        open={!!errorDetail}
        onOpenChange={(open) => !open && setErrorDetail(null)}
      >
        <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>오류 상세</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <div>
                  <p className="font-semibold mb-1">오류 메시지:</p>
                  <p className="text-destructive">{errorDetail?.error}</p>
                </div>
                {errorDetail?.stack && (
                  <div>
                    <p className="font-semibold mb-1">스택 트레이스:</p>
                    <pre className="text-xs bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap">
                      {errorDetail.stack}
                    </pre>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setErrorDetail(null)}>
              닫기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
