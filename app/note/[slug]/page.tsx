"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import MarkdownViewer from "@/components/editor/MarkdownViewer";
import { Document } from "@/types";
import { Button } from "@/components/ui/button";

export default function NotePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [document, setDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDocument() {
      try {
        const res = await fetch(`/api/documents/${slug}`);
        const data = await res.json();

        if (data.success) {
          setDocument(data.data.document);
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

  if (error || !document) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-red-600 mb-4">{error || "Document not found"}</p>
          <Button onClick={() => router.push("/")}>Go Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b bg-white p-4 sticky top-0 z-10">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => router.push("/")}>
              ← Back
            </Button>
            <div>
              <h1 className="text-xl font-bold">{document.title}</h1>
              {document.frontmatter.tags && document.frontmatter.tags.length > 0 && (
                <div className="flex gap-1 mt-1">
                  {document.frontmatter.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-0.5 bg-gray-100 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <Button onClick={() => router.push(`/editor/${slug}`)}>
            Edit
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 container mx-auto max-w-4xl py-8 px-4">
        <div className="prose prose-lg dark:prose-invert max-w-none">
          <MarkdownViewer
            content={document.contentWithoutFrontmatter}
            onWikiLinkClick={handleWikiLinkClick}
          />
        </div>
      </main>

      {/* Metadata Footer */}
      <footer className="border-t bg-gray-50 p-4">
        <div className="container mx-auto max-w-4xl">
          <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-4">
            <div>
              <span className="font-semibold">Created:</span>{" "}
              {new Date(document.createdAt).toLocaleString()}
            </div>
            <div>
              <span className="font-semibold">Updated:</span>{" "}
              {new Date(document.updatedAt).toLocaleString()}
            </div>
          </div>

          {/* Links */}
          {document.links.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold mb-2">
                Links ({document.links.length})
              </h3>
              <div className="flex gap-2 flex-wrap">
                {document.links.map((link) => (
                  <button
                    key={link}
                    onClick={() => router.push(`/note/${link}`)}
                    className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200"
                  >
                    {link}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Backlinks */}
          {document.backlinks.length > 0 && (
            <div>
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
          )}
        </div>
      </footer>
    </div>
  );
}
