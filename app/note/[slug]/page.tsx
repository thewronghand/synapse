"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import MarkdownViewer from "@/components/editor/MarkdownViewer";
import ForceGraphView from "@/components/graph/ForceGraphView";
import { Document, Graph, DigitalGardenNode, GraphEdge } from "@/types";
import { Button } from "@/components/ui/button";
import { isPublishedMode } from "@/lib/env";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

// Filter graph to only include nodes and links from the same folder
function filterGraphByFolder(graph: Graph, folder: string): Graph {
  // Filter nodes by folder
  const filteredNodes: { [url: string]: DigitalGardenNode } = {};
  const validNodeIds = new Set<number>();

  Object.entries(graph.nodes).forEach(([url, node]) => {
    const nodeWithFolder = node as DigitalGardenNode & { folder?: string };
    const nodeFolder = nodeWithFolder.folder || "default";

    if (nodeFolder === folder) {
      filteredNodes[url] = node;
      validNodeIds.add(node.id);
    }
  });

  // Filter links to only include connections between valid nodes
  const filteredLinks = (graph.links || []).filter(
    (link) => validNodeIds.has(link.source as number) && validNodeIds.has(link.target as number)
  );

  // Update neighbors and backLinks to only include same-folder nodes
  Object.values(filteredNodes).forEach((node) => {
    node.neighbors = node.neighbors.filter((neighborUrl) => filteredNodes[neighborUrl]);
    node.backLinks = node.backLinks.filter((backLinkUrl) => filteredNodes[backLinkUrl]);
  });

  return { nodes: filteredNodes, links: filteredLinks };
}

export default function NotePage() {
  const params = useParams();
  const router = useRouter();
  // Decode URL-encoded title (slug is now the title)
  const slug = params.slug as string;
  const title = decodeURIComponent(slug);

  const [document, setDocument] = useState<Document | null>(null);
  const [graph, setGraph] = useState<Graph | null>(null);
  const [folderTitles, setFolderTitles] = useState<string[]>([]);
  const [depth, setDepth] = useState<number>(2);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [graphHeight, setGraphHeight] = useState(320);

  // Calculate responsive graph height
  useEffect(() => {
    const calculateHeight = () => {
      if (typeof window !== 'undefined') {
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
        // Use encodeURIComponent to handle special characters in title
        const [docRes, graphRes] = await Promise.all([
          fetch(`/api/documents/${encodeURIComponent(title)}`),
          fetch(`/api/graph`),
        ]);

        const docData = await docRes.json();
        const graphData = await graphRes.json();

        if (docData.success) {
          const doc = docData.data.document;
          setDocument(doc);

          // Fetch folder-scoped titles for wiki link validation
          const folder = doc.folder || "default";
          const titlesRes = await fetch(`/api/documents/titles?folder=${encodeURIComponent(folder)}`);
          const titlesData = await titlesRes.json();
          if (titlesData.success) {
            setFolderTitles(titlesData.data.titles || []);
          }
        } else {
          setError("Document not found");
        }

        if (graphData.success) {
          // Filter graph to only show same-folder nodes and links
          const currentFolder = docData.success ? (docData.data.document.folder || "default") : "default";
          const filteredGraph = filterGraphByFolder(graphData.data, currentFolder);
          setGraph(filteredGraph);
        }
      } catch (err) {
        setError("Failed to load document");
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [title]);

  // Wiki link click handler - navigate using encoded title
  function handleWikiLinkClick(pageName: string) {
    router.push(`/note/${encodeURIComponent(pageName)}`);
  }

  async function handleDelete() {
    if (!document || !confirm(`"${document.title}" 문서를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(document.title)}`, {
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
        <p className="text-lg text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error || !document) {
    // Display the decoded title for user-friendly error message
    const displayTitle = title;

    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">"{displayTitle}"</h1>
          <p className="text-lg text-muted-foreground mb-6">문서가 존재하지 않습니다</p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => router.push("/")} className="cursor-pointer">
              홈으로
            </Button>
            {!isPublishedMode() && (
              <Button onClick={() => router.push(`/editor/new?title=${encodeURIComponent(displayTitle)}`)} className="cursor-pointer">
                "{displayTitle}" 문서 만들기
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b bg-card p-4 sticky top-0 z-10">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => router.push("/")} className="cursor-pointer">
              ← 뒤로
            </Button>
            <div>
              <h1 className="text-xl font-bold">{document.title}</h1>
              {document.frontmatter.tags && document.frontmatter.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {document.frontmatter.tags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => router.push(`/documents?tags=${encodeURIComponent(tag)}`)}
                      className="text-xs px-2 py-0.5 bg-primary/10 text-primary hover:bg-primary/20 rounded cursor-pointer transition-colors"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {!isPublishedMode() && (
              <>
                <Button onClick={() => router.push(`/editor/${encodeURIComponent(document.title)}`)} className="cursor-pointer">
                  편집
                </Button>
                <Button variant="destructive" onClick={handleDelete} className="cursor-pointer">
                  삭제
                </Button>
              </>
            )}
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
                existingTitles={folderTitles}
              />
            </div>
          </div>

          {/* Local Graph Sidebar */}
          {graph && graph.nodes && graph.links && (
            <div className="lg:col-span-1">
              <div className="sticky top-20 bg-card border rounded-lg p-4 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold">로컬 그래프</h3>

                  {/* Compact Depth Slider */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-muted-foreground">깊이:</span>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3].map((level) => (
                        <button
                          key={level}
                          onClick={() => setDepth(level)}
                          className={`
                            w-7 h-7 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer
                            ${depth === level
                              ? 'bg-primary text-primary-foreground shadow-md scale-110'
                              : 'bg-muted text-muted-foreground hover:bg-accent'
                            }
                          `}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Graph - use encoded title for URL */}
                <ForceGraphView
                  graphData={graph as { nodes: { [url: string]: DigitalGardenNode }; links: GraphEdge[] }}
                  currentNodeUrl={`/${encodeURIComponent(document.title)}`}
                  depth={depth}
                  height={graphHeight}
                />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Metadata Footer */}
      <footer className="border-t bg-background p-4">
        <div className="container mx-auto max-w-4xl">
          <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground mb-4">
            <div>
              <span className="font-semibold">생성일:</span>{" "}
              {new Date(document.createdAt).toLocaleString()}
            </div>
            <div>
              <span className="font-semibold">수정일:</span>{" "}
              {new Date(document.updatedAt).toLocaleString()}
            </div>
          </div>

          {/* Links - these are now titles, not slugs */}
          {document.links.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold mb-2">
                링크 ({document.links.length})
              </h3>
              <div className="flex gap-2 flex-wrap">
                {document.links.map((link) => (
                  <button
                    key={link}
                    onClick={() => router.push(`/note/${encodeURIComponent(link)}`)}
                    className="text-sm px-3 py-1 bg-primary/10 text-primary rounded-full hover:bg-primary/20 cursor-pointer"
                  >
                    {link}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Backlinks - these are now titles, not slugs */}
          {document.backlinks.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">
                역링크 ({document.backlinks.length})
              </h3>
              <div className="flex gap-2 flex-wrap">
                {document.backlinks.map((backlink) => (
                  <button
                    key={backlink}
                    onClick={() => router.push(`/note/${encodeURIComponent(backlink)}`)}
                    className="text-sm px-3 py-1 bg-secondary/10 text-secondary rounded-full hover:bg-secondary/20 cursor-pointer"
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
