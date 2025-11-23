"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import MarkdownEditor from "@/components/editor/MarkdownEditor";
import MarkdownViewer from "@/components/editor/MarkdownViewer";
import { Document } from "@/types";
import { Button } from "@/components/ui/button";

export default function EditorPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [document, setDocument] = useState<Document | null>(null);
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch document
  useEffect(() => {
    async function fetchDocument() {
      try {
        const res = await fetch(`/api/documents/${slug}`);
        const data = await res.json();

        if (data.success) {
          setDocument(data.data.document);
          setContent(data.data.document.content);
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

  async function handleDelete() {
    if (!confirm(`Are you sure you want to delete "${document?.title}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/documents/${slug}`, {
        method: "DELETE",
      });

      if (res.ok) {
        router.push("/");
      }
    } catch (err) {
      console.error("Failed to delete:", err);
    }
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
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => router.push(`/note/${slug}`)}>
              ← Done
            </Button>
            <div>
              <h1 className="text-xl font-bold">Editing: {document?.title}</h1>
              <p className="text-sm text-gray-500">
                {isSaving ? (
                  "Saving..."
                ) : lastSaved ? (
                  `Last saved: ${lastSaved.toLocaleTimeString()}`
                ) : (
                  "All changes saved"
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => saveDocument()}>
              Save Now
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </div>
      </header>

      {/* Editor + Preview */}
      <div className="flex-1 grid grid-cols-2 gap-4 p-4 overflow-hidden">
        {/* Editor */}
        <div className="flex flex-col h-full overflow-hidden">
          <h2 className="text-lg font-semibold mb-2">Editor</h2>
          <div className="flex-1 overflow-y-auto border rounded-lg">
            <MarkdownEditor value={content} onChange={setContent} />
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

      {/* Backlinks (if any) */}
      {document && document.backlinks.length > 0 && (
        <div className="border-t bg-gray-50 p-4">
          <div className="container mx-auto">
            <h3 className="text-sm font-semibold mb-2">
              Backlinks ({document.backlinks.length})
            </h3>
            <div className="flex gap-2 flex-wrap">
              {document.backlinks.map((backlink) => (
                <button
                  key={backlink}
                  onClick={() => router.push(`/note/${backlink}`)}
                  className="text-sm px-3 py-1 bg-green-100 text-green-700 rounded-full hover:bg-green-200"
                >
                  {backlink}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
