"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import MarkdownViewer from "@/components/editor/MarkdownViewer";
import ForceGraphView from "@/components/graph/ForceGraphView";
import { Document, Graph } from "@/types";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export default function NotePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [document, setDocument] = useState<Document | null>(null);
  const [graph, setGraph] = useState<Graph | null>(null);
  const [depth, setDepth] = useState<number>(2);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [graphHeight, setGraphHeight] = useState(320);

  // Calculate responsive graph height
  useEffect(() => {
    const calculateHeight = () => {
      if (typeof window !== 'undefined') {
        // Use viewport height minus some offset for better responsiveness
        const vh = window.innerHeight;
        const minHeight = 280;
        const maxHeight = 500;
        const calculatedHeight = Math.max(minHeight, Math.min(maxHeight, vh * 0.4));
        setGraphHeight(calculatedHeight);
      }
    };

    calculateHeight();
    window.addEventListener('resize', calculateHeight);
    return () => window.removeEventListener('resize', calculateHeight);
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch document and graph in parallel
        const [docRes, graphRes] = await Promise.all([
          fetch(`/api/documents/${slug}`),
          fetch(`/api/graph`),
        ]);

        const docData = await docRes.json();
        const graphData = await graphRes.json();

        if (docData.success) {
          setDocument(docData.data.document);
        } else {
          setError("Document not found");
        }

        if (graphData.success) {
          setGraph(graphData.data);
        }
      } catch (err) {
        setError("Failed to load document");
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [slug]);

  function handleWikiLinkClick(pageName: string) {
    const normalizedSlug = pageName.toLowerCase().replace(/\s+/g, "-");
    router.push(`/note/${normalizedSlug}`);
  }

  async function handleDelete() {
    if (!document || !confirm(`"${document.title}" 문서를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/documents/${slug}`, {
        method: "DELETE",
      });

      if (res.ok) {
        router.push("/documents");
      }
    } catch (err) {
      console.error("Failed to delete:", err);
      alert("문서 삭제에 실패했습니다.");
    }
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
          <div className="flex gap-2">
            <Button onClick={() => router.push(`/editor/${slug}`)}>
              Edit
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 container mx-auto py-8 px-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <div className="prose prose-lg dark:prose-invert max-w-none">
              <MarkdownViewer
                content={document.contentWithoutFrontmatter}
                onWikiLinkClick={handleWikiLinkClick}
              />
            </div>
          </div>

          {/* Local Graph Sidebar */}
          {graph && graph.nodes && graph.links && (
            <div className="lg:col-span-1">
              <div className="sticky top-20 bg-white border rounded-lg p-4 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-800">Local Graph</h3>

                  {/* Compact Depth Slider */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-gray-600">Depth:</span>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3].map((level) => (
                        <button
                          key={level}
                          onClick={() => setDepth(level)}
                          className={`
                            w-7 h-7 rounded-full text-xs font-semibold transition-all duration-200
                            ${depth === level
                              ? 'bg-blue-500 text-white shadow-md scale-110'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }
                          `}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Graph */}
                <ForceGraphView
                  graphData={graph as any}
                  currentNodeUrl={`/${slug}`}
                  depth={depth}
                  height={graphHeight}
                />
              </div>
            </div>
          )}
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
