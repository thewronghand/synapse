"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MarkdownEditor from "@/components/editor/MarkdownEditor";
import MarkdownViewer from "@/components/editor/MarkdownViewer";
import { DraftRecoveryDialog } from "@/components/editor/DraftRecoveryDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TagInput } from "@/components/ui/tag-input";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { LoadingScreen } from "@/components/ui/spinner";
import { Folder, ArrowLeft } from "lucide-react";
import { useBeforeUnload } from "@/hooks/useBeforeUnload";
import { useNavigationGuard } from "@/contexts/NavigationGuardContext";
import type { Draft } from "@/app/api/drafts/route";

// 파일 시스템 금지 문자
const FORBIDDEN_CHARS = /[/\\:*?"<>|]/;
const FORBIDDEN_CHARS_MESSAGE = '제목에 다음 문자는 사용할 수 없습니다: / \\ : * ? " < > |';

// 새 문서용 드래프트 slug 생성 (세션별 고유 ID)
const NEW_DRAFT_PREFIX = "new-draft";

function NewNotePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTitle = searchParams.get("title") || "";
  const folder = searchParams.get("folder") || "default";
  const [title, setTitle] = useState(initialTitle);
  const [tags, setTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [existingTitles, setExistingTitles] = useState<string[]>([]);
  const [content, setContent] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirtyLocal, setIsDirtyLocal] = useState(false);

  // Navigation guard context
  const { setIsDirty: setIsDirtyContext, confirmNavigation } = useNavigationGuard();

  // Sync local dirty state with context
  const setIsDirty = useCallback((dirty: boolean) => {
    setIsDirtyLocal(dirty);
    setIsDirtyContext(dirty);
  }, [setIsDirtyContext]);

  // 드래프트 관련 상태
  const draftSlugRef = useRef<string>(NEW_DRAFT_PREFIX);
  const draftTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [pendingDraft, setPendingDraft] = useState<Draft | null>(null);
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  const [isCheckingDraft, setIsCheckingDraft] = useState(true);

  // 페이지 이탈 경고
  useBeforeUnload(isDirtyLocal);

  // 드래프트 저장 함수
  const saveDraft = useCallback(async () => {
    // 내용이 없으면 저장하지 않음
    const frontmatterRegex = /^---\n[\s\S]*?\n---\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);
    const bodyContent = match ? match[1].trim() : content.trim();

    if (!title.trim() && !bodyContent) return;

    const draft: Draft = {
      slug: draftSlugRef.current,
      title: title,
      content: bodyContent,
      tags: tags,
      folder,
      lastSaved: new Date().toISOString(),
    };

    try {
      await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
    } catch (err) {
      console.error("Failed to save draft:", err);
    }
  }, [content, title, tags, folder]);

  // 드래프트 삭제 함수
  const deleteDraft = useCallback(async () => {
    try {
      await fetch(`/api/drafts?slug=${encodeURIComponent(draftSlugRef.current)}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.error("Failed to delete draft:", err);
    }
  }, []);

  // 드래프트 저장 트리거 (5초 디바운스)
  const triggerDraftSave = useCallback(() => {
    if (draftTimeoutRef.current) {
      clearTimeout(draftTimeoutRef.current);
    }
    draftTimeoutRef.current = setTimeout(() => {
      saveDraft();
    }, 5000);
  }, [saveDraft]);

  // 초기 드래프트 확인
  useEffect(() => {
    async function checkForDraft() {
      try {
        const res = await fetch(`/api/drafts?slug=${encodeURIComponent(NEW_DRAFT_PREFIX)}`);
        const data = await res.json();
        // draft가 null이 아니고 slug가 있으면 드래프트 존재
        const draftData = data.draft === null ? null : data.slug ? data : null;
        if (draftData && (draftData.title || draftData.content)) {
          setPendingDraft(draftData);
          setShowDraftDialog(true);
        }
      } catch (err) {
        console.error("Failed to check draft:", err);
      } finally {
        setIsCheckingDraft(false);
      }
    }
    checkForDraft();
  }, []);

  // Fetch available tags and existing titles (folder-scoped)
  useEffect(() => {
    async function fetchTagsAndTitles() {
      try {
        const folderParam = folder ? `?folder=${encodeURIComponent(folder)}` : "";
        const [tagsRes, titlesRes] = await Promise.all([
          fetch(`/api/tags${folderParam}`),
          fetch(`/api/documents/titles${folderParam}`),
        ]);
        const tagsData = await tagsRes.json();
        const titlesData = await titlesRes.json();

        if (tagsData.success) {
          setAvailableTags(tagsData.data.tags);
        }
        if (titlesData.success) {
          setExistingTitles(titlesData.data.titles || []);
        }
      } catch (err) {
        console.error("Failed to fetch tags/titles:", err);
      }
    }
    fetchTagsAndTitles();
  }, [folder]);

  // Initialize content with frontmatter on first title input
  useEffect(() => {
    if (title.trim() && !isInitialized && !content.trim()) {
      const tagsYaml = tags.length > 0 ? `[${tags.map(t => `"${t}"`).join(", ")}]` : "[]";
      const initialContent = `---
title: ${title}
tags: ${tagsYaml}
---

`;
      setContent(initialContent);
      setIsInitialized(true);
    }
  }, [title, tags, isInitialized, content]);

  // Update frontmatter when title or tags change (preserving body content)
  useEffect(() => {
    if (!title.trim()) return;

    // If content exists but not initialized yet, add frontmatter to existing content
    if (!isInitialized && content.trim()) {
      const tagsYaml = tags.length > 0 ? `[${tags.map(t => `"${t}"`).join(", ")}]` : "[]";
      const newContent = `---
title: ${title}
tags: ${tagsYaml}
---

${content}`;
      setContent(newContent);
      setIsInitialized(true);
      return;
    }

    if (!isInitialized) return;

    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (match) {
      const bodyContent = match[2]; // Everything after frontmatter
      const tagsYaml = tags.length > 0 ? `[${tags.map(t => `"${t}"`).join(", ")}]` : "[]";

      const newContent = `---
title: ${title}
tags: ${tagsYaml}
---
${bodyContent}`;

      setContent(newContent);
    }
  }, [title, tags]);

  async function saveDocument() {
    if (!title.trim()) {
      setError("제목을 입력해주세요");
      return;
    }

    // Check if there's actual content (excluding frontmatter)
    const frontmatterRegex = /^---\n[\s\S]*?\n---\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);
    const bodyContent = match ? match[1].trim() : content.trim();

    if (!bodyContent) {
      setError("내용을 입력해주세요");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: title, content, folder }),
      });

      const data = await res.json();

      if (data.success) {
        // 저장 성공 시 드래프트 삭제
        setIsDirty(false);
        await deleteDraft();
        // Redirect to the newly created document's view page using the server-generated slug
        const createdSlug = data.data.document.slug;
        router.push(`/note/${createdSlug}`);
      } else {
        setError(data.error || "문서 생성에 실패했습니다");
      }
    } catch (err) {
      console.error("Failed to create note:", err);
      setError("문서 생성 중 오류가 발생했습니다");
    } finally {
      setIsSaving(false);
    }
  }

  async function performCancel() {
    // Clean up temp images and draft before leaving
    if (content) {
      try {
        await fetch("/api/temp-images", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, folder }),
        });
      } catch (err) {
        console.error("Failed to clean temp images:", err);
        // Continue with navigation even if cleanup fails
      }
    }
    // 드래프트도 삭제
    await deleteDraft();
    setIsDirty(false);
    router.push("/documents");
  }

  function handleCancel() {
    if (isDirtyLocal) {
      confirmNavigation(performCancel);
    } else {
      performCancel();
    }
  }

  // 드래프트 복구 핸들러
  const handleRecoverDraft = useCallback(() => {
    if (!pendingDraft) return;

    // 드래프트 내용으로 복구
    setTitle(pendingDraft.title);
    setTags(pendingDraft.tags);

    // frontmatter 포함 content 생성
    const tagsYaml = pendingDraft.tags.length > 0
      ? `[${pendingDraft.tags.map(t => `"${t}"`).join(", ")}]`
      : "[]";
    const fullContent = `---
title: ${pendingDraft.title}
tags: ${tagsYaml}
---

${pendingDraft.content}`;

    setContent(fullContent);
    setIsInitialized(true);
    setIsDirty(true);

    setShowDraftDialog(false);
    setPendingDraft(null);
  }, [pendingDraft]);

  // 드래프트 무시 핸들러
  const handleDiscardDraft = useCallback(() => {
    deleteDraft();
    setShowDraftDialog(false);
    setPendingDraft(null);
  }, [deleteDraft]);

  // 드래프트 확인 중일 때 로딩 표시
  if (isCheckingDraft) {
    return <LoadingScreen message="에디터 준비 중..." />;
  }

  return (
    <>
      {/* 드래프트 복구 다이얼로그 */}
      {pendingDraft && (
        <DraftRecoveryDialog
          open={showDraftDialog}
          draft={pendingDraft}
          onRecover={handleRecoverDraft}
          onDiscard={handleDiscardDraft}
        />
      )}

      <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="border-b bg-card p-4">
        <div className="container mx-auto space-y-4">
          {/* Top Row: Back, Theme, Save */}
          <div className="flex items-center justify-between">
            <Button variant="outline" size="icon" onClick={handleCancel} className="cursor-pointer">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button
                onClick={saveDocument}
                disabled={isSaving || !title.trim()}
                className="cursor-pointer"
              >
                {isSaving ? "저장 중..." : "저장"}
              </Button>
            </div>
          </div>

          {/* Title Section */}
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-2">
              <label className="text-sm font-medium text-muted-foreground">
                제목
              </label>
              <Badge variant="outline" className="text-xs font-normal bg-muted/50 text-muted-foreground border-border/50">
                <Folder className="w-3 h-3 mr-1" />
                {folder}
              </Badge>
            </div>
            <Input
              type="text"
              placeholder="노트 제목을 입력하세요..."
              value={title}
              onChange={(e) => {
                const newValue = e.target.value;
                // 금지 문자 검증
                if (FORBIDDEN_CHARS.test(newValue)) {
                  setError(FORBIDDEN_CHARS_MESSAGE);
                  return;
                }
                setTitle(newValue);
                setError(null);
                setIsDirty(true);
                triggerDraftSave();
              }}
              className="text-lg font-bold"
              autoFocus
            />
            {error && (
              <p className="text-sm text-red-600 mt-1">{error}</p>
            )}
          </div>

          {/* Tags Section */}
          <div className="max-w-2xl">
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              태그
            </label>
            <TagInput
              tags={tags}
              onChange={(newTags) => {
                setTags(newTags);
                setIsDirty(true);
                triggerDraftSave();
              }}
              suggestions={availableTags}
              placeholder="태그를 입력하세요..."
              showHelper={true}
            />
          </div>
        </div>
      </header>

      {/* Editor + Preview */}
      <div className="flex-1 p-4 min-h-0 overflow-hidden">
        <div className="container mx-auto h-full flex flex-col lg:flex-row gap-4">
          {/* Editor */}
          <div className="h-1/2 lg:h-auto lg:flex-1 lg:w-1/2 flex flex-col min-h-0">
            <h2 className="text-lg font-semibold mb-2 shrink-0">Editor</h2>
            <div className="flex-1 border rounded-lg min-h-0 overflow-hidden">
              <MarkdownEditor
                value={(() => {
                  // Extract body content without frontmatter
                  const frontmatterRegex = /^---\n[\s\S]*?\n---\n([\s\S]*)$/;
                  const match = content.match(frontmatterRegex);
                  return match ? match[1] : content;
                })()}
                onChange={(newBody) => {
                  // Update content with frontmatter + new body
                  const frontmatterRegex = /^(---\n[\s\S]*?\n---\n)/;
                  const match = content.match(frontmatterRegex);
                  if (match) {
                    setContent(match[1] + newBody);
                  } else {
                    setContent(newBody);
                  }
                  setIsDirty(true);
                  triggerDraftSave();
                }}
                folder={folder}
              />
            </div>
          </div>

          {/* Preview */}
          <div className="h-1/2 lg:h-auto lg:flex-1 lg:w-1/2 flex flex-col min-h-0">
            <h2 className="text-lg font-semibold mb-2 shrink-0">Preview</h2>
            <div className="flex-1 border rounded-lg relative min-h-0">
              <div className="absolute inset-0 overflow-y-auto">
                <MarkdownViewer
                  content={content}
                  existingTitles={existingTitles}
                  isPreview
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

export default function NewNotePage() {
  return (
    <Suspense fallback={<LoadingScreen message="에디터 로딩 중..." />}>
      <NewNotePageContent />
    </Suspense>
  );
}
