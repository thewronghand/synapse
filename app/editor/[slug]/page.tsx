"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import MarkdownEditor from "@/components/editor/MarkdownEditor";
import MarkdownViewer from "@/components/editor/MarkdownViewer";
import { Document } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TagInput } from "@/components/ui/tag-input";

export default function EditorPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [document, setDocument] = useState<Document | null>(null);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [content, setContent] = useState("");
  const [contentWithoutMetadata, setContentWithoutMetadata] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          setTitle(doc.frontmatter.title || doc.title);
          setTags(doc.frontmatter.tags || []);
          setContentWithoutMetadata(doc.contentWithoutFrontmatter);
          setContent(doc.content);
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

  // Update full content when title, tags, or content changes
  useEffect(() => {
    if (!title) return;

    const tagsYaml = tags.length > 0 ? `[${tags.map(t => `"${t}"`).join(", ")}]` : "[]";
    const frontmatter = `---
title: ${title}
tags: ${tagsYaml}
---

`;
    const fullContent = frontmatter + contentWithoutMetadata;
    setContent(fullContent);
  }, [title, tags, contentWithoutMetadata]);

  // Auto-save (debounced)
  useEffect(() => {
    if (!document) return;

    const timer = setTimeout(() => {
      saveDocument();
    }, 2000); // Auto-save 2 seconds after typing stops

    return () => clearTimeout(timer);
  }, [content]);

  async function saveDocument() {
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
    await saveDocument();
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
          <Button onClick={() => router.push("/")}>Go Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="border-b bg-white p-4">
        <div className="container mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1 max-w-md">
              <Input
                type="text"
                placeholder="문서 제목을 입력하세요..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-lg font-bold"
              />
              <p className="text-sm text-gray-500 mt-1">
                {isSaving ? (
                  "Saving..."
                ) : lastSaved ? (
                  `Last saved: ${lastSaved.toLocaleTimeString()}`
                ) : (
                  "All changes saved"
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleDone}>
                Done
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
              value={contentWithoutMetadata}
              onChange={setContentWithoutMetadata}
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
