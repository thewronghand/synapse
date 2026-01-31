"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Mic, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FolderTabs } from "@/components/ui/FolderTabs";
import AppHeader from "@/components/layout/AppHeader";
import { LoadingScreen } from "@/components/ui/spinner";
import { VoiceMemoCard } from "@/components/voice-memo/VoiceMemoCard";
import { VoiceMemoDetailDialog } from "@/components/voice-memo/VoiceMemoDetailDialog";
import { PhraseSetManageDialog } from "@/components/voice-memo/PhraseSetManageDialog";
import { useRecording } from "@/components/voice-memo/RecordingProvider";
import type { VoiceMemoMeta } from "@/types";

function VoiceMemosContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { startRecording } = useRecording();

  const [memos, setMemos] = useState<VoiceMemoMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [detailMemo, setDetailMemo] = useState<VoiceMemoMeta | null>(null);
  const [phraseSetDialogOpen, setPhraseSetDialogOpen] = useState(false);
  const [selectedPhraseSetName, setSelectedPhraseSetName] = useState<
    string | null
  >(null);

  // 선택된 구문 세트 이름 조회
  const fetchPhraseSetName = useCallback(async () => {
    try {
      const res = await fetch("/api/phrase-sets");
      const data = await res.json();
      if (data.success && data.data.selectedId) {
        const selected = data.data.phraseSets.find(
          (ps: { id: string; name: string }) => ps.id === data.data.selectedId
        );
        setSelectedPhraseSetName(selected?.name ?? null);
      } else {
        setSelectedPhraseSetName(null);
      }
    } catch {
      // 무시
    }
  }, []);

  useEffect(() => {
    fetchPhraseSetName();
  }, [fetchPhraseSetName]);

  // URL 파라미터에서 폴더 읽기
  useEffect(() => {
    const folderParam = searchParams.get("folder");
    if (folderParam) {
      setSelectedFolder(decodeURIComponent(folderParam));
    } else {
      setSelectedFolder(null);
    }
  }, [searchParams]);

  // 메모 목록 조회
  useEffect(() => {
    fetchMemos();
  }, [selectedFolder]);

  async function fetchMemos() {
    setIsLoading(true);
    try {
      const folderParam = selectedFolder
        ? `?folder=${encodeURIComponent(selectedFolder)}`
        : "";
      const res = await fetch(`/api/voice-memos${folderParam}`);
      const data = await res.json();

      if (data.success) {
        setMemos(data.data.memos);
      }
    } catch (err) {
      console.error("[VoiceMemos] 목록 조회 실패:", err);
    } finally {
      setIsLoading(false);
    }
  }

  function handleFolderChange(folder: string | null) {
    const params = new URLSearchParams();
    if (folder) {
      params.set("folder", encodeURIComponent(folder));
    }
    const queryString = params.toString();
    router.push(queryString ? `/voice-memos?${queryString}` : "/voice-memos");
  }

  function handleProcess(memo: VoiceMemoMeta) {
    setDetailMemo(memo);
  }

  function handleDeleted(id: string) {
    setMemos((prev) => prev.filter((m) => m.id !== id));
  }

  function handleUpdated(updated: VoiceMemoMeta) {
    setMemos((prev) =>
      prev.map((m) => (m.id === updated.id ? updated : m))
    );
    // 상세 다이얼로그가 열려있으면 업데이트
    if (detailMemo?.id === updated.id) {
      setDetailMemo(updated);
    }
  }

  if (isLoading) {
    return <LoadingScreen message="음성 메모 로딩 중..." />;
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* 헤더 */}
      <div className="shrink-0 sticky top-0 z-10">
        <AppHeader
          showLogo
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setPhraseSetDialogOpen(true)}
                className="cursor-pointer"
              >
                <BookOpen className="h-4 w-4 mr-1" />
                {selectedPhraseSetName ?? "구문 세트"}
              </Button>
              <Button onClick={startRecording} className="cursor-pointer">
                <Mic className="h-4 w-4 mr-1" />
                새 녹음
              </Button>
            </div>
          }
          mobileMenuItems={[
            {
              label: selectedPhraseSetName ?? "구문 세트",
              icon: <BookOpen className="h-4 w-4" />,
              onClick: () => setPhraseSetDialogOpen(true),
            },
            {
              label: "새 녹음",
              icon: <Mic className="h-4 w-4" />,
              onClick: startRecording,
            },
          ]}
        />
      </div>

      {/* 본문 */}
      <main className="flex-1 container mx-auto p-4 space-y-4">
        {/* 폴더 탭 */}
        <FolderTabs
          selectedFolder={selectedFolder}
          onFolderChange={handleFolderChange}
        />

        {/* 메모 목록 */}
        {memos.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Mic className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium mb-1">음성 메모가 없습니다</p>
            <p className="text-sm">
              상단의 &quot;새 녹음&quot; 버튼으로 녹음을 시작해보세요.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {memos.map((memo) => (
              <VoiceMemoCard
                key={memo.id}
                memo={memo}
                showFolder={selectedFolder === null}
                onProcess={handleProcess}
                onDeleted={handleDeleted}
                onUpdated={handleUpdated}
              />
            ))}
          </div>
        )}
      </main>

      {/* 상세 다이얼로그 */}
      <VoiceMemoDetailDialog
        memo={detailMemo}
        open={detailMemo !== null}
        onClose={() => setDetailMemo(null)}
      />

      {/* 구문 세트 관리 다이얼로그 */}
      <PhraseSetManageDialog
        open={phraseSetDialogOpen}
        onOpenChange={setPhraseSetDialogOpen}
        onSelectionChange={setSelectedPhraseSetName}
      />
    </div>
  );
}

export default function VoiceMemosPage() {
  return (
    <Suspense fallback={<LoadingScreen message="음성 메모 로딩 중..." />}>
      <VoiceMemosContent />
    </Suspense>
  );
}
