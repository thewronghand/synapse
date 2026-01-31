"use client";

import { AudioPlayer } from "@/components/ui/AudioPlayer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { VoiceMemoMeta } from "@/types";

interface VoiceMemoDetailDialogProps {
  memo: VoiceMemoMeta | null;
  open: boolean;
  onClose: () => void;
}

export function VoiceMemoDetailDialog({
  memo,
  open,
  onClose,
}: VoiceMemoDetailDialogProps) {
  if (!memo) return null;

  const audioSrc = `/api/audio/${encodeURIComponent(memo.folder)}/${encodeURIComponent(memo.filename)}`;

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
              <h3 className="text-sm font-semibold">요약</h3>
              <div className="text-sm leading-relaxed whitespace-pre-wrap bg-muted/50 rounded-lg p-4">
                {memo.summary}
              </div>
            </div>
          )}

          {/* 녹취록 */}
          {memo.transcript && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">녹취록</h3>
              <div className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap bg-muted/30 rounded-lg p-4 max-h-[300px] overflow-y-auto">
                {memo.transcript}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
