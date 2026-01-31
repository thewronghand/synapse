"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ArrowLeft,
  Check,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm-provider";
import { toast } from "sonner";
import type { PhraseSet, PhraseSetStore } from "@/types";

interface PhraseSetManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectionChange?: (selectedName: string | null) => void;
}

export function PhraseSetManageDialog({
  open,
  onOpenChange,
  onSelectionChange,
}: PhraseSetManageDialogProps) {
  const confirm = useConfirm();

  const [store, setStore] = useState<PhraseSetStore>({
    phraseSets: [],
    selectedId: null,
  });
  const [loading, setLoading] = useState(false);

  // 편집 모드
  const [editingSet, setEditingSet] = useState<PhraseSet | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhrases, setEditPhrases] = useState("");
  const [saving, setSaving] = useState(false);

  // 데이터 로드
  const fetchStore = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/phrase-sets");
      const data = await res.json();
      if (data.success) {
        setStore(data.data);
      }
    } catch (err) {
      console.error("[PhraseSet] 조회 실패:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchStore();
  }, [open, fetchStore]);

  // 편집 모드 진입
  const startEdit = (ps: PhraseSet) => {
    setEditingSet(ps);
    setIsCreating(false);
    setEditName(ps.name);
    setEditPhrases(ps.phrases.join("\n"));
  };

  // 새로 만들기 모드 진입
  const startCreate = () => {
    setEditingSet(null);
    setIsCreating(true);
    setEditName("");
    setEditPhrases("");
  };

  // 편집/생성 모드 나가기
  const cancelEdit = () => {
    setEditingSet(null);
    setIsCreating(false);
  };

  // 저장 (생성 또는 수정)
  const handleSave = async () => {
    const name = editName.trim();
    if (!name) {
      toast.error("이름을 입력해주세요");
      return;
    }

    const phrases = editPhrases
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    if (phrases.length === 0) {
      toast.error("구문을 하나 이상 입력해주세요");
      return;
    }

    setSaving(true);
    try {
      if (isCreating) {
        const res = await fetch("/api/phrase-sets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, phrases }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        toast.success("구문 세트가 생성되었습니다");
      } else if (editingSet) {
        const res = await fetch(`/api/phrase-sets/${editingSet.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, phrases }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        toast.success("구문 세트가 수정되었습니다");
      }

      cancelEdit();
      await fetchStore();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "저장에 실패했습니다"
      );
    } finally {
      setSaving(false);
    }
  };

  // 삭제
  const handleDelete = async (ps: PhraseSet) => {
    const confirmed = await confirm({
      title: "구문 세트 삭제",
      description: `"${ps.name}" 구문 세트를 삭제하시겠습니까?`,
      confirmLabel: "삭제",
      variant: "destructive",
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/phrase-sets/${ps.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      toast.success("구문 세트가 삭제되었습니다");
      await fetchStore();

      // 삭제된 것이 선택된 것이었으면 알림
      if (store.selectedId === ps.id) {
        onSelectionChange?.(null);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "삭제에 실패했습니다"
      );
    }
  };

  // 선택/해제
  const handleSelect = async (id: string | null) => {
    try {
      const res = await fetch("/api/phrase-sets/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setStore((prev) => ({ ...prev, selectedId: id }));

      const selectedName = id
        ? store.phraseSets.find((ps) => ps.id === id)?.name ?? null
        : null;
      onSelectionChange?.(selectedName);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "선택 변경에 실패했습니다"
      );
    }
  };

  const isEditing = isCreating || editingSet !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? (
              <button
                onClick={cancelEdit}
                className="flex items-center gap-2 cursor-pointer hover:text-muted-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                {isCreating ? "새 구문 세트" : "구문 세트 편집"}
              </button>
            ) : (
              "구문 세트 관리"
            )}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "구문을 줄바꿈으로 구분하여 입력하세요"
              : "전사 시 인식 정확도를 높일 구문 목록을 관리합니다"}
          </DialogDescription>
        </DialogHeader>

        {isEditing ? (
          // 편집/생성 모드
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">이름</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="예: 빅스페이먼츠 용어"
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                구문 (줄바꿈으로 구분)
              </label>
              <textarea
                className="w-full min-h-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                value={editPhrases}
                onChange={(e) => setEditPhrases(e.target.value)}
                placeholder={"에브리페이\n빅스페이먼츠\nBIX Payments"}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={cancelEdit}
                className="cursor-pointer"
              >
                취소
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="cursor-pointer"
              >
                {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                저장
              </Button>
            </div>
          </div>
        ) : (
          // 목록 모드
          <div className="space-y-3">
            <Button
              variant="outline"
              size="sm"
              onClick={startCreate}
              className="w-full cursor-pointer"
            >
              <Plus className="h-4 w-4 mr-1.5" />새 구문 세트
            </Button>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : store.phraseSets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                구문 세트가 없습니다
              </p>
            ) : (
              <div className="space-y-2 max-h-[360px] overflow-y-auto">
                {store.phraseSets.map((ps) => {
                  const isSelected = store.selectedId === ps.id;
                  return (
                    <div
                      key={ps.id}
                      className={`border rounded-lg p-3 transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {/* 선택 라디오 */}
                        <button
                          onClick={() =>
                            handleSelect(isSelected ? null : ps.id)
                          }
                          className={`shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors ${
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground/30 hover:border-primary/50"
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </button>

                        <span className="text-sm font-medium flex-1 truncate">
                          {ps.name}
                        </span>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 cursor-pointer"
                          onClick={() => startEdit(ps)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 cursor-pointer text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(ps)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <p className="text-xs text-muted-foreground mt-1 ml-7 line-clamp-1">
                        {ps.phrases.join(", ")}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {store.selectedId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSelect(null)}
                className="w-full cursor-pointer text-muted-foreground"
              >
                선택 해제
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
