"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useState, useEffect, Suspense, useRef } from "react";
import { LoadingScreen, Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
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
  status: 'renamed' | 'skipped' | 'error';
  reason?: string;
}

interface MigrationPreview {
  total: number;
  toRename: number;
  toSkip: number;
  details: MigrationResult[];
}

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPublishing, setIsPublishing] = useState(false);
  const [vercelConnected, setVercelConnected] = useState(false);
  const [vercelLoading, setVercelLoading] = useState(true);
  const [vercelConnectedAt, setVercelConnectedAt] = useState<string | null>(null);
  const [deploymentStatus, setDeploymentStatus] = useState<{
    hasDeployment: boolean;
    status?: 'BUILDING' | 'ERROR' | 'READY' | 'QUEUED' | 'CANCELED';
    url?: string | null;
    createdAt?: number;
  } | null>(null);
  const [deploymentLoading, setDeploymentLoading] = useState(true);

  // Migration states (filename)
  const [migrationPreview, setMigrationPreview] = useState<MigrationPreview | null>(null);
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [showMigrationDetails, setShowMigrationDetails] = useState(false);

  // Dialog states
  const [showMigrationConfirm, setShowMigrationConfirm] = useState(false);
  const [showMigrationResult, setShowMigrationResult] = useState(false);
  const [migrationResultData, setMigrationResultData] = useState<{ renamed: number; skipped: number; errors: number } | null>(null);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [showDeployComplete, setShowDeployComplete] = useState(false);
  const [deployCompleteUrl, setDeployCompleteUrl] = useState<string | null>(null);

  // Build logs state
  const [buildLogs, setBuildLogs] = useState<Array<{ timestamp: number; text: string; type: string }>>([]);
  const [showBuildLogs, setShowBuildLogs] = useState(false);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Folder migration states
  const [folderMigrationPreview, setFolderMigrationPreview] = useState<{ count: number; files: string[] } | null>(null);
  const [folderMigrationLoading, setFolderMigrationLoading] = useState(false);
  const [isFolderMigrating, setIsFolderMigrating] = useState(false);

  // Auto-scroll logs to bottom when new logs arrive
  useEffect(() => {
    if (logsContainerRef.current && showBuildLogs) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [buildLogs, showBuildLogs]);

  async function handlePreviewFolderMigration() {
    setFolderMigrationLoading(true);
    setFolderMigrationPreview(null);

    try {
      const response = await fetch('/api/folders/migrate');
      const result = await response.json();

      if (result.success) {
        setFolderMigrationPreview(result.data);
      } else {
        toast.error(`미리보기 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('Folder migration preview error:', error);
      toast.error('미리보기 중 오류가 발생했습니다.');
    } finally {
      setFolderMigrationLoading(false);
    }
  }

  async function handleExecuteFolderMigration() {
    if (!folderMigrationPreview || folderMigrationPreview.count === 0) {
      toast.info('이동할 파일이 없습니다.');
      return;
    }

    if (!confirm(`${folderMigrationPreview.count}개의 파일을 default 폴더로 이동합니다.\n\n계속하시겠습니까?`)) {
      return;
    }

    setIsFolderMigrating(true);

    try {
      const response = await fetch('/api/folders/migrate', {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`폴더 마이그레이션 완료! 이동됨: ${result.data.migrated}개`);
        setFolderMigrationPreview(null);
      } else {
        toast.error(`마이그레이션 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('Folder migration error:', error);
      toast.error('마이그레이션 중 오류가 발생했습니다.');
    } finally {
      setIsFolderMigrating(false);
    }
  }

  async function handlePreviewMigration() {
    setMigrationLoading(true);
    setMigrationPreview(null);

    try {
      const response = await fetch('/api/migrate');
      const result = await response.json();

      if (result.success) {
        setMigrationPreview(result.data);
        setShowMigrationDetails(true);
      } else {
        toast.error(`미리보기 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('Migration preview error:', error);
      toast.error('미리보기 중 오류가 발생했습니다.');
    } finally {
      setMigrationLoading(false);
    }
  }

  function handleExecuteMigration() {
    if (!migrationPreview || migrationPreview.toRename === 0) {
      toast.info('변경할 파일이 없습니다.');
      return;
    }
    setShowMigrationConfirm(true);
  }

  async function executeMigration() {
    setShowMigrationConfirm(false);
    setIsMigrating(true);

    try {
      const response = await fetch('/api/migrate', {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        setMigrationResultData(result.data);
        setShowMigrationResult(true);
        setMigrationPreview(null);
        setShowMigrationDetails(false);
      } else {
        toast.error(`마이그레이션 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('Migration error:', error);
      toast.error('마이그레이션 중 오류가 발생했습니다.');
    } finally {
      setIsMigrating(false);
    }
  }

  useEffect(() => {
    checkVercelConnection();
    checkDeploymentStatus();

    // Check for OAuth callback messages
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success === 'vercel_connected') {
      toast.success('Vercel 연동 완료!');
      checkVercelConnection();
      // Clear query params
      router.replace('/settings');
    } else if (error) {
      const errorMessages: Record<string, string> = {
        oauth_failed: 'OAuth 인증 실패',
        config_error: '서버 설정 오류',
        token_exchange_failed: '토큰 교환 실패',
        callback_error: '콜백 처리 오류',
      };
      toast.error(`연동 실패: ${errorMessages[error] || error}`);
      router.replace('/settings');
    }
  }, [searchParams]);

  async function checkVercelConnection() {
    try {
      const response = await fetch('/api/auth/vercel/status');
      const result = await response.json();

      if (result.success && result.data.connected) {
        setVercelConnected(true);
        setVercelConnectedAt(result.data.connectedAt || null);
      } else {
        setVercelConnected(false);
        setVercelConnectedAt(null);
      }
    } catch (error) {
      console.error('Error checking Vercel connection:', error);
      setVercelConnected(false);
      setVercelConnectedAt(null);
    } finally {
      setVercelLoading(false);
    }
  }

  async function checkDeploymentStatus() {
    try {
      const response = await fetch('/api/deployment/status');
      const result = await response.json();

      if (result.success && result.data) {
        setDeploymentStatus(result.data);
      } else {
        setDeploymentStatus({ hasDeployment: false });
      }
    } catch (error) {
      console.error('Error checking deployment status:', error);
      setDeploymentStatus({ hasDeployment: false });
    } finally {
      setDeploymentLoading(false);
    }
  }

  function formatDate(dateString: string | null | undefined): string {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      return '';
    }
  }

  function handleConnectVercel() {
    // Use OAuth Proxy if configured, otherwise fall back to local OAuth
    const proxyUrl = process.env.NEXT_PUBLIC_OAUTH_PROXY_URL;
    const callbackUrl = encodeURIComponent(`${window.location.origin}/oauth/callback`);

    if (proxyUrl) {
      window.location.href = `${proxyUrl}/api/vercel/start?callback_url=${callbackUrl}`;
    } else {
      // Fallback for local development with .env.local
      window.location.href = '/api/auth/vercel/start';
    }
  }

  function handleDisconnectVercel() {
    setShowDisconnectConfirm(true);
  }

  async function executeDisconnect() {
    setShowDisconnectConfirm(false);
    try {
      const response = await fetch('/api/auth/vercel/disconnect', {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Vercel 연동이 해제되었습니다.');
        checkVercelConnection();
        checkDeploymentStatus();
      } else {
        toast.error(`연동 해제 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('Error disconnecting Vercel:', error);
      toast.error('연동 해제 중 오류가 발생했습니다.');
    }
  }

  async function handlePublish() {
    if (!vercelConnected) {
      toast.warning("Vercel 연동이 필요합니다. 먼저 Vercel 계정을 연동해주세요.");
      return;
    }

    setIsPublishing(true);
    setBuildLogs([]); // Clear previous logs
    setShowBuildLogs(true); // Auto-expand logs panel

    // Immediately set deployment status to BUILDING
    setDeploymentStatus({
      hasDeployment: true,
      status: 'BUILDING',
      url: deploymentStatus?.url || null,
      createdAt: Date.now(),
    });

    try {
      const response = await fetch('/api/publish', {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        // Start polling for deployment status
        pollDeploymentStatus();
      } else {
        // Check for token expiration
        if (result.code === 'TOKEN_EXPIRED') {
          toast.warning('인증 토큰이 만료되었습니다. 자동으로 연동이 해제되었습니다. 다시 연동해주세요.');
          // Refresh connection status to update UI
          checkVercelConnection();
        } else {
          toast.error(`Publish 실패: ${result.error}`);
        }
        setIsPublishing(false);
        // Restore previous deployment status or set to error
        checkDeploymentStatus();
      }
    } catch (error) {
      console.error('Publish error:', error);
      toast.error('Publish 중 오류가 발생했습니다.');
      setIsPublishing(false);
      // Restore previous deployment status
      checkDeploymentStatus();
    }
  }

  async function pollDeploymentStatus() {
    const maxAttempts = 60; // 5 minutes (5 seconds * 60)
    let attempts = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setIsPublishing(false);
        toast.warning('배포 상태 확인 시간이 초과되었습니다. 설정 페이지에서 배포 상태를 확인해주세요.');
        checkDeploymentStatus();
        return;
      }

      attempts++;

      try {
        // Fetch both status and logs in parallel
        const [statusResponse, logsResponse] = await Promise.all([
          fetch('/api/deployment/status'),
          fetch('/api/deployment/logs'),
        ]);

        const statusResult = await statusResponse.json();
        const logsResult = await logsResponse.json();

        // Update logs
        if (logsResult.success && logsResult.data.logs) {
          setBuildLogs(logsResult.data.logs);
        }

        if (statusResult.success && statusResult.data.hasDeployment) {
          const { status, url } = statusResult.data;

          // Update deployment status in real-time
          setDeploymentStatus(statusResult.data);

          if (status === 'READY') {
            setIsPublishing(false);
            setDeployCompleteUrl(url);
            setShowDeployComplete(true);
            // Keep logs visible for a moment after completion
            return;
          } else if (status === 'ERROR') {
            setIsPublishing(false);
            toast.error('배포 실패! 아래 로그에서 오류를 확인하세요.');
            // Keep logs visible on error
            return;
          } else if (status === 'CANCELED') {
            setIsPublishing(false);
            toast.info('배포가 취소되었습니다.');
            return;
          }

          // Still building or queued, continue polling
          setTimeout(poll, 3000); // Check every 3 seconds for more responsive log updates
        } else {
          // No deployment found yet, continue polling
          setTimeout(poll, 3000);
        }
      } catch (error) {
        console.error('Error polling deployment status:', error);
        setTimeout(poll, 3000);
      }
    };

    // Start polling after a short delay
    setTimeout(poll, 2000);
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="outline" onClick={() => router.push("/")} className="cursor-pointer">
            ← 뒤로
          </Button>
          <h1 className="text-4xl font-bold">설정</h1>
        </div>
        <p className="text-muted-foreground">
          Synapse 앱 설정 및 publish 관리
        </p>
      </div>

      {/* Settings Sections */}
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Publish Section */}
        <section className="border rounded-lg p-6 bg-card shadow-sm">
          <h2 className="text-2xl font-semibold mb-4">Publish</h2>
          <p className="text-muted-foreground mb-6">
            로컬 노트를 읽기 전용 웹사이트로 배포하세요. Vercel을 통해 무료로 publish할 수 있습니다.
          </p>

          <div className="space-y-4">
            {/* Vercel Connection Status */}
            <div className="bg-muted rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold">Vercel 연동 상태</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {vercelLoading
                      ? "확인 중..."
                      : vercelConnected
                        ? "Vercel 계정이 연동되었습니다"
                        : "Vercel 계정 연동이 필요합니다"}
                  </p>
                  {vercelConnected && vercelConnectedAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      연동 날짜: {formatDate(vercelConnectedAt)}
                    </p>
                  )}
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  vercelConnected
                    ? "bg-success/10 text-success"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {vercelConnected ? "연동됨" : "미연동"}
                </div>
              </div>
              {!vercelLoading && (
                <div className="mt-4">
                  {!vercelConnected ? (
                    <Button
                      onClick={handleConnectVercel}
                      variant="outline"
                      className="cursor-pointer"
                    >
                      Vercel 연동하기
                    </Button>
                  ) : (
                    <Button
                      onClick={handleDisconnectVercel}
                      variant="outline"
                      className="cursor-pointer text-red-600 border-red-300 hover:bg-red-50"
                    >
                      연동 해제
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Deploy Status */}
            <div className="bg-muted rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold">배포 상태</h3>
                  {deploymentLoading ? (
                    <p className="text-sm text-muted-foreground mt-1">확인 중...</p>
                  ) : !deploymentStatus?.hasDeployment ? (
                    <p className="text-sm text-muted-foreground mt-1">아직 배포되지 않았습니다</p>
                  ) : deploymentStatus.status === 'READY' ? (
                    <>
                      <p className="text-sm text-success mt-1">배포 완료</p>
                      {deploymentStatus.url && (
                        <a
                          href={deploymentStatus.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline mt-1 block"
                        >
                          {deploymentStatus.url}
                        </a>
                      )}
                      {deploymentStatus.createdAt && (
                        <p className="text-xs text-muted-foreground mt-1">
                          마지막 배포: {formatDate(new Date(deploymentStatus.createdAt).toISOString())}
                        </p>
                      )}
                    </>
                  ) : deploymentStatus.status === 'BUILDING' ? (
                    <>
                      <p className="text-sm text-primary mt-1 flex items-center gap-2">
                        <Spinner size="sm" className="text-primary" />
                        빌드 중...
                      </p>
                      {deploymentStatus.createdAt && (
                        <p className="text-xs text-muted-foreground mt-1">
                          시작 시간: {formatDate(new Date(deploymentStatus.createdAt).toISOString())}
                        </p>
                      )}
                    </>
                  ) : deploymentStatus.status === 'QUEUED' ? (
                    <p className="text-sm text-warning mt-1">대기 중...</p>
                  ) : deploymentStatus.status === 'ERROR' ? (
                    <>
                      <p className="text-sm text-destructive mt-1">배포 실패</p>
                      {deploymentStatus.createdAt && (
                        <p className="text-xs text-muted-foreground mt-1">
                          실패 시간: {formatDate(new Date(deploymentStatus.createdAt).toISOString())}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">상태 확인 불가</p>
                  )}
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  !deploymentStatus?.hasDeployment
                    ? "bg-muted text-muted-foreground"
                    : deploymentStatus.status === 'READY'
                      ? "bg-success/10 text-success"
                      : deploymentStatus.status === 'BUILDING'
                        ? "bg-primary/10 text-primary"
                        : deploymentStatus.status === 'QUEUED'
                          ? "bg-warning/10 text-warning"
                          : deploymentStatus.status === 'ERROR'
                            ? "bg-destructive/10 text-destructive"
                            : "bg-muted text-muted-foreground"
                }`}>
                  {!deploymentStatus?.hasDeployment
                    ? "미배포"
                    : deploymentStatus.status === 'READY'
                      ? "완료"
                      : deploymentStatus.status === 'BUILDING'
                        ? "빌드 중"
                        : deploymentStatus.status === 'QUEUED'
                          ? "대기 중"
                          : deploymentStatus.status === 'ERROR'
                            ? "실패"
                            : "알 수 없음"}
                </div>
              </div>
            </div>

            {/* Build Logs */}
            {(buildLogs.length > 0 || isPublishing) && (
              <div className="bg-muted rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowBuildLogs(!showBuildLogs)}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/80 transition-colors cursor-pointer"
                >
                  <h3 className="font-semibold">빌드 로그</h3>
                  <span className="text-sm text-muted-foreground">
                    {showBuildLogs ? "접기" : "펼치기"}
                  </span>
                </button>

                {showBuildLogs && (
                  <div className="border-t border-border">
                    <div
                      ref={logsContainerRef}
                      className="bg-zinc-900 text-zinc-100 p-4 font-mono text-xs overflow-auto max-h-80"
                      style={{ minHeight: buildLogs.length > 0 ? '200px' : '100px' }}
                    >
                      {buildLogs.length === 0 ? (
                        <div className="text-zinc-500 flex items-center gap-2">
                          <Spinner size="sm" />
                          <span>로그 대기 중...</span>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          {buildLogs.map((log, idx) => (
                            <div key={idx} className="leading-relaxed whitespace-pre-wrap break-all">
                              <span className="text-zinc-500 select-none mr-2">
                                {new Date(log.timestamp).toLocaleTimeString('ko-KR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit'
                                })}
                              </span>
                              <span className={
                                log.text?.toLowerCase().includes('error')
                                  ? 'text-red-400'
                                  : log.text?.toLowerCase().includes('warn')
                                    ? 'text-yellow-400'
                                    : log.text?.toLowerCase().includes('success') || log.text?.toLowerCase().includes('done')
                                      ? 'text-green-400'
                                      : 'text-zinc-100'
                              }>
                                {log.text}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Publish Button */}
            <div className="pt-4">
              <Button
                onClick={handlePublish}
                disabled={isPublishing || !vercelConnected}
                className="cursor-pointer w-full sm:w-auto"
                size="lg"
              >
                {isPublishing ? (
                  <span className="flex items-center gap-2">
                    <Spinner size="sm" />
                    Publishing...
                  </span>
                ) : "Publish to Vercel"}
              </Button>
              <p className="text-sm text-muted-foreground mt-2">
                {!vercelConnected
                  ? "Vercel 연동 후 publish할 수 있습니다"
                  : "노트를 Vercel에 직접 배포합니다"}
              </p>
            </div>
          </div>
        </section>

        {/* Migration Section */}
        <section className="border rounded-lg p-6 bg-card shadow-sm">
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
                      <span className="text-primary font-medium">{migrationPreview.toRename}개 변경 예정</span>,{" "}
                      <span className="text-muted-foreground">{migrationPreview.toSkip}개 건너뜀</span>
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
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="text-left p-2 font-medium">현재 파일명</th>
                          <th className="text-left p-2 font-medium">→</th>
                          <th className="text-left p-2 font-medium">새 파일명</th>
                          <th className="text-left p-2 font-medium">상태</th>
                        </tr>
                      </thead>
                      <tbody>
                        {migrationPreview.details.map((item, idx) => (
                          <tr key={idx} className={`border-t ${item.status === 'skipped' ? 'text-muted-foreground' : ''}`}>
                            <td className="p-2 font-mono text-xs break-all">{item.oldFilename}</td>
                            <td className="p-2">→</td>
                            <td className="p-2 font-mono text-xs break-all">{item.newFilename}</td>
                            <td className="p-2">
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                item.status === 'renamed'
                                  ? 'bg-primary/10 text-primary'
                                  : 'bg-muted text-muted-foreground'
                              }`}>
                                {item.status === 'renamed' ? '변경' : '건너뜀'}
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
                      {isMigrating ? "마이그레이션 중..." : `${migrationPreview.toRename}개 파일 마이그레이션 실행`}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Folder Migration Section */}
        <section className="border rounded-lg p-6 bg-card shadow-sm">
          <h2 className="text-2xl font-semibold mb-4">폴더 마이그레이션</h2>
          <p className="text-muted-foreground mb-6">
            루트 디렉토리에 있는 노트들을 default 폴더로 이동합니다.
            새 폴더 시스템에서는 모든 노트가 폴더 안에 있어야 합니다.
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
                      루트 디렉토리에 노트가 없습니다. 모든 노트가 이미 폴더에 있습니다.
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">
                      <span className="text-primary font-medium">{folderMigrationPreview.count}개</span>의 노트가 루트 디렉토리에 있습니다.
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
                      {isFolderMigrating ? "이동 중..." : `${folderMigrationPreview.count}개 파일을 default 폴더로 이동`}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Migration Confirm Dialog */}
      <AlertDialog open={showMigrationConfirm} onOpenChange={setShowMigrationConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>마이그레이션 실행</AlertDialogTitle>
            <AlertDialogDescription>
              {migrationPreview?.toRename}개의 파일명을 변경합니다. 계속하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={executeMigration}>실행</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Migration Result Dialog */}
      <AlertDialog open={showMigrationResult} onOpenChange={setShowMigrationResult}>
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
            <AlertDialogAction onClick={() => setShowMigrationResult(false)}>확인</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Disconnect Confirm Dialog */}
      <AlertDialog open={showDisconnectConfirm} onOpenChange={setShowDisconnectConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vercel 연동 해제</AlertDialogTitle>
            <AlertDialogDescription>
              Vercel 연동을 해제하시겠습니까? Publish 기능을 사용하려면 다시 연동해야 합니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={executeDisconnect} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              연동 해제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Deploy Complete Dialog */}
      <AlertDialog open={showDeployComplete} onOpenChange={setShowDeployComplete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>배포 완료</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>사이트가 성공적으로 배포되었습니다!</p>
                {deployCompleteUrl && (
                  <a
                    href={deployCompleteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-primary hover:underline break-all"
                  >
                    {deployCompleteUrl}
                  </a>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeployComplete(false)}>닫기</AlertDialogCancel>
            {deployCompleteUrl && (
              <AlertDialogAction asChild>
                <a href={deployCompleteUrl} target="_blank" rel="noopener noreferrer">
                  사이트 방문
                </a>
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<LoadingScreen message="설정 로딩 중..." />}>
      <SettingsContent />
    </Suspense>
  );
}
