"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MarkdownEditor from "@/components/editor/MarkdownEditor";
import MarkdownViewer from "@/components/editor/MarkdownViewer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TagInput } from "@/components/ui/tag-input";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LoadingScreen } from "@/components/ui/spinner";

// 파일 시스템 금지 문자
const FORBIDDEN_CHARS = /[/\\:*?"<>|]/;
const FORBIDDEN_CHARS_MESSAGE = '제목에 다음 문자는 사용할 수 없습니다: / \\ : * ? " < > |';

function NewNotePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTitle = searchParams.get("title") || "";
  const [title, setTitle] = useState(initialTitle);
  const [tags, setTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [content, setContent] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available tags on mount
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
        body: JSON.stringify({ slug: title, content }),
      });

      const data = await res.json();

      if (data.success) {
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

  function handleWikiLinkClick(pageName: string) {
    // Open in new tab to prevent losing current work
    window.open(`/note/${encodeURIComponent(pageName)}`, '_blank');
  }

  async function handleCancel() {
    // Clean up temp images before leaving
    if (content) {
      try {
        await fetch("/api/temp-images", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
      } catch (err) {
        console.error("Failed to clean temp images:", err);
        // Continue with navigation even if cleanup fails
      }
    }
    router.push("/documents");
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="border-b bg-card p-4">
        <div className="container mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4 flex-1">
              <Button variant="outline" onClick={handleCancel} className="cursor-pointer">
                ← 취소
              </Button>
              <div className="flex-1 max-w-md">
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
                  }}
                  className="text-lg font-bold"
                  autoFocus
                />
                {error && (
                  <p className="text-sm text-red-600 mt-1">{error}</p>
                )}
              </div>
            </div>
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

          {/* Tags Section */}
          <div className="max-w-2xl">
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              태그
            </label>
            <TagInput
              tags={tags}
              onChange={setTags}
              suggestions={availableTags}
              placeholder="태그를 입력하세요..."
              showHelper={true}
            />
          </div>
        </div>
      </header>

      {/* Editor + Preview */}
      <div className="flex-1 flex gap-4 p-4 min-h-0 overflow-hidden">
        {/* Editor */}
        <div className="w-1/2 flex flex-col min-h-0">
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
              }}
            />
          </div>
        </div>

        {/* Preview */}
        <div className="w-1/2 flex flex-col min-h-0">
          <h2 className="text-lg font-semibold mb-2 shrink-0">Preview</h2>
          <div className="flex-1 border rounded-lg relative min-h-0">
            <div className="absolute inset-0 overflow-y-auto">
              <MarkdownViewer
                content={content}
                onWikiLinkClick={handleWikiLinkClick}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NewNotePage() {
  return (
    <Suspense fallback={<LoadingScreen message="에디터 준비 중..." />}>
      <NewNotePageContent />
    </Suspense>
  );
}
