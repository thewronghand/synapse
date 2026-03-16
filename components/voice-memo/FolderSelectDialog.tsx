"use client";

import { useState, useEffect } from "react";
import { Folder, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface FolderSelectDialogProps {
  open: boolean;
  onSelect: (folder: string, title?: string) => void;
  onCancel: () => void;
}

interface FolderInfo {
  name: string;
  noteCount: number;
}

export function FolderSelectDialog({
  open,
  onSelect,
  onCancel,
}: FolderSelectDialogProps) {
  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (!open) {
      setTitle("");
      return;
    }

    setLoading(true);
    fetch("/api/folders")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setFolders(data.data.folders);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle>녹음 저장 폴더 선택</DialogTitle>
          <DialogDescription>
            녹음 파일이 저장될 폴더를 선택하세요
          </DialogDescription>
        </DialogHeader>

        {/* 녹음 제목 입력 */}
        <div className="px-1">
          <label className="text-sm font-medium text-muted-foreground">녹음 제목 (선택)</label>
          <Input
            placeholder="제목을 입력하지 않으면 자동 생성됩니다"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1"
          />
        </div>

        <div className="space-y-1 max-h-[300px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            folders.map((folder) => (
              <Button
                key={folder.name}
                variant="ghost"
                className="w-full justify-start gap-2 h-auto py-3 cursor-pointer"
                onClick={() => onSelect(folder.name, title.trim() || undefined)}
              >
                <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="font-medium">{folder.name}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {folder.noteCount}개 노트
                </span>
              </Button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
