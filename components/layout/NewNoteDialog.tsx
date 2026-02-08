"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface FolderInfo {
  name: string;
  noteCount: number;
}

interface NewNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewNoteDialog({ open, onOpenChange }: NewNoteDialogProps) {
  const router = useRouter();
  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      fetchFolders();
      setShowNewFolder(false);
      setNewFolderName("");
    }
  }, [open]);

  const fetchFolders = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/folders");
      const data = await res.json();
      if (data.success) {
        setFolders(data.data.folders);
      }
    } catch (error) {
      console.error("Failed to fetch folders:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFolder = (folderName: string) => {
    onOpenChange(false);
    router.push(`/editor/new?folder=${encodeURIComponent(folderName)}`);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFolderName.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        // 새 폴더로 바로 이동
        handleSelectFolder(newFolderName.trim());
      }
    } catch (error) {
      console.error("Failed to create folder:", error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>새 노트 만들기</DialogTitle>
          <DialogDescription>
            노트를 저장할 폴더를 선택하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {loading ? (
            <div className="text-center py-4 text-muted-foreground">
              로딩 중...
            </div>
          ) : (
            folders.map((folder) => (
              <button
                key={folder.name}
                onClick={() => handleSelectFolder(folder.name)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition-colors text-left"
              >
                <FolderOpen className="h-5 w-5 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate">{folder.name}</span>
                <span className="text-xs text-muted-foreground">
                  {folder.noteCount}개
                </span>
              </button>
            ))
          )}
        </div>

        {showNewFolder ? (
          <div className="flex gap-2 mt-2">
            <Input
              placeholder="폴더 이름"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFolder();
                if (e.key === "Escape") setShowNewFolder(false);
              }}
              autoFocus
            />
            <Button onClick={handleCreateFolder} disabled={creating}>
              {creating ? "생성 중..." : "생성"}
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full mt-2"
            onClick={() => setShowNewFolder(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            새 폴더 만들기
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
