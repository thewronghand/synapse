"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, MoreHorizontal, Pencil } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import type { ChatSessionMeta } from "@/types";

interface ChatSessionListProps {
  sessions: ChatSessionMeta[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, title: string) => void;
}

// 상대 시간 표시
function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;

  return date.toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}

export function ChatSessionList({
  sessions,
  activeSessionId,
  onSelect,
  onDelete,
  onCreate,
  onRename,
}: ChatSessionListProps) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  // 편집 모드 진입 시 input에 포커스
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  function startRename(session: ChatSessionMeta) {
    setEditingId(session.id);
    setEditTitle(session.title);
  }

  function handleRenameSubmit() {
    if (editingId && editTitle.trim()) {
      onRename(editingId, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle("");
  }

  function handleRenameKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleRenameSubmit();
    } else if (e.key === "Escape") {
      setEditingId(null);
      setEditTitle("");
    }
  }

  return (
    <>
      <div className="flex flex-col h-full">
        {/* 새 대화 버튼 */}
        <div className="p-3 border-b">
          <Button
            variant="outline"
            className="w-full cursor-pointer"
            onClick={onCreate}
          >
            <Plus className="h-4 w-4 mr-2" />새 대화
          </Button>
        </div>

        {/* 세션 목록 */}
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              대화가 없습니다
            </p>
          ) : (
            <div className="p-2 space-y-1">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={cn(
                    "group flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm cursor-pointer hover:bg-accent transition-colors",
                    activeSessionId === session.id && "bg-accent"
                  )}
                  onClick={() => {
                    if (editingId !== session.id) onSelect(session.id);
                  }}
                >
                  <div className="flex-1 min-w-0">
                    {editingId === session.id ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={handleRenameKeyDown}
                        onBlur={handleRenameSubmit}
                        className="w-full bg-background border rounded px-2 py-0.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <>
                        <p className="font-medium truncate">{session.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatRelativeTime(session.updatedAt)}
                        </p>
                      </>
                    )}
                  </div>

                  {editingId !== session.id && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            startRename(session);
                          }}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          이름 수정
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(session.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          삭제
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={() => setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>대화를 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              이 대화의 모든 메시지가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수
              없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer"
              onClick={() => {
                if (deleteTarget) {
                  onDelete(deleteTarget);
                  setDeleteTarget(null);
                }
              }}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
