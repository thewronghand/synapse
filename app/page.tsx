"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ForceGraphView from "@/components/graph/ForceGraphView";
import { Graph, DigitalGardenNode, GraphEdge } from "@/types";
import { Button } from "@/components/ui/button";
import AppHeader from "@/components/layout/AppHeader";
import Logo from "@/components/ui/Logo";
import { isPublishedMode } from "@/lib/env";

export default function Home() {
  const router = useRouter();
  const [graph, setGraph] = useState<Graph | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [windowHeight, setWindowHeight] = useState(0);

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

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-muted-foreground">그래프 로딩 중...</p>
      </div>
    );
  }

  if (!graph) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-red-600">그래프를 불러올 수 없습니다</p>
      </div>
    );
  }

  // Calculate node and link counts
  const nodeCount = graph.nodes ? (Array.isArray(graph.nodes) ? graph.nodes.length : Object.keys(graph.nodes).length) : 0;
  const linkCount = (graph.links || graph.edges || []).length;

  // Empty state - no documents
  if (nodeCount === 0) {
    return (
      <div className="flex flex-col h-screen overflow-hidden">
        <div className="shrink-0">
          <AppHeader
            title={<Logo width={160} height={45} />}
            subtitle={
              <p className="text-sm text-muted-foreground mt-1">
                노트가 없습니다
              </p>
            }
            actions={
              !isPublishedMode() ? (
                <Button onClick={() => router.push("/editor/new")} className="cursor-pointer">
                  + 새 노트
                </Button>
              ) : undefined
            }
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
              <Button onClick={() => router.push("/editor/new")} size="lg" className="cursor-pointer">
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
          title={<Logo width={160} height={45} />}
          subtitle={
            <p className="text-sm text-muted-foreground mt-1">
              {nodeCount}개 노트, {linkCount}개 연결
            </p>
          }
          actions={
            <>
              <Button variant="outline" onClick={() => router.push("/documents")} className="cursor-pointer">
                목록 보기
              </Button>
              {!isPublishedMode() && (
                <Button onClick={() => router.push("/editor/new")} className="cursor-pointer">
                  + 새 노트
                </Button>
              )}
            </>
          }
        />
      </div>

      {/* Graph View */}
      <main className="flex-1 bg-muted overflow-hidden">
        <div className="w-full h-full">
          {windowHeight > 0 && graph && graph.nodes && graph.links && (
            <ForceGraphView
              graphData={graph as { nodes: { [url: string]: DigitalGardenNode }; links: GraphEdge[] }}
              height={windowHeight - 120}
              showSearchFilter={true}
            />
          )}
        </div>
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
