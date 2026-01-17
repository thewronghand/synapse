"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Plus, X, Check, Pencil } from "lucide-react";
import { isPublishedMode } from "@/lib/env";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-provider";

interface FolderInfo {
  name: string;
  noteCount: number;
}

interface FolderTabsProps {
  selectedFolder: string | null; // null means "all"
  onFolderChange: (folder: string | null) => void;
  className?: string;
  hideAllTab?: boolean; // Hide "전체" tab (useful for graph view)
}

export function FolderTabs({
  selectedFolder,
  onFolderChange,
  className,
  hideAllTab = false,
}: FolderTabsProps) {
  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Folder management states
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false); // Prevent double submission
  const newFolderInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const confirm = useConfirm();
  const published = isPublishedMode();

  async function fetchFolders() {
    try {
      const res = await fetch("/api/folders");
      const data = await res.json();
      if (data.success) {
        setFolders(data.data.folders);
        const total = data.data.folders.reduce(
          (sum: number, f: FolderInfo) => sum + f.noteCount,
          0
        );
        setTotalCount(total);
      }
    } catch (error) {
      console.error("Failed to fetch folders:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFolders();
  }, []);

  // Auto-select first folder when hideAllTab is true and no folder selected
  useEffect(() => {
    if (hideAllTab && selectedFolder === null && folders.length > 0 && !loading) {
      onFolderChange(folders[0].name);
    }
  }, [hideAllTab, selectedFolder, folders, loading, onFolderChange]);

  useEffect(() => {
    if (isCreating && newFolderInputRef.current) {
      newFolderInputRef.current.focus();
    }
  }, [isCreating]);

  useEffect(() => {
    if (editingFolder && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingFolder]);

  async function handleCreateFolder() {
    if (isSubmitting) return; // Prevent double submission

    const name = newFolderName.trim();
    if (!name) {
      setIsCreating(false);
      setNewFolderName("");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();

      if (data.success) {
        await fetchFolders();
        onFolderChange(name);
        toast.success("폴더가 생성되었습니다");
      } else {
        toast.error(data.error || "폴더 생성 실패");
      }
    } catch (error) {
      console.error("Failed to create folder:", error);
      toast.error("폴더 생성 중 오류가 발생했습니다");
    } finally {
      setIsCreating(false);
      setNewFolderName("");
      setIsSubmitting(false);
    }
  }

  async function handleRenameFolder(oldName: string) {
    if (isSubmitting) return; // Prevent double submission

    const newName = editingName.trim();
    if (!newName || newName === oldName) {
      setEditingFolder(null);
      setEditingName("");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/folders/${encodeURIComponent(oldName)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newName }),
      });
      const data = await res.json();

      if (data.success) {
        await fetchFolders();
        if (selectedFolder === oldName) {
          onFolderChange(newName);
        }
        toast.success("폴더 이름이 변경되었습니다");
      } else {
        toast.error(data.error || "폴더 이름 변경 실패");
      }
    } catch (error) {
      console.error("Failed to rename folder:", error);
      toast.error("폴더 이름 변경 중 오류가 발생했습니다");
    } finally {
      setEditingFolder(null);
      setEditingName("");
      setIsSubmitting(false);
    }
  }

  async function handleDeleteFolder(name: string) {
    const folder = folders.find(f => f.name === name);
    const noteCount = folder?.noteCount || 0;

    const confirmed = await confirm({
      title: "폴더 삭제",
      description: noteCount > 0 ? (
        <>
          <strong>&quot;{name}&quot;</strong> 폴더와 그 안의{" "}
          <strong>{noteCount}개 노트</strong>를 모두 삭제합니다.
          <br /><br />
          이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?
        </>
      ) : (
        <>
          <strong>&quot;{name}&quot;</strong> 폴더를 삭제합니다.
          <br /><br />
          계속하시겠습니까?
        </>
      ),
      confirmLabel: "삭제",
      variant: "destructive",
    });

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/folders/${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.success) {
        // Change folder first before refreshing list to avoid showing deleted folder
        if (selectedFolder === name) {
          onFolderChange(null);
        }
        await fetchFolders();
        toast.success("폴더가 삭제되었습니다");
      } else {
        toast.error(data.error || "폴더 삭제 실패");
      }
    } catch (error) {
      console.error("Failed to delete folder:", error);
      toast.error("폴더 삭제 중 오류가 발생했습니다");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent, action: () => void) {
    if (e.key === "Enter") {
      e.preventDefault();
      action();
    } else if (e.key === "Escape") {
      setIsCreating(false);
      setNewFolderName("");
      setEditingFolder(null);
      setEditingName("");
    }
  }

  if (loading) {
    return (
      <div className={cn("flex gap-1 border-b items-center", className)}>
        <div className="px-4 py-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner size="sm" />
          <span>폴더 로딩 중...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-1 border-b overflow-x-auto overflow-y-hidden items-center", className)}>
      {/* All tab (hidden when hideAllTab is true) */}
      {!hideAllTab && (
        <button
          onClick={() => onFolderChange(null)}
          className={cn(
            "px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors",
            "border-b-2 -mb-px cursor-pointer",
            selectedFolder === null
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50"
          )}
        >
          전체
          <span className="ml-1.5 text-xs text-muted-foreground">
            ({totalCount})
          </span>
        </button>
      )}

      {/* Folder tabs */}
      {folders.map((folder) => (
        <div
          key={folder.name}
          className={cn(
            "group relative flex items-center",
            "border-b-2 -mb-px",
            selectedFolder === folder.name
              ? "border-primary"
              : "border-transparent"
          )}
        >
          {editingFolder === folder.name ? (
            // Edit mode
            <div className="flex items-center gap-1 px-2 py-1">
              <input
                ref={editInputRef}
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, () => handleRenameFolder(folder.name))}
                onBlur={() => handleRenameFolder(folder.name)}
                className="w-24 px-2 py-1 text-sm border rounded bg-background"
              />
            </div>
          ) : (
            // Normal mode
            <>
              <button
                onClick={() => onFolderChange(folder.name)}
                onDoubleClick={() => {
                  if (!published && folder.name !== "default") {
                    setEditingFolder(folder.name);
                    setEditingName(folder.name);
                  }
                }}
                className={cn(
                  "px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors cursor-pointer",
                  selectedFolder === folder.name
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {folder.name}
                <span className="ml-1.5 text-xs text-muted-foreground">
                  ({folder.noteCount})
                </span>
              </button>

              {/* Edit & Delete buttons (hidden in published mode, not for default folder) */}
              {!published && folder.name !== "default" && (
                <div className="flex items-center gap-0.5 pr-1 max-w-0 overflow-hidden opacity-0 group-hover:max-w-[60px] group-hover:opacity-100 transition-all duration-200 ease-out">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingFolder(folder.name);
                      setEditingName(folder.name);
                    }}
                    className="p-1 text-muted-foreground hover:text-foreground rounded cursor-pointer"
                    title="이름 변경"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFolder(folder.name);
                    }}
                    className="p-1 text-muted-foreground hover:text-destructive rounded cursor-pointer"
                    title="폴더 삭제"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ))}

      {/* New folder input or button */}
      {!published && (
        <>
          {isCreating ? (
            <div className="flex items-center gap-1 px-2 py-1">
              <input
                ref={newFolderInputRef}
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, handleCreateFolder)}
                onBlur={handleCreateFolder}
                placeholder="폴더 이름"
                className="w-24 px-2 py-1 text-sm border rounded bg-background"
              />
            </div>
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="새 폴더"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </>
      )}

    </div>
  );
}
