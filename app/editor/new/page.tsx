"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import MarkdownEditor from "@/components/editor/MarkdownEditor";
import MarkdownViewer from "@/components/editor/MarkdownViewer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TagInput } from "@/components/ui/tag-input";

export default function NewNotePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
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

  // Initialize content with frontmatter and heading on first title input
  useEffect(() => {
    if (title.trim() && !isInitialized && !content.trim()) {
      const tagsYaml = tags.length > 0 ? `[${tags.map(t => `"${t}"`).join(", ")}]` : "[]";
      const initialContent = `---
title: ${title}
tags: ${tagsYaml}
---

# ${title}

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

    const slug = title.toLowerCase().replace(/\s+/g, "-");

    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, content }),
      });

      const data = await res.json();

      if (data.success) {
        // Redirect to the newly created document's view page
        router.push(`/note/${slug}`);
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
    const normalizedSlug = pageName.toLowerCase().replace(/\s+/g, "-");
    // Open in new tab to prevent losing current work
    window.open(`/note/${normalizedSlug}`, '_blank');
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
      <header className="border-b bg-white p-4">
        <div className="container mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4 flex-1">
              <Button variant="outline" onClick={handleCancel}>
                ← Cancel
              </Button>
              <div className="flex-1 max-w-md">
                <Input
                  type="text"
                  placeholder="노트 제목을 입력하세요..."
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
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
            <div className="flex gap-2">
              <Button
                onClick={saveDocument}
                disabled={isSaving || !title.trim()}
              >
                {isSaving ? "저장 중..." : "저장"}
              </Button>
            </div>
          </div>

          {/* Tags Section */}
          <div className="max-w-2xl">
            <label className="block text-sm font-medium text-gray-700 mb-2">
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
      <div className="flex-1 grid grid-cols-2 gap-4 p-4 overflow-hidden">
        {/* Editor */}
        <div className="flex flex-col h-full overflow-hidden">
          <h2 className="text-lg font-semibold mb-2">Editor</h2>
          <div className="flex-1 overflow-y-auto border rounded-lg">
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
        <div className="flex flex-col h-full overflow-hidden">
          <h2 className="text-lg font-semibold mb-2">Preview</h2>
          <div className="flex-1 border rounded-lg overflow-y-auto">
            <MarkdownViewer
              content={content}
              onWikiLinkClick={handleWikiLinkClick}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
