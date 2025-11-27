"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useState, useEffect, Suspense } from "react";

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPublishing, setIsPublishing] = useState(false);
  const [vercelConnected, setVercelConnected] = useState(false);
  const [vercelLoading, setVercelLoading] = useState(true);
  const [vercelConnectedAt, setVercelConnectedAt] = useState<string | null>(null);
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubLoading, setGithubLoading] = useState(true);
  const [githubUsername, setGithubUsername] = useState<string | null>(null);
  const [githubConnectedAt, setGithubConnectedAt] = useState<string | null>(null);
  const [deploymentStatus, setDeploymentStatus] = useState<{
    hasDeployment: boolean;
    status?: 'BUILDING' | 'ERROR' | 'READY' | 'QUEUED' | 'CANCELED';
    url?: string | null;
    createdAt?: number;
  } | null>(null);
  const [deploymentLoading, setDeploymentLoading] = useState(true);

  useEffect(() => {
    checkVercelConnection();
    checkGitHubConnection();
    checkDeploymentStatus();

    // Check for OAuth callback messages
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success === 'vercel_connected') {
      alert('Vercel 연동 완료!');
      checkVercelConnection();
      // Clear query params
      router.replace('/settings');
    } else if (success === 'github_connected') {
      alert('GitHub 연동 완료!');
      checkGitHubConnection();
      // Clear query params
      router.replace('/settings');
    } else if (error) {
      const errorMessages: Record<string, string> = {
        oauth_failed: 'OAuth 인증 실패',
        config_error: '서버 설정 오류',
        token_exchange_failed: '토큰 교환 실패',
        callback_error: '콜백 처리 오류',
      };
      alert(`연동 실패: ${errorMessages[error] || error}`);
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

  async function checkGitHubConnection() {
    try {
      const response = await fetch('/api/auth/github/status');
      const result = await response.json();

      if (result.success && result.data.connected) {
        setGithubConnected(true);
        setGithubUsername(result.data.username || null);
        setGithubConnectedAt(result.data.connectedAt || null);
      } else {
        setGithubConnected(false);
        setGithubUsername(null);
        setGithubConnectedAt(null);
      }
    } catch (error) {
      console.error('Error checking GitHub connection:', error);
      setGithubConnected(false);
      setGithubUsername(null);
      setGithubConnectedAt(null);
    } finally {
      setGithubLoading(false);
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

  function handleConnectGitHub() {
    // Use OAuth Proxy if configured, otherwise fall back to local OAuth
    const proxyUrl = process.env.NEXT_PUBLIC_OAUTH_PROXY_URL;
    const callbackUrl = encodeURIComponent(`${window.location.origin}/oauth/callback`);

    if (proxyUrl) {
      window.location.href = `${proxyUrl}/api/github/start?callback_url=${callbackUrl}`;
    } else {
      // Fallback for local development with .env.local
      window.location.href = '/api/auth/github/start';
    }
  }

  async function handleDisconnectVercel() {
    if (!confirm('Vercel 연동을 해제하시겠습니까?\n\nPublish 기능을 사용하려면 다시 연동해야 합니다.')) {
      return;
    }

    try {
      const response = await fetch('/api/auth/vercel/disconnect', {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        alert('Vercel 연동이 해제되었습니다.');
        checkVercelConnection();
        checkDeploymentStatus();
      } else {
        alert(`연동 해제 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('Error disconnecting Vercel:', error);
      alert('연동 해제 중 오류가 발생했습니다.');
    }
  }

  async function handleDisconnectGitHub() {
    if (!confirm('GitHub 연동을 해제하시겠습니까?\n\nPublish 기능을 사용하려면 다시 연동해야 합니다.')) {
      return;
    }

    try {
      const response = await fetch('/api/auth/github/disconnect', {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        alert('GitHub 연동이 해제되었습니다.');
        checkGitHubConnection();
      } else {
        alert(`연동 해제 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('Error disconnecting GitHub:', error);
      alert('연동 해제 중 오류가 발생했습니다.');
    }
  }

  async function handlePublish() {
    if (!vercelConnected) {
      alert("Vercel 연동이 필요합니다. 먼저 Vercel 계정을 연동해주세요.");
      return;
    }

    if (!githubConnected) {
      alert("GitHub 연동이 필요합니다. 먼저 GitHub 계정을 연동해주세요.");
      return;
    }

    setIsPublishing(true);

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
          alert('인증 토큰이 만료되었습니다.\n\n자동으로 연동이 해제되었습니다.\n다시 연동해주세요.');
          // Refresh connection status to update UI
          checkVercelConnection();
          checkGitHubConnection();
        } else {
          alert(`Publish 실패: ${result.error}`);
        }
        setIsPublishing(false);
        // Restore previous deployment status or set to error
        checkDeploymentStatus();
      }
    } catch (error) {
      console.error('Publish error:', error);
      alert('Publish 중 오류가 발생했습니다.');
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
        alert('배포 상태 확인 시간이 초과되었습니다. 설정 페이지에서 배포 상태를 확인해주세요.');
        checkDeploymentStatus();
        return;
      }

      attempts++;

      try {
        const response = await fetch('/api/deployment/status');
        const result = await response.json();

        if (result.success && result.data.hasDeployment) {
          const { status, url } = result.data;

          // Update deployment status in real-time
          setDeploymentStatus(result.data);

          if (status === 'READY') {
            setIsPublishing(false);
            alert(`배포 완료!\n\n사이트 URL: ${url}\n\n지금 바로 방문하실 수 있습니다.`);
            return;
          } else if (status === 'ERROR') {
            setIsPublishing(false);
            alert('배포 실패!\n\nVercel 대시보드에서 오류 로그를 확인해주세요.');
            return;
          } else if (status === 'CANCELED') {
            setIsPublishing(false);
            alert('배포가 취소되었습니다.');
            return;
          }

          // Still building or queued, continue polling
          setTimeout(poll, 5000); // Check every 5 seconds
        } else {
          // No deployment found yet, continue polling
          setTimeout(poll, 5000);
        }
      } catch (error) {
        console.error('Error polling deployment status:', error);
        setTimeout(poll, 5000);
      }
    };

    // Start polling after a short delay
    setTimeout(poll, 3000);
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
        <p className="text-gray-600">
          Synapse 앱 설정 및 publish 관리
        </p>
      </div>

      {/* Settings Sections */}
      <div className="max-w-3xl space-y-8">
        {/* Publish Section */}
        <section className="border rounded-lg p-6 bg-white shadow-sm">
          <h2 className="text-2xl font-semibold mb-4">Publish</h2>
          <p className="text-gray-600 mb-6">
            로컬 노트를 읽기 전용 웹사이트로 배포하세요. Vercel을 통해 무료로 publish할 수 있습니다.
          </p>

          <div className="space-y-4">
            {/* Vercel Connection Status */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">Vercel 연동 상태</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {vercelLoading
                      ? "확인 중..."
                      : vercelConnected
                        ? "Vercel 계정이 연동되었습니다"
                        : "Vercel 계정 연동이 필요합니다"}
                  </p>
                  {vercelConnected && vercelConnectedAt && (
                    <p className="text-xs text-gray-500 mt-1">
                      연동 날짜: {formatDate(vercelConnectedAt)}
                    </p>
                  )}
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  vercelConnected
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-200 text-gray-700"
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

            {/* GitHub Connection Status */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">GitHub 연동 상태</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {githubLoading
                      ? "확인 중..."
                      : githubConnected
                        ? `GitHub 계정이 연동되었습니다${githubUsername ? ` (@${githubUsername})` : ""}`
                        : "GitHub 계정 연동이 필요합니다"}
                  </p>
                  {githubConnected && githubConnectedAt && (
                    <p className="text-xs text-gray-500 mt-1">
                      연동 날짜: {formatDate(githubConnectedAt)}
                    </p>
                  )}
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  githubConnected
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-200 text-gray-700"
                }`}>
                  {githubConnected ? "연동됨" : "미연동"}
                </div>
              </div>
              {!githubLoading && (
                <div className="mt-4">
                  {!githubConnected ? (
                    <Button
                      onClick={handleConnectGitHub}
                      variant="outline"
                      className="cursor-pointer"
                    >
                      GitHub 연동하기
                    </Button>
                  ) : (
                    <Button
                      onClick={handleDisconnectGitHub}
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
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">배포 상태</h3>
                  {deploymentLoading ? (
                    <p className="text-sm text-gray-600 mt-1">확인 중...</p>
                  ) : !deploymentStatus?.hasDeployment ? (
                    <p className="text-sm text-gray-600 mt-1">아직 배포되지 않았습니다</p>
                  ) : deploymentStatus.status === 'READY' ? (
                    <>
                      <p className="text-sm text-green-600 mt-1">배포 완료</p>
                      {deploymentStatus.url && (
                        <a
                          href={deploymentStatus.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline mt-1 block"
                        >
                          {deploymentStatus.url}
                        </a>
                      )}
                      {deploymentStatus.createdAt && (
                        <p className="text-xs text-gray-500 mt-1">
                          마지막 배포: {formatDate(new Date(deploymentStatus.createdAt).toISOString())}
                        </p>
                      )}
                    </>
                  ) : deploymentStatus.status === 'BUILDING' ? (
                    <>
                      <p className="text-sm text-blue-600 mt-1">빌드 중...</p>
                      {deploymentStatus.createdAt && (
                        <p className="text-xs text-gray-500 mt-1">
                          시작 시간: {formatDate(new Date(deploymentStatus.createdAt).toISOString())}
                        </p>
                      )}
                    </>
                  ) : deploymentStatus.status === 'QUEUED' ? (
                    <p className="text-sm text-yellow-600 mt-1">대기 중...</p>
                  ) : deploymentStatus.status === 'ERROR' ? (
                    <>
                      <p className="text-sm text-red-600 mt-1">배포 실패</p>
                      {deploymentStatus.createdAt && (
                        <p className="text-xs text-gray-500 mt-1">
                          실패 시간: {formatDate(new Date(deploymentStatus.createdAt).toISOString())}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-600 mt-1">상태 확인 불가</p>
                  )}
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  !deploymentStatus?.hasDeployment
                    ? "bg-gray-200 text-gray-700"
                    : deploymentStatus.status === 'READY'
                      ? "bg-green-100 text-green-700"
                      : deploymentStatus.status === 'BUILDING'
                        ? "bg-blue-100 text-blue-700"
                        : deploymentStatus.status === 'QUEUED'
                          ? "bg-yellow-100 text-yellow-700"
                          : deploymentStatus.status === 'ERROR'
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-200 text-gray-700"
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

            {/* Publish Button */}
            <div className="pt-4">
              <Button
                onClick={handlePublish}
                disabled={isPublishing || !vercelConnected || !githubConnected}
                className="cursor-pointer w-full sm:w-auto"
                size="lg"
              >
                {isPublishing ? "Publishing..." : "Publish to Vercel"}
              </Button>
              <p className="text-sm text-gray-500 mt-2">
                {!vercelConnected
                  ? "Vercel 연동 후 publish할 수 있습니다"
                  : !githubConnected
                    ? "GitHub 연동 후 publish할 수 있습니다"
                    : "GitHub에 코드를 push하고 Vercel에 자동 배포합니다"}
              </p>
            </div>
          </div>
        </section>

        {/* General Settings Section (Placeholder) */}
        <section className="border rounded-lg p-6 bg-white shadow-sm">
          <h2 className="text-2xl font-semibold mb-4">일반 설정</h2>
          <p className="text-gray-600">
            추가 설정 항목은 곧 추가될 예정입니다.
          </p>
        </section>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="container mx-auto py-8 px-4">Loading...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
