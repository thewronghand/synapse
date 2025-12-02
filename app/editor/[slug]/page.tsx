"use client";

import { useEffect, useState, useRef, useTransition, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import MarkdownEditor from "@/components/editor/MarkdownEditor";
import MarkdownViewer from "@/components/editor/MarkdownViewer";
import { Document } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TagInput } from "@/components/ui/tag-input";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export default function EditorPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [document, setDocument] = useState<Document | null>(null);
  const [initialTitle, setInitialTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Fetch available tags
  useEffect(() => {
    async function fetchTags() {
      try {
        const res = await fetch("/api/tags");
        const data = await res.json();
        if (data.success) {
          setAvailableTags(data.data.tags);
        }
      } catch (err) {
        console.error("Failed to fetch tags:", err);
      }
    }
    fetchTags();
  }, []);

  // Fetch document
  useEffect(() => {
    async function fetchDocument() {
      try {
        const res = await fetch(`/api/documents/${slug}`);
        const data = await res.json();

        if (data.success) {
          const doc = data.data.document;
          setDocument(doc);
          const docTitle = doc.frontmatter.title || doc.title;
          const docTags = doc.frontmatter.tags || [];
          setTags(docTags);
          setInitialTitle(docTitle);
          titleRef.current = docTitle;
          tagsRef.current = docTags;
          editorContentRef.current = doc.contentWithoutFrontmatter;
          setEditorInitialValue(doc.contentWithoutFrontmatter);
          setPreviewContent(doc.content);
        } else {
          setError("Document not found");
        }
      } catch (err) {
        setError("Failed to load document");
      } finally {
        setIsLoading(false);
      }
    }

    fetchDocument();
  }, [slug]);

  // 전체 content 생성 헬퍼 함수
  const buildFullContent = useCallback((editorContent: string, currentTitle: string, currentTags: string[]) => {
    const tagsYaml = currentTags.length > 0 ? `[${currentTags.map(t => `"${t}"`).join(", ")}]` : "[]";
    return `---
title: ${currentTitle}
tags: ${tagsYaml}
---

${editorContent}`;
  }, []);

  // Auto-save (debounced) - 2초마다 저장
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerAutoSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveDocument();
    }, 2000);
  }, []);

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
    triggerAutoSave();
  }, [handleEditorChange, triggerAutoSave]);

  // 제목 onChange - ref만 업데이트 (비제어 컴포넌트, state 업데이트 없음)
  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    titleRef.current = e.target.value;
    schedulePreviewUpdate();
    triggerAutoSave();
  }, [schedulePreviewUpdate, triggerAutoSave]);

  // 태그 onChange - ref 업데이트 + 디바운스 프리뷰
  const handleTagsChange = useCallback((newTags: string[]) => {
    tagsRef.current = newTags;
    setTags(newTags); // TagInput 표시용
    schedulePreviewUpdate();
    triggerAutoSave();
  }, [schedulePreviewUpdate, triggerAutoSave]);

  async function saveDocument() {
    const content = buildFullContent(editorContentRef.current, titleRef.current, tagsRef.current);
    if (!content || content === document?.content) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/documents/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      const data = await res.json();

      if (data.success) {
        setDocument(data.data.document);
        setLastSaved(new Date());
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
    if (content && content !== document?.content) {
      setIsSaving(true);
      try {
        await fetch(`/api/documents/${slug}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
      } catch (err) {
        console.error("Failed to save:", err);
      } finally {
        setIsSaving(false);
      }
    }
    // Navigate to document view
    router.push(`/note/${slug}`);
  }

  function handleWikiLinkClick(pageName: string) {
    const normalizedSlug = pageName.toLowerCase().replace(/\s+/g, "-");
    router.push(`/note/${normalizedSlug}`);
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-gray-600">Loading...</p>
      </div>
    );
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
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="border-b bg-card p-4">
        <div className="container mx-auto">
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 max-w-md">
                <Input
                  key={initialTitle} // key로 초기값이 변경되면 리마운트
                  type="text"
                  placeholder="문서 제목을 입력하세요..."
                  defaultValue={initialTitle}
                  onChange={handleTitleChange}
                  className="text-lg font-bold"
                />
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
      <div className="flex-1 flex gap-4 p-4 min-h-0 overflow-hidden">
        {/* Editor */}
        <div className="w-1/2 flex flex-col min-h-0">
          <h2 className="text-lg font-semibold mb-2 shrink-0">편집기</h2>
          <div className="flex-1 border rounded-lg min-h-0 overflow-hidden">
            <MarkdownEditor
              value={editorInitialValue}
              onChange={handleEditorChangeWithSave}
            />
          </div>
        </div>

        {/* Preview */}
        <div className="w-1/2 flex flex-col min-h-0">
          <h2 className="text-lg font-semibold mb-2 shrink-0">
            미리보기
            {isPending && <span className="ml-2 text-sm text-muted-foreground font-normal">업데이트 중...</span>}
          </h2>
          <div className="flex-1 border rounded-lg relative min-h-0">
            <div className="absolute inset-0 overflow-y-auto">
              <MarkdownViewer
                content={previewContent}
                onWikiLinkClick={handleWikiLinkClick}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
