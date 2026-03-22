"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
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

type DeploymentStatus = {
  hasDeployment: boolean;
  status?: "BUILDING" | "ERROR" | "READY" | "QUEUED" | "CANCELED";
  url?: string | null;
  createdAt?: number;
};

export function PublishSettings() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isPublishing, setIsPublishing] = useState(false);
  const [vercelConnected, setVercelConnected] = useState(false);
  const [vercelLoading, setVercelLoading] = useState(true);
  const [vercelConnectedAt, setVercelConnectedAt] = useState<string | null>(null);
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatus | null>(null);
  const [deploymentLoading, setDeploymentLoading] = useState(true);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [tokenInputValue, setTokenInputValue] = useState("");
  const [tokenSaving, setTokenSaving] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [lastExportTime, setLastExportTime] = useState<string | null>(null);
  const [hasExportData, setHasExportData] = useState(false);
  const [exportDataLoading, setExportDataLoading] = useState(true);
  const [buildLogs, setBuildLogs] = useState<Array<{ timestamp: number; text: string; type: string }>>([]);
  const [showBuildLogs, setShowBuildLogs] = useState(false);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [showDeployComplete, setShowDeployComplete] = useState(false);
  const [deployCompleteUrl, setDeployCompleteUrl] = useState<string | null>(null);
  const [allFolders, setAllFolders] = useState<{ name: string; noteCount: number }[]>([]);
  const [excludedFolders, setExcludedFolders] = useState<string[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(true);

  // OAuth 콜백 처리 + Vercel 연동 상태 확인
  useEffect(() => {
    checkVercelConnection();
    checkDeploymentStatus();

    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success === "vercel_connected") {
      toast.success("Vercel 연동 완료!");
      checkVercelConnection();
      router.replace("/settings");
    } else if (error) {
      const errorMessages: Record<string, string> = {
        oauth_failed: "OAuth 인증 실패",
        config_error: "서버 설정 오류",
        token_exchange_failed: "토큰 교환 실패",
        callback_error: "콜백 처리 오류",
      };
      toast.error(`연동 실패: ${errorMessages[error] || error}`);
      router.replace("/settings");
    }
  }, [searchParams]);

  // 폴더 목록 + 제외 폴더 로드 + export 상태 확인
  useEffect(() => {
    async function fetchFolders() {
      try {
        const response = await fetch("/api/folders");
        const result = await response.json();
        if (result.success) {
          setAllFolders(result.data.folders);
        }
      } catch (error) {
        console.error("Error fetching folders:", error);
      } finally {
        setFoldersLoading(false);
      }
    }

    const saved = localStorage.getItem("synapse-excluded-folders");
    if (saved) {
      try {
        setExcludedFolders(JSON.parse(saved));
      } catch {
        // ignore parse error
      }
    }

    checkExportStatus();
    fetchFolders();
  }, []);

  // 빌드 로그 자동 스크롤
  useEffect(() => {
    if (logsContainerRef.current && showBuildLogs) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [buildLogs, showBuildLogs]);

  async function checkExportStatus() {
    try {
      const response = await fetch("/api/export/status");
      const result = await response.json();

      if (result.success && result.data) {
        setHasExportData(result.data.hasExportData);
        if (result.data.lastExportTime) {
          setLastExportTime(result.data.lastExportTime);
        }
      }
    } catch (error) {
      console.error("Error checking export status:", error);
    } finally {
      setExportDataLoading(false);
    }
  }

  async function checkVercelConnection() {
    try {
      const response = await fetch("/api/auth/vercel/status");
      const result = await response.json();

      if (result.success && result.data.connected) {
        setVercelConnected(true);
        setVercelConnectedAt(result.data.connectedAt || null);
      } else {
        setVercelConnected(false);
        setVercelConnectedAt(null);
      }
    } catch (error) {
      console.error("Error checking Vercel connection:", error);
      setVercelConnected(false);
      setVercelConnectedAt(null);
    } finally {
      setVercelLoading(false);
    }
  }

  async function checkDeploymentStatus() {
    try {
      const response = await fetch("/api/deployment/status");
      const result = await response.json();

      if (result.success && result.data) {
        setDeploymentStatus(result.data);
      } else {
        setDeploymentStatus({ hasDeployment: false });
      }
    } catch (error) {
      console.error("Error checking deployment status:", error);
      setDeploymentStatus({ hasDeployment: false });
    } finally {
      setDeploymentLoading(false);
    }
  }

  function formatDate(dateString: string | null | undefined): string {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return date.toLocaleString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  function handleConnectVercel() {
    setShowTokenInput(true);
    setTokenInputValue("");
    setTokenError(null);
  }

  async function handleSaveToken() {
    if (!tokenInputValue.trim()) {
      setTokenError("토큰을 입력해주세요");
      return;
    }

    setTokenSaving(true);
    setTokenError(null);

    try {
      const response = await fetch("/api/auth/vercel/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: tokenInputValue.trim() }),
      });

      const result = await response.json();

      if (result.success) {
        setShowTokenInput(false);
        setTokenInputValue("");
        toast.success("Vercel 연동 완료!");
        checkVercelConnection();
        checkDeploymentStatus();
      } else {
        setTokenError(result.error || "토큰 저장 실패");
      }
    } catch (error) {
      console.error("Error saving token:", error);
      setTokenError("토큰 저장 중 오류가 발생했습니다");
    } finally {
      setTokenSaving(false);
    }
  }

  function handleDisconnectVercel() {
    setShowDisconnectConfirm(true);
  }

  async function executeDisconnect() {
    setShowDisconnectConfirm(false);
    try {
      const response = await fetch("/api/auth/vercel/disconnect", {
        method: "POST",
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Vercel 연동이 해제되었습니다.");
        checkVercelConnection();
        checkDeploymentStatus();
      } else {
        toast.error(`연동 해제 실패: ${result.error}`);
      }
    } catch (error) {
      console.error("Error disconnecting Vercel:", error);
      toast.error("연동 해제 중 오류가 발생했습니다.");
    }
  }

  async function handleExport() {
    setIsExporting(true);

    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ excludedFolders }),
      });

      const result = await response.json();

      if (result.success) {
        const exportTime = new Date().toISOString();
        setLastExportTime(exportTime);
        setHasExportData(true);
        toast.success(`Export 완료! ${result.data.documentsCount}개 문서, ${result.data.foldersCount}개 폴더`);
      } else {
        toast.error(`Export 실패: ${result.error}`);
      }
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Export 중 오류가 발생했습니다.");
    } finally {
      setIsExporting(false);
    }
  }

  async function handlePublish() {
    if (!vercelConnected) {
      toast.warning("Vercel 연동이 필요합니다. 먼저 Vercel 계정을 연동해주세요.");
      return;
    }

    setIsPublishing(true);
    setBuildLogs([]);
    setShowBuildLogs(true);

    setDeploymentStatus({
      hasDeployment: true,
      status: "BUILDING",
      url: deploymentStatus?.url || null,
      createdAt: Date.now(),
    });

    try {
      const response = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ excludedFolders }),
      });

      const result = await response.json();

      if (result.success) {
        if (result.data?.debug) {
          const debug = result.data.debug;
          console.log("[Publish Debug]", debug);
          toast.info(`업로드: ${debug.totalFiles}개 파일 (public/data: ${debug.publicDataFiles}개, graph.json: ${debug.hasGraphJson ? "✓" : "✗"})`);
        }
        pollDeploymentStatus();
      } else {
        if (result.code === "TOKEN_EXPIRED") {
          toast.warning("인증 토큰이 만료되었습니다. 자동으로 연동이 해제되었습니다. 다시 연동해주세요.");
          checkVercelConnection();
        } else {
          toast.error(`Publish 실패: ${result.error}`);
        }
        setIsPublishing(false);
        checkDeploymentStatus();
      }
    } catch (error) {
      console.error("Publish error:", error);
      toast.error("Publish 중 오류가 발생했습니다.");
      setIsPublishing(false);
      checkDeploymentStatus();
    }
  }

  async function pollDeploymentStatus() {
    const maxAttempts = 60;
    let attempts = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setIsPublishing(false);
        toast.warning("배포 상태 확인 시간이 초과되었습니다. 설정 페이지에서 배포 상태를 확인해주세요.");
        checkDeploymentStatus();
        return;
      }

      attempts++;

      try {
        const [statusResponse, logsResponse] = await Promise.all([
          fetch("/api/deployment/status"),
          fetch("/api/deployment/logs"),
        ]);

        const statusResult = await statusResponse.json();
        const logsResult = await logsResponse.json();

        if (logsResult.success && logsResult.data.logs) {
          setBuildLogs(logsResult.data.logs);
        }

        if (statusResult.success && statusResult.data.hasDeployment) {
          const { status, url } = statusResult.data;

          setDeploymentStatus(statusResult.data);

          if (status === "READY") {
            setIsPublishing(false);
            setDeployCompleteUrl(url);
            setShowDeployComplete(true);
            return;
          } else if (status === "ERROR") {
            setIsPublishing(false);
            toast.error("배포 실패! 아래 로그에서 오류를 확인하세요.");
            return;
          } else if (status === "CANCELED") {
            setIsPublishing(false);
            toast.info("배포가 취소되었습니다.");
            return;
          }

          setTimeout(poll, 3000);
        } else {
          setTimeout(poll, 3000);
        }
      } catch (error) {
        console.error("Error polling deployment status:", error);
        setTimeout(poll, 3000);
      }
    };

    setTimeout(poll, 2000);
  }

  function toggleFolderExclusion(folderName: string) {
    setExcludedFolders((prev) => {
      const newExcluded = prev.includes(folderName)
        ? prev.filter((f) => f !== folderName)
        : [...prev, folderName];
      localStorage.setItem("synapse-excluded-folders", JSON.stringify(newExcluded));
      return newExcluded;
    });
  }

  return (
    <>
      {/* Publish Section */}
      <section className="border rounded-lg p-6 bg-card">
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
                    variant="destructive"
                    className="cursor-pointer"
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
                ) : deploymentStatus.status === "READY" ? (
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
                ) : deploymentStatus.status === "BUILDING" ? (
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
                ) : deploymentStatus.status === "QUEUED" ? (
                  <p className="text-sm text-warning mt-1">대기 중...</p>
                ) : deploymentStatus.status === "ERROR" ? (
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
                  : deploymentStatus.status === "READY"
                    ? "bg-success/10 text-success"
                    : deploymentStatus.status === "BUILDING"
                      ? "bg-primary/10 text-primary"
                      : deploymentStatus.status === "QUEUED"
                        ? "bg-warning/10 text-warning"
                        : deploymentStatus.status === "ERROR"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-muted text-muted-foreground"
              }`}>
                {!deploymentStatus?.hasDeployment
                  ? "미배포"
                  : deploymentStatus.status === "READY"
                    ? "완료"
                    : deploymentStatus.status === "BUILDING"
                      ? "빌드 중"
                      : deploymentStatus.status === "QUEUED"
                        ? "대기 중"
                        : deploymentStatus.status === "ERROR"
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
                    style={{ minHeight: buildLogs.length > 0 ? "200px" : "100px" }}
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
                              {new Date(log.timestamp).toLocaleTimeString("ko-KR", {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </span>
                            <span className={
                              log.text?.toLowerCase().includes("error")
                                ? "text-red-400"
                                : log.text?.toLowerCase().includes("warn")
                                  ? "text-yellow-400"
                                  : log.text?.toLowerCase().includes("success") || log.text?.toLowerCase().includes("done")
                                    ? "text-green-400"
                                    : "text-zinc-100"
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

          {/* Folder Exclusion */}
          {vercelConnected && allFolders.length > 0 && (
            <div className="bg-muted rounded-lg p-4">
              <h3 className="font-semibold mb-2">배포 제외 폴더</h3>
              <p className="text-sm text-muted-foreground mb-3">
                선택한 폴더는 배포에서 제외됩니다.
              </p>
              {foldersLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner size="sm" />
                  <span>폴더 로딩 중...</span>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {allFolders.map((folder) => {
                    const isExcluded = excludedFolders.includes(folder.name);
                    return (
                      <button
                        key={folder.name}
                        onClick={() => toggleFolderExclusion(folder.name)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                          isExcluded
                            ? "bg-destructive/10 text-destructive border border-destructive/30"
                            : "bg-background border border-border hover:bg-muted-foreground/10"
                        }`}
                      >
                        {folder.name}
                        <span className="ml-1 text-xs opacity-60">({folder.noteCount})</span>
                        {isExcluded && <span className="ml-1">✕</span>}
                      </button>
                    );
                  })}
                </div>
              )}
              {excludedFolders.length > 0 && (
                <p className="text-xs text-muted-foreground mt-3">
                  {excludedFolders.length}개 폴더가 배포에서 제외됩니다
                </p>
              )}
            </div>
          )}

          {/* Export & Publish Buttons */}
          <div className="pt-4 space-y-4">
            {/* Export Button */}
            <div className="flex items-center gap-4">
              <Button
                onClick={handleExport}
                disabled={isExporting}
                variant="outline"
                className="cursor-pointer"
              >
                {isExporting ? (
                  <span className="flex items-center gap-2">
                    <Spinner size="sm" />
                    Exporting...
                  </span>
                ) : "Export Data"}
              </Button>
              <span className="text-sm text-muted-foreground">
                {lastExportTime
                  ? `마지막 Export: ${formatDate(lastExportTime)}`
                  : "아직 export하지 않았습니다"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              노트를 변경한 후 Publish 전에 먼저 Export를 실행하세요.
            </p>

            {/* Publish Button */}
            <div>
              <Button
                onClick={handlePublish}
                disabled={isPublishing || !vercelConnected || !hasExportData || exportDataLoading}
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
                  : !hasExportData
                    ? "먼저 Export를 실행하세요"
                    : excludedFolders.length > 0
                      ? `${excludedFolders.length}개 폴더 제외하고 배포합니다`
                      : "모든 폴더를 배포합니다"}
              </p>
            </div>
          </div>
        </div>
      </section>

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
            <AlertDialogAction
              onClick={executeDisconnect}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
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

      {/* Token Input Dialog */}
      <AlertDialog open={showTokenInput} onOpenChange={setShowTokenInput}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Vercel 토큰 입력</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  <a
                    href="https://vercel.com/account/tokens/create"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Vercel 토큰 생성 페이지
                  </a>
                  에서 토큰을 생성하고 아래에 붙여넣기 하세요.
                </p>
                <p className="text-sm text-muted-foreground">
                  Scope는 &quot;Full Account&quot;를 선택해야 합니다.
                </p>
                <div className="pt-1">
                  <input
                    type="password"
                    value={tokenInputValue}
                    onChange={(e) => {
                      setTokenInputValue(e.target.value);
                      setTokenError(null);
                    }}
                    placeholder="토큰을 붙여넣기 하세요"
                    className="w-full px-3 py-2 border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    autoFocus
                  />
                  {tokenError && (
                    <p className="text-sm text-destructive mt-2">{tokenError}</p>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowTokenInput(false)}>취소</AlertDialogCancel>
            <Button
              onClick={handleSaveToken}
              disabled={tokenSaving || !tokenInputValue.trim()}
            >
              {tokenSaving ? (
                <span className="flex items-center gap-2">
                  <Spinner size="sm" />
                  확인 중...
                </span>
              ) : "연동하기"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
