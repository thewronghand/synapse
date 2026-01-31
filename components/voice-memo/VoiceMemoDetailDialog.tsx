"use client";

import { useState, useEffect } from "react";
import { Loader2, Pencil, Check, X } from "lucide-react";
import { AudioPlayer } from "@/components/ui/AudioPlayer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { VoiceMemoMeta } from "@/types";

interface VoiceMemoDetailDialogProps {
  memo: VoiceMemoMeta | null;
  open: boolean;
  onClose: () => void;
  onUpdated: (memo: VoiceMemoMeta) => void;
}

export function VoiceMemoDetailDialog({
  memo,
  open,
  onClose,
  onUpdated,
}: VoiceMemoDetailDialogProps) {
  const [editingField, setEditingField] = useState<
    "transcript" | "summary" | null
  >(null);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // 다이얼로그가 닫히거나 memo가 바뀌면 편집 상태 초기화
  useEffect(() => {
    if (!open) {
      setEditingField(null);
      setEditValue("");
    }
  }, [open, memo?.id]);

  if (!memo) return null;

  const audioSrc = `/api/audio/${encodeURIComponent(memo.folder)}/${encodeURIComponent(memo.filename)}`;

  const startEdit = (field: "transcript" | "summary") => {
    setEditingField(field);
    setEditValue(
      field === "transcript" ? memo.transcript ?? "" : memo.summary ?? ""
    );
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue("");
  };

  const saveEdit = async () => {
    if (!editingField) return;

    setIsSaving(true);
    try {
      const patchRes = await fetch(`/api/voice-memos/${memo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folder: memo.folder,
          [editingField]: editValue,
        }),
      });
      const patchData = await patchRes.json();

      if (!patchData.success) {
        throw new Error(patchData.error || "저장 실패");
      }

      toast.success(
        editingField === "transcript"
          ? "녹취록이 수정되었습니다"
          : "요약이 수정되었습니다"
      );
      onUpdated(patchData.data);
      setEditingField(null);
      setEditValue("");
    } catch (error) {
      console.error("[VoiceMemoDetail] 저장 실패:", error);
      toast.error(
        error instanceof Error ? error.message : "저장에 실패했습니다"
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">{memo.filename}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 오디오 플레이어 */}
          <AudioPlayer src={audioSrc} title={memo.filename} />

          {/* 요약 */}
          {memo.summary && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">요약</h3>
                {editingField !== "summary" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-muted-foreground cursor-pointer"
                    onClick={() => startEdit("summary")}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    편집
                  </Button>
                )}
              </div>
              {editingField === "summary" ? (
                <div className="space-y-2">
                  <textarea
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-full text-sm leading-relaxed whitespace-pre-wrap bg-muted/50 rounded-lg p-4 min-h-[120px] resize-y border border-border focus:outline-none focus:ring-2 focus:ring-ring"
                    disabled={isSaving}
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 cursor-pointer"
                      onClick={cancelEdit}
                      disabled={isSaving}
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      취소
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="h-7 cursor-pointer"
                      onClick={saveEdit}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5 mr-1" />
                      )}
                      저장
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-sm leading-relaxed whitespace-pre-wrap bg-muted/50 rounded-lg p-4">
                  {memo.summary}
                </div>
              )}
            </div>
          )}

          {/* 녹취록 */}
          {memo.transcript && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">녹취록</h3>
                {editingField !== "transcript" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-muted-foreground cursor-pointer"
                    onClick={() => startEdit("transcript")}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    편집
                  </Button>
                )}
              </div>
              {editingField === "transcript" ? (
                <div className="space-y-2">
                  <textarea
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-full text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap bg-muted/30 rounded-lg p-4 min-h-[200px] resize-y border border-border focus:outline-none focus:ring-2 focus:ring-ring"
                    disabled={isSaving}
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 cursor-pointer"
                      onClick={cancelEdit}
                      disabled={isSaving}
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      취소
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="h-7 cursor-pointer"
                      onClick={saveEdit}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5 mr-1" />
                      )}
                      저장
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap bg-muted/30 rounded-lg p-4 max-h-[300px] overflow-y-auto">
                  {memo.transcript}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
