"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ForceGraphView from "@/components/graph/ForceGraphView";
import { Graph, DigitalGardenNode, GraphEdge } from "@/types";
import { Button } from "@/components/ui/button";
import { FolderTabs } from "@/components/ui/FolderTabs";
import AppHeader from "@/components/layout/AppHeader";
import { isPublishedMode } from "@/lib/env";
import { LoadingScreen } from "@/components/ui/spinner";

// Filter graph nodes and links by folder
function filterGraphByFolder(graph: Graph, folder: string | null): Graph {
  if (!folder || !graph.nodes) {
    return graph;
  }

  // Handle object-style nodes (DigitalGardenNode format)
  if (!Array.isArray(graph.nodes)) {
    const filteredNodesObj: { [url: string]: DigitalGardenNode } = {};
    const filteredNodeUrls = new Set<string>();

    // Filter nodes by folder
    Object.entries(graph.nodes).forEach(([url, node]) => {
      const dgNode = node as DigitalGardenNode;
      if ((dgNode as any).folder === folder) {
        filteredNodesObj[url] = dgNode;
        filteredNodeUrls.add(url);
      }
    });

    // Create a mapping from old IDs to new IDs
    const nodeIdMapping = new Map<number, number>();
    let newId = 0;
    Object.values(filteredNodesObj).forEach((node) => {
      nodeIdMapping.set(node.id, newId);
      node.id = newId++;
    });

    // Filter links (only keep links between filtered nodes)
    const filteredLinks = (graph.links || []).filter((link) => {
      const sourceNode = Object.values(graph.nodes as { [url: string]: DigitalGardenNode }).find(n => n.id === link.source);
      const targetNode = Object.values(graph.nodes as { [url: string]: DigitalGardenNode }).find(n => n.id === link.target);

      if (!sourceNode || !targetNode) return false;

      const sourceUrl = sourceNode.url;
      const targetUrl = targetNode.url;

      return filteredNodeUrls.has(sourceUrl) && filteredNodeUrls.has(targetUrl);
    }).map((link) => ({
      source: nodeIdMapping.get(link.source as number) ?? link.source,
      target: nodeIdMapping.get(link.target as number) ?? link.target,
    }));

    return {
      nodes: filteredNodesObj,
      links: filteredLinks,
    };
  }

  return graph;
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [graph, setGraph] = useState<Graph | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [windowHeight, setWindowHeight] = useState(0);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  // Read folder from URL params
  useEffect(() => {
    const folderParam = searchParams.get("folder");
    if (folderParam) {
      setSelectedFolder(decodeURIComponent(folderParam));
    } else {
      setSelectedFolder(null);
    }
  }, [searchParams]);

  // Initialize and track window height
  useEffect(() => {
    const handleResize = () => {
      setWindowHeight(window.innerHeight);
    };

    // Set initial height
    handleResize();

    // Add resize listener
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchGraph();
  }, []);

  async function fetchGraph() {
    try {
      const res = await fetch("/api/graph");
      const data = await res.json();

      if (data.success) {
        setGraph(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch graph:", err);
    } finally {
      setIsLoading(false);
    }
  }

  function handleFolderChange(folder: string | null) {
    if (folder) {
      router.push(`/?folder=${encodeURIComponent(folder)}`);
    } else {
      router.push("/");
    }
  }

  // Filter graph by selected folder
  const filteredGraph = graph ? filterGraphByFolder(graph, selectedFolder) : null;

  if (isLoading) {
    return <LoadingScreen message="그래프 로딩 중..." />;
  }

  if (!graph) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-red-600">그래프를 불러올 수 없습니다</p>
      </div>
    );
  }

  // Calculate node and link counts
  const displayGraph = filteredGraph || graph;
  const totalNodeCount = graph.nodes ? (Array.isArray(graph.nodes) ? graph.nodes.length : Object.keys(graph.nodes).length) : 0;
  const nodeCount = displayGraph.nodes ? (Array.isArray(displayGraph.nodes) ? displayGraph.nodes.length : Object.keys(displayGraph.nodes).length) : 0;
  const linkCount = (displayGraph.links || displayGraph.edges || []).length;

  // Check if this is a completely empty garden (no notes at all)
  const isCompletelyEmpty = totalNodeCount === 0;
  // Check if current folder is empty but there are notes elsewhere
  const isFolderEmpty = nodeCount === 0 && !isCompletelyEmpty;

  // Completely empty state - no documents at all, hide folder tabs
  if (isCompletelyEmpty) {
    return (
      <div className="flex flex-col h-screen overflow-hidden">
        <div className="shrink-0">
          <AppHeader
            showLogo
            subtitle="노트가 없습니다"
            actions={
              !isPublishedMode() ? (
                <Button onClick={() => router.push(`/editor/new${selectedFolder ? `?folder=${encodeURIComponent(selectedFolder)}` : ''}`)} className="cursor-pointer">
                  + 새 노트
                </Button>
              ) : undefined
            }
          />
        </div>

        {/* Still show folder tabs for folder management */}
        <div className="shrink-0 px-4 pt-2 bg-background">
          <FolderTabs
            selectedFolder={selectedFolder}
            onFolderChange={handleFolderChange}
          />
        </div>

        <main className="flex-1 flex items-center justify-center bg-muted">
          <div className="text-center max-w-md px-6">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-12 h-12 text-primary"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-3">아직 노트가 없습니다</h2>
            <p className="text-muted-foreground mb-6">
              {isPublishedMode()
                ? "이 디지털 가든에는 아직 공개된 노트가 없습니다."
                : "첫 번째 노트를 작성하여 당신만의 지식 그래프를 시작하세요."}
            </p>
            {!isPublishedMode() && (
              <Button onClick={() => router.push(`/editor/new${selectedFolder ? `?folder=${encodeURIComponent(selectedFolder)}` : ''}`)} size="lg" className="cursor-pointer">
                첫 번째 노트 작성하기
              </Button>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="shrink-0">
        <AppHeader
          showLogo
          subtitle={
            selectedFolder
              ? `${nodeCount}개 노트, ${linkCount}개 연결 (${selectedFolder})`
              : `${totalNodeCount}개 노트`
          }
          actions={
            <>
              <Button variant="outline" onClick={() => router.push("/documents")} className="cursor-pointer">
                목록 보기
              </Button>
              {!isPublishedMode() && (
                <Button onClick={() => router.push(`/editor/new${selectedFolder ? `?folder=${encodeURIComponent(selectedFolder)}` : ''}`)} className="cursor-pointer">
                  + 새 노트
                </Button>
              )}
            </>
          }
        />
      </div>

      {/* Folder Tabs (hide All tab on graph view) */}
      <div className="shrink-0 px-4 pt-2 bg-background">
        <FolderTabs
          selectedFolder={selectedFolder}
          onFolderChange={handleFolderChange}
          hideAllTab={true}
        />
      </div>

      {/* Graph View */}
      <main className="flex-1 bg-muted overflow-hidden">
        {isFolderEmpty ? (
          // Empty folder state
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center max-w-md px-6">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-muted-foreground/10 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-10 h-10 text-muted-foreground"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {selectedFolder ? `"${selectedFolder}" 폴더가 비어있습니다` : "이 폴더가 비어있습니다"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                이 폴더에 노트를 추가하거나 다른 폴더를 선택하세요.
              </p>
              {!isPublishedMode() && (
                <Button onClick={() => router.push(`/editor/new${selectedFolder ? `?folder=${encodeURIComponent(selectedFolder)}` : ''}`)} className="cursor-pointer">
                  + 새 노트 작성
                </Button>
              )}
            </div>
          </div>
        ) : (
          // Normal graph view
          <div className="w-full h-full">
            {windowHeight > 0 && displayGraph && displayGraph.nodes && displayGraph.links && (
              <ForceGraphView
                graphData={displayGraph as { nodes: { [url: string]: DigitalGardenNode }; links: GraphEdge[] }}
                height={windowHeight - 160}
                showSearchFilter={true}
              />
            )}
          </div>
        )}
      </main>

      {/* Quick Tips */}
      <div className="border-t bg-background p-3 shrink-0">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          <span className="font-semibold">팁:</span> 노드를 클릭하여 노트 보기
          • 마우스를 올려 연결 확인 • 큰 노드 = 더 많은 연결
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-muted-foreground">그래프 로딩 중...</p>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
