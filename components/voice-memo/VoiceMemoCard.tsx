"use client";

import { useState } from "react";
import { Loader2, FileText, Sparkles, Trash2, Play, Pause, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/ui/confirm-provider";
import { toast } from "sonner";
import type { VoiceMemoMeta } from "@/types";

interface VoiceMemoCardProps {
  memo: VoiceMemoMeta;
  showFolder?: boolean;
  onProcess: (memo: VoiceMemoMeta) => void;
  onDeleted: (id: string) => void;
  onUpdated: (memo: VoiceMemoMeta) => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_MAP = {
  recorded: { label: "녹음됨", variant: "secondary" as const },
  transcribed: { label: "전사됨", variant: "default" as const },
  summarized: { label: "요약됨", variant: "default" as const },
};

export function VoiceMemoCard({
  memo,
  showFolder = false,
  onProcess,
  onDeleted,
  onUpdated,
}: VoiceMemoCardProps) {
  const confirm = useConfirm();
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const audioSrc = `/api/audio/${encodeURIComponent(memo.folder)}/${encodeURIComponent(memo.filename)}`;
  const statusInfo = STATUS_MAP[memo.status];

  // 간단 재생/정지
  const togglePlay = () => {
    if (isPlaying && audioEl) {
      audioEl.pause();
      setIsPlaying(false);
      return;
    }

    const audio = new Audio(audioSrc);
    audio.onended = () => setIsPlaying(false);
    audio.play();
    setAudioEl(audio);
    setIsPlaying(true);
  };

  // 전사
  const handleTranscribe = async () => {
    setIsTranscribing(true);
    try {
      // 오디오 파일 가져오기
      const audioRes = await fetch(audioSrc);
      const blob = await audioRes.blob();
      const file = new File([blob], memo.filename, { type: blob.type });

      const formData = new FormData();
      formData.append("audio", file);

      const transcribeRes = await fetch("/api/ai/transcribe", {
        method: "POST",
        body: formData,
      });
      const transcribeData = await transcribeRes.json();

      if (!transcribeData.success) {
        throw new Error(transcribeData.error || "전사 실패");
      }

      // 메타데이터 업데이트
      const patchRes = await fetch(`/api/voice-memos/${memo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folder: memo.folder,
          transcript: transcribeData.data.transcript,
          status: "transcribed",
        }),
      });
      const patchData = await patchRes.json();

      if (!patchData.success) {
        throw new Error(patchData.error || "업데이트 실패");
      }

      toast.success("전사가 완료되었습니다");
      onUpdated(patchData.data);
    } catch (error) {
      console.error("[VoiceMemo] 전사 실패:", error);
      toast.error(
        error instanceof Error ? error.message : "전사에 실패했습니다"
      );
    } finally {
      setIsTranscribing(false);
    }
  };

  // 요약
  const handleSummarize = async () => {
    if (!memo.transcript) return;

    setIsSummarizing(true);
    try {
      const summarizeRes = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: memo.transcript }),
      });
      const summarizeData = await summarizeRes.json();

      if (!summarizeData.success) {
        throw new Error(summarizeData.error || "요약 실패");
      }

      const patchRes = await fetch(`/api/voice-memos/${memo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folder: memo.folder,
          summary: summarizeData.data.summary,
          status: "summarized",
        }),
      });
      const patchData = await patchRes.json();

      if (!patchData.success) {
        throw new Error(patchData.error || "업데이트 실패");
      }

      toast.success("요약이 완료되었습니다");
      onUpdated(patchData.data);
    } catch (error) {
      console.error("[VoiceMemo] 요약 실패:", error);
      toast.error(
        error instanceof Error ? error.message : "요약에 실패했습니다"
      );
    } finally {
      setIsSummarizing(false);
    }
  };

  // 삭제
  const handleDelete = async () => {
    const confirmed = await confirm({
      title: "음성 메모 삭제",
      description: "이 음성 메모를 삭제하시겠습니까? 오디오 파일도 함께 삭제됩니다.",
      confirmLabel: "삭제",
      variant: "destructive",
    });

    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/voice-memos/${memo.id}?folder=${encodeURIComponent(memo.folder)}`,
        { method: "DELETE" }
      );
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "삭제 실패");
      }

      toast.success("음성 메모가 삭제되었습니다");
      onDeleted(memo.id);
    } catch (error) {
      console.error("[VoiceMemo] 삭제 실패:", error);
      toast.error(
        error instanceof Error ? error.message : "삭제에 실패했습니다"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="border border-border rounded-lg p-4 space-y-3 bg-card">
      {/* 상단: 재생 + 정보 */}
      <div className="flex items-start gap-3">
        <Button
          variant="outline"
          size="icon"
          className="shrink-0 h-10 w-10 rounded-full cursor-pointer"
          onClick={togglePlay}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4 ml-0.5" />
          )}
        </Button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">
              {memo.filename}
            </span>
            <Badge variant={statusInfo.variant} className="text-xs shrink-0">
              {statusInfo.label}
            </Badge>
            {showFolder && (
              <Badge variant="outline" className="text-xs shrink-0">
                {memo.folder}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            <span>{formatDuration(memo.duration)}</span>
            <span>{formatDate(memo.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* 녹취록 미리보기 */}
      {memo.transcript && (
        <button
          onClick={() => onProcess(memo)}
          className="w-full text-left text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2 line-clamp-2 hover:bg-muted transition-colors cursor-pointer"
        >
          {memo.transcript}
        </button>
      )}

      {/* 액션 버튼 */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* 전사하기 / 재전사 */}
        {memo.status === "recorded" ? (
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={handleTranscribe}
            disabled={isTranscribing}
          >
            {isTranscribing ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <FileText className="h-3.5 w-3.5 mr-1.5" />
            )}
            전사하기
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="cursor-pointer"
            onClick={handleTranscribe}
            disabled={isTranscribing}
          >
            {isTranscribing ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            )}
            재전사
          </Button>
        )}

        {/* 요약하기 / 재요약 */}
        {memo.status === "transcribed" && (
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={handleSummarize}
            disabled={isSummarizing}
          >
            {isSummarizing ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            )}
            요약하기
          </Button>
        )}

        {memo.status === "summarized" && (
          <Button
            variant="ghost"
            size="sm"
            className="cursor-pointer"
            onClick={handleSummarize}
            disabled={isSummarizing}
          >
            {isSummarizing ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            )}
            재요약
          </Button>
        )}

        {/* 상세 보기 */}
        {(memo.status === "transcribed" || memo.status === "summarized") && (
          <Button
            variant="ghost"
            size="sm"
            className="cursor-pointer"
            onClick={() => onProcess(memo)}
          >
            상세 보기
          </Button>
        )}

        <div className="ml-auto">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 cursor-pointer text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
