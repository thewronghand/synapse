"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Trash2, RotateCcw, Clock } from "lucide-react";
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

interface TrashItem {
  filename: string;
  title: string;
  deletedAt: string;
  daysRemaining: number;
}

export function TrashManager() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [restoringItem, setRestoringItem] = useState<string | null>(null);
  const [deletingItem, setDeletingItem] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TrashItem | null>(null);

  const fetchTrash = useCallback(async () => {
    try {
      const res = await fetch("/api/trash");
      const data = await res.json();
      if (data.success) {
        setItems(data.data.items);
      }
    } catch (error) {
      console.error("[TrashManager] Fetch error:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrash();
  }, [fetchTrash]);

  async function handleRestore(item: TrashItem) {
    setRestoringItem(item.filename);
    try {
      const res = await fetch("/api/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: item.filename }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success(`"${item.title}" 문서가 복구되었습니다.`);
        setItems((prev) => prev.filter((i) => i.filename !== item.filename));
      } else {
        toast.error(data.error || "복구 실패");
      }
    } catch (error) {
      console.error("[TrashManager] Restore error:", error);
      toast.error("복구 중 오류가 발생했습니다.");
    } finally {
      setRestoringItem(null);
    }
  }

  async function handleDelete(item: TrashItem) {
    setDeletingItem(item.filename);
    setConfirmDelete(null);
    try {
      const res = await fetch(`/api/trash?filename=${encodeURIComponent(item.filename)}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.success) {
        toast.success(`"${item.title}" 문서가 영구 삭제되었습니다.`);
        setItems((prev) => prev.filter((i) => i.filename !== item.filename));
      } else {
        toast.error(data.error || "삭제 실패");
      }
    } catch (error) {
      console.error("[TrashManager] Delete error:", error);
      toast.error("삭제 중 오류가 발생했습니다.");
    } finally {
      setDeletingItem(null);
    }
  }

  function formatDate(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Spinner size="sm" />
        <span>휴지통 로딩 중...</span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Trash2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p>휴지통이 비어있습니다.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.filename}
            className="flex items-center justify-between p-3 bg-muted rounded-lg"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{item.title}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                <span>삭제: {formatDate(item.deletedAt)}</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {item.daysRemaining}일 후 영구 삭제
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRestore(item)}
                disabled={restoringItem === item.filename || deletingItem === item.filename}
                className="cursor-pointer"
              >
                {restoringItem === item.filename ? (
                  <Spinner size="sm" />
                ) : (
                  <>
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    복구
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(item)}
                disabled={restoringItem === item.filename || deletingItem === item.filename}
                className="text-destructive hover:text-destructive cursor-pointer"
              >
                {deletingItem === item.filename ? (
                  <Spinner size="sm" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* 영구 삭제 확인 다이얼로그 */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>영구 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{confirmDelete?.title}&quot; 문서를 영구적으로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              영구 삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
