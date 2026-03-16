"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Mic, BookOpen, Search, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  // 검색, 필터, 정렬
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "recorded" | "transcribed" | "summarized">("all");
  type SortKey = "created-desc" | "created-asc" | "updated-desc" | "updated-asc" | "title-asc" | "title-desc" | "duration-desc" | "duration-asc";
  const [sortBy, setSortBy] = useState<SortKey>("created-desc");

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

  // 검색 + 필터 + 정렬 적용
  const processedMemos = useMemo(() => {
    let result = memos;

    // 상태 필터
    if (statusFilter !== "all") {
      result = result.filter((m) => m.status === statusFilter);
    }

    // 검색 (제목, 파일명, 전사 내용)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (m) =>
          (m.title?.toLowerCase().includes(q)) ||
          m.filename.toLowerCase().includes(q) ||
          (m.transcript?.toLowerCase().includes(q))
      );
    }

    // 정렬
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "created-desc":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "created-asc":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "updated-desc":
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case "updated-asc":
          return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        case "title-asc":
          return (a.title || a.filename).localeCompare(b.title || b.filename, "ko");
        case "title-desc":
          return (b.title || b.filename).localeCompare(a.title || a.filename, "ko");
        case "duration-desc":
          return b.duration - a.duration;
        case "duration-asc":
          return a.duration - b.duration;
        default:
          return 0;
      }
    });

    return result;
  }, [memos, searchQuery, statusFilter, sortBy]);

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

        {/* 검색 + 필터 + 정렬 */}
        {memos.length > 0 && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* 검색 */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="제목, 파일명, 녹취록 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* 상태 필터 */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm cursor-pointer"
            >
              <option value="all">전체 상태</option>
              <option value="recorded">녹음됨</option>
              <option value="transcribed">전사됨</option>
              <option value="summarized">요약됨</option>
            </select>

            {/* 정렬 */}
            <div className="flex items-center gap-1">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm cursor-pointer"
              >
                <option value="created-desc">최신순</option>
                <option value="created-asc">오래된순</option>
                <option value="updated-desc">수정 최신순</option>
                <option value="updated-asc">수정 오래된순</option>
                <option value="title-asc">제목 오름차순</option>
                <option value="title-desc">제목 내림차순</option>
                <option value="duration-desc">길이 긴순</option>
                <option value="duration-asc">길이 짧은순</option>
              </select>
            </div>
          </div>
        )}

        {/* 결과 카운트 */}
        {memos.length > 0 && (searchQuery || statusFilter !== "all") && (
          <p className="text-xs text-muted-foreground">
            {processedMemos.length}개 결과 (전체 {memos.length}개)
          </p>
        )}

        {/* 메모 목록 */}
        {memos.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Mic className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium mb-1">음성 메모가 없습니다</p>
            <p className="text-sm">
              상단의 &quot;새 녹음&quot; 버튼으로 녹음을 시작해보세요.
            </p>
          </div>
        ) : processedMemos.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">검색 결과가 없습니다</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {processedMemos.map((memo) => (
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
        onUpdated={handleUpdated}
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
