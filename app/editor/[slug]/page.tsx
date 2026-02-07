"use client";

import { useEffect, useState, useRef, useTransition, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import MarkdownEditor from "@/components/editor/MarkdownEditor";
import MarkdownViewer from "@/components/editor/MarkdownViewer";
import { DraftRecoveryDialog } from "@/components/editor/DraftRecoveryDialog";
import { Document } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TagInput } from "@/components/ui/tag-input";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { LoadingScreen } from "@/components/ui/spinner";
import { Folder } from "lucide-react";
import { useBeforeUnload } from "@/hooks/useBeforeUnload";
import type { Draft } from "@/app/api/drafts/route";

// 파일 시스템 금지 문자
const FORBIDDEN_CHARS = /[/\\:*?"<>|]/;
const FORBIDDEN_CHARS_MESSAGE = '제목에 다음 문자는 사용할 수 없습니다: / \\ : * ? " < > |';

export default function EditorPage() {
  const params = useParams();
  const router = useRouter();
  // URL에서 제목 디코딩
  const slug = params.slug as string;
  const requestedTitle = decodeURIComponent(slug);

  const [document, setDocument] = useState<Document | null>(null);
  const [initialTitle, setInitialTitle] = useState("");
  const [folder, setFolder] = useState<string>("default");
  const [tags, setTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [existingTitles, setExistingTitles] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // 드래프트 복구 관련 상태
  const [pendingDraft, setPendingDraft] = useState<Draft | null>(null);
  const [showDraftDialog, setShowDraftDialog] = useState(false);

  // 에디터 값은 ref로 관리 (즉각적인 입력 반응을 위해)
  const editorContentRef = useRef("");
  const [editorInitialValue, setEditorInitialValue] = useState("");

  // 제목/태그도 ref로 관리 (입력 지연 방지)
  const titleRef = useRef("");
  const tagsRef = useRef<string[]>([]);

  // 프리뷰와 저장용 content (디바운스됨)
  const [previewContent, setPreviewContent] = useState("");
  const [isPending, startTransition] = useTransition();
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 페이지 이탈 경고
  useBeforeUnload(isDirty);

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

  // Fetch document and check for draft
  useEffect(() => {
    async function fetchDocumentAndDraft() {
      try {
        // 문서와 드래프트를 병렬로 조회
        const [docRes, draftRes] = await Promise.all([
          fetch(`/api/documents/${encodeURIComponent(requestedTitle)}`),
          fetch(`/api/drafts?slug=${encodeURIComponent(slug)}`),
        ]);

        const data = await docRes.json();

        if (data.success) {
          const doc = data.data.document;
          setDocument(doc);
          const docTitle = doc.frontmatter.title || doc.title;
          const docTags = doc.frontmatter.tags || [];
          const docFolder = doc.folder || "default";
          setTags(docTags);
          setFolder(docFolder);
          setInitialTitle(docTitle);
          titleRef.current = docTitle;
          tagsRef.current = docTags;
          editorContentRef.current = doc.contentWithoutFrontmatter;
          setEditorInitialValue(doc.contentWithoutFrontmatter);
          setPreviewContent(doc.content);

          // 드래프트가 있는지 확인
          const draftResponse = await draftRes.json();
          // draft가 null이 아니고 slug가 있으면 드래프트 존재
          const draftData = draftResponse.draft === null ? null : draftResponse.slug ? draftResponse : null;
          if (draftData) {
            // 드래프트가 원본과 다른 경우에만 복구 다이얼로그 표시
            if (draftData.content !== doc.contentWithoutFrontmatter ||
                draftData.title !== docTitle) {
              setPendingDraft(draftData);
              setShowDraftDialog(true);
            } else {
              // 드래프트가 원본과 같으면 삭제
              fetch(`/api/drafts?slug=${encodeURIComponent(slug)}`, {
                method: "DELETE",
              }).catch(console.error);
            }
          }
        } else {
          setError("Document not found");
        }
      } catch (err) {
        setError("Failed to load document");
      } finally {
        setIsLoading(false);
      }
    }

    fetchDocumentAndDraft();
  }, [requestedTitle, slug]);

  // 전체 content 생성 헬퍼 함수
  const buildFullContent = useCallback((editorContent: string, currentTitle: string, currentTags: string[]) => {
    const tagsYaml = currentTags.length > 0 ? `[${currentTags.map(t => `"${t}"`).join(", ")}]` : "[]";
    return `---
title: ${currentTitle}
tags: ${tagsYaml}
---

${editorContent}`;
  }, []);

  // Auto-save (debounced) - 30초마다 저장
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // 드래프트 저장 (debounced) - 5초마다 저장
  const draftTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerAutoSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveDocument();
    }, 30000);
  }, []);

  // 드래프트 저장 함수
  const saveDraft = useCallback(async () => {
    if (!slug) return;

    const draft: Draft = {
      slug,
      title: titleRef.current,
      content: editorContentRef.current,
      tags: tagsRef.current,
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
  }, [slug, folder]);

  // 드래프트 삭제 함수
  const deleteDraft = useCallback(async () => {
    if (!slug) return;

    try {
      await fetch(`/api/drafts?slug=${encodeURIComponent(slug)}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.error("Failed to delete draft:", err);
    }
  }, [slug]);

  // 드래프트 저장 트리거 (5초 디바운스)
  const triggerDraftSave = useCallback(() => {
    if (draftTimeoutRef.current) {
      clearTimeout(draftTimeoutRef.current);
    }
    draftTimeoutRef.current = setTimeout(() => {
      saveDraft();
    }, 5000);
  }, [saveDraft]);

  // 디바운스된 프리뷰 업데이트 함수
  const schedulePreviewUpdate = useCallback(() => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    updateTimeoutRef.current = setTimeout(() => {
      startTransition(() => {
        setPreviewContent(buildFullContent(editorContentRef.current, titleRef.current, tagsRef.current));
      });
    }, 300);
  }, [buildFullContent]);

  // 에디터 onChange
  const handleEditorChange = useCallback((value: string) => {
    editorContentRef.current = value;
    schedulePreviewUpdate();
  }, [schedulePreviewUpdate]);

  // 에디터 변경 시 자동 저장도 트리거
  const handleEditorChangeWithSave = useCallback((value: string) => {
    handleEditorChange(value);
    setIsDirty(true);
    triggerAutoSave();
    triggerDraftSave();
  }, [handleEditorChange, triggerAutoSave, triggerDraftSave]);

  // 제목 onChange - ref만 업데이트 (비제어 컴포넌트, state 업데이트 없음)
  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    // 금지 문자 검증
    if (FORBIDDEN_CHARS.test(newValue)) {
      setError(FORBIDDEN_CHARS_MESSAGE);
      return;
    }
    setError(null);
    titleRef.current = newValue;
    setIsDirty(true);
    schedulePreviewUpdate();
    triggerAutoSave();
    triggerDraftSave();
  }, [schedulePreviewUpdate, triggerAutoSave, triggerDraftSave]);

  // 태그 onChange - ref 업데이트 + 디바운스 프리뷰
  const handleTagsChange = useCallback((newTags: string[]) => {
    tagsRef.current = newTags;
    setTags(newTags); // TagInput 표시용
    setIsDirty(true);
    schedulePreviewUpdate();
    triggerAutoSave();
    triggerDraftSave();
  }, [schedulePreviewUpdate, triggerAutoSave, triggerDraftSave]);

  async function saveDocument() {
    const content = buildFullContent(editorContentRef.current, titleRef.current, tagsRef.current);
    if (!content || content === document?.content) return;

    // 현재 문서의 제목 (저장 전)
    const currentDocTitle = document?.title || requestedTitle;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(currentDocTitle)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      const data = await res.json();

      if (data.success) {
        const updatedDoc = data.data.document;
        setDocument(updatedDoc);
        setLastSaved(new Date());
        setIsDirty(false);
        // 저장 성공 시 드래프트 삭제
        deleteDraft();

        // 제목이 변경되었으면 URL을 업데이트
        if (updatedDoc.title !== currentDocTitle) {
          // URL만 변경 (페이지 새로고침 없이)
          window.history.replaceState(
            null,
            '',
            `/editor/${encodeURIComponent(updatedDoc.title)}`
          );
          setInitialTitle(updatedDoc.title);
        }
      } else if (data.error) {
        // 에러 표시 (예: 중복 제목)
        setError(data.error);
        setTimeout(() => setError(null), 3000);
      }
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDone() {
    // Save before navigating
    const content = buildFullContent(editorContentRef.current, titleRef.current, tagsRef.current);
    const currentDocTitle = document?.title || requestedTitle;
    let finalTitle = currentDocTitle;

    if (content && content !== document?.content) {
      setIsSaving(true);
      try {
        const res = await fetch(`/api/documents/${encodeURIComponent(currentDocTitle)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        const data = await res.json();
        if (data.success) {
          finalTitle = data.data.document.title;
          setIsDirty(false);
        }
      } catch (err) {
        console.error("Failed to save:", err);
      } finally {
        setIsSaving(false);
      }
    }
    // 드래프트 삭제 후 네비게이션
    await deleteDraft();
    // Navigate to document view (use potentially updated title)
    router.push(`/note/${encodeURIComponent(finalTitle)}`);
  }

  // 드래프트 복구 핸들러
  const handleRecoverDraft = useCallback(() => {
    if (!pendingDraft) return;

    // 드래프트 내용으로 에디터 업데이트
    titleRef.current = pendingDraft.title;
    tagsRef.current = pendingDraft.tags;
    editorContentRef.current = pendingDraft.content;
    setTags(pendingDraft.tags);
    setInitialTitle(pendingDraft.title);
    setEditorInitialValue(pendingDraft.content);
    setPreviewContent(buildFullContent(pendingDraft.content, pendingDraft.title, pendingDraft.tags));
    setIsDirty(true);

    setShowDraftDialog(false);
    setPendingDraft(null);
  }, [pendingDraft, buildFullContent]);

  // 드래프트 무시 핸들러
  const handleDiscardDraft = useCallback(() => {
    deleteDraft();
    setShowDraftDialog(false);
    setPendingDraft(null);
  }, [deleteDraft]);

  if (isLoading) {
    return <LoadingScreen message="문서 로딩 중..." />;
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-red-600 mb-4">{error}</p>
          <Button onClick={() => router.push("/")} className="cursor-pointer">홈으로</Button>
        </div>
      </div>
    );
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
        <div className="container mx-auto">
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 max-w-lg">
                <Badge variant="outline" className="text-xs font-normal bg-muted/50 text-muted-foreground border-border/50 shrink-0">
                  <Folder className="w-3 h-3 mr-1" />
                  {folder}
                </Badge>
                <Input
                  key={initialTitle} // key로 초기값이 변경되면 리마운트
                  type="text"
                  placeholder="문서 제목을 입력하세요..."
                  defaultValue={initialTitle}
                  onChange={handleTitleChange}
                  className="text-lg font-bold"
                />
                {error && (
                  <p className="text-sm text-red-600 mt-1">{error}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <Button onClick={handleDone} className="cursor-pointer">
                  완료
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {isSaving ? (
                "저장 중..."
              ) : lastSaved ? (
                `마지막 저장: ${lastSaved.toLocaleTimeString()}`
              ) : (
                "모든 변경사항 저장됨"
              )}
            </p>
          </div>

          {/* Tags Section */}
          <div className="max-w-2xl">
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              태그
            </label>
            <TagInput
              tags={tags}
              onChange={handleTagsChange}
              suggestions={availableTags}
              placeholder="태그를 입력하세요..."
            />
          </div>
        </div>
      </header>

      {/* Editor + Preview */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 min-h-0 overflow-hidden">
        {/* Editor */}
        <div className="h-1/2 lg:h-auto lg:flex-1 lg:w-1/2 flex flex-col min-h-0">
          <h2 className="text-lg font-semibold mb-2 shrink-0">편집기</h2>
          <div className="flex-1 border rounded-lg min-h-0 overflow-hidden">
            <MarkdownEditor
              value={editorInitialValue}
              onChange={handleEditorChangeWithSave}
              folder={folder}
            />
          </div>
        </div>

        {/* Preview */}
        <div className="h-1/2 lg:h-auto lg:flex-1 lg:w-1/2 flex flex-col min-h-0">
          <h2 className="text-lg font-semibold mb-2 shrink-0">
            미리보기
            {isPending && <span className="ml-2 text-sm text-muted-foreground font-normal">업데이트 중...</span>}
          </h2>
          <div className="flex-1 border rounded-lg relative min-h-0">
            <div className="absolute inset-0 overflow-y-auto">
              <MarkdownViewer
                content={previewContent}
                existingTitles={existingTitles}
                isPreview
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
