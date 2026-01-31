"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { VoiceMemoMeta } from "@/types";

interface InsertOptions {
  audio: boolean;
  transcript: boolean;
  summary: boolean;
  expanded: boolean;
}

interface VoiceMemoPickerDialogProps {
  open: boolean;
  folder: string;
  onOpenChange: (open: boolean) => void;
  onInsert: (memo: VoiceMemoMeta, options: InsertOptions) => void;
}

const STATUS_MAP = {
  recorded: { label: "녹음됨", variant: "secondary" as const },
  transcribed: { label: "전사됨", variant: "default" as const },
  summarized: { label: "요약됨", variant: "default" as const },
};

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
  });
}

export function VoiceMemoPickerDialog({
  open,
  folder,
  onOpenChange,
  onInsert,
}: VoiceMemoPickerDialogProps) {
  const [memos, setMemos] = useState<VoiceMemoMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMemo, setSelectedMemo] = useState<VoiceMemoMeta | null>(null);
  const [options, setOptions] = useState<InsertOptions>({
    audio: true,
    transcript: true,
    summary: true,
    expanded: false,
  });

  const fetchMemos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/voice-memos?folder=${encodeURIComponent(folder)}`
      );
      const data = await res.json();
      if (data.success) {
        // 전사됨 또는 요약됨 상태의 메모만 표시 (recorded는 삽입할 내용이 없음)
        setMemos(data.data.memos);
      }
    } catch (err) {
      console.error("[VoiceMemoPicker] 조회 실패:", err);
    } finally {
      setLoading(false);
    }
  }, [folder]);

  useEffect(() => {
    if (open) {
      fetchMemos();
      setSelectedMemo(null);
    }
  }, [open, fetchMemos]);

  const toggleOption = (key: keyof InsertOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleInsert = () => {
    if (!selectedMemo) return;
    onInsert(selectedMemo, options);
    onOpenChange(false);
  };

  const hasSelection = selectedMemo !== null;
  const hasAnyOption = options.audio || options.transcript || options.summary;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>음성 메모 삽입</DialogTitle>
          <DialogDescription>
            삽입할 음성 메모와 항목을 선택하세요
          </DialogDescription>
        </DialogHeader>

        {/* 메모 목록 */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : memos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            이 폴더에 음성 메모가 없습니다
          </p>
        ) : (
          <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
            {memos.map((memo) => {
              const isSelected = selectedMemo?.id === memo.id;
              const statusInfo = STATUS_MAP[memo.status];
              return (
                <button
                  key={memo.id}
                  onClick={() => setSelectedMemo(memo)}
                  className={`w-full text-left rounded-lg p-3 transition-colors cursor-pointer ${
                    isSelected
                      ? "border border-primary bg-primary/5"
                      : "border border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/30"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <span className="text-sm font-medium truncate flex-1">
                      {memo.filename}
                    </span>
                    <Badge variant={statusInfo.variant} className="text-xs shrink-0">
                      {statusInfo.label}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 ml-7">
                    {formatDuration(memo.duration)} · {formatDate(memo.createdAt)}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* 삽입 옵션 */}
        {hasSelection && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-sm font-medium">삽입할 항목</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={options.audio}
                onChange={() => toggleOption("audio")}
                className="rounded accent-primary"
              />
              <span className="text-sm">오디오 플레이어</span>
            </label>
            <label
              className={`flex items-center gap-2 ${
                selectedMemo?.transcript
                  ? "cursor-pointer"
                  : "opacity-40 cursor-not-allowed"
              }`}
            >
              <input
                type="checkbox"
                checked={options.transcript && !!selectedMemo?.transcript}
                onChange={() => toggleOption("transcript")}
                disabled={!selectedMemo?.transcript}
                className="rounded accent-primary"
              />
              <span className="text-sm">
                녹취록
                {!selectedMemo?.transcript && (
                  <span className="text-muted-foreground ml-1">(없음)</span>
                )}
              </span>
            </label>
            <label
              className={`flex items-center gap-2 ${
                selectedMemo?.summary
                  ? "cursor-pointer"
                  : "opacity-40 cursor-not-allowed"
              }`}
            >
              <input
                type="checkbox"
                checked={options.summary && !!selectedMemo?.summary}
                onChange={() => toggleOption("summary")}
                disabled={!selectedMemo?.summary}
                className="rounded accent-primary"
              />
              <span className="text-sm">
                요약
                {!selectedMemo?.summary && (
                  <span className="text-muted-foreground ml-1">(없음)</span>
                )}
              </span>
            </label>
            {/* 펼쳐짐 옵션 - 녹취록/요약 중 하나라도 선택 시 활성화 */}
            {(() => {
              const hasTextContent =
                (options.transcript && !!selectedMemo?.transcript) ||
                (options.summary && !!selectedMemo?.summary);
              return (
                <label
                  className={`flex items-center gap-2 pt-1 border-t border-dashed ${
                    hasTextContent
                      ? "cursor-pointer"
                      : "opacity-40 cursor-not-allowed"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={options.expanded && hasTextContent}
                    onChange={() => toggleOption("expanded")}
                    disabled={!hasTextContent}
                    className="rounded accent-primary"
                  />
                  <span className="text-sm">펼쳐짐</span>
                </label>
              );
            })()}
          </div>
        )}

        {/* 삽입 버튼 */}
        <div className="flex justify-end">
          <Button
            onClick={handleInsert}
            disabled={!hasSelection || !hasAnyOption}
            className="cursor-pointer"
          >
            삽입
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
