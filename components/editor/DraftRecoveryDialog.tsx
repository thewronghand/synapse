"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Clock } from "lucide-react";
import type { Draft } from "@/app/api/drafts/route";

interface DraftRecoveryDialogProps {
  open: boolean;
  draft: Draft;
  onRecover: () => void;
  onDiscard: () => void;
}

export function DraftRecoveryDialog({
  open,
  draft,
  onRecover,
  onDiscard,
}: DraftRecoveryDialogProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDiscard()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-amber-500" />
            저장되지 않은 드래프트 발견
          </DialogTitle>
          <DialogDescription>
            이전에 작업하던 내용이 자동 저장되어 있습니다. 복구하시겠습니까?
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
          <Clock className="h-4 w-4" />
          <span>마지막 저장: {formatDate(draft.lastSaved)}</span>
        </div>

        {draft.title && (
          <div className="text-sm">
            <span className="text-muted-foreground">제목: </span>
            <span className="font-medium">{draft.title}</span>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onDiscard}>
            무시하기
          </Button>
          <Button onClick={onRecover}>
            복구하기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
