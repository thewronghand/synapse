"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ForceGraphView from "@/components/graph/ForceGraphView";
import { Graph, DigitalGardenNode, GraphEdge } from "@/types";
import { Button } from "@/components/ui/button";

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
        <p className="text-lg text-gray-600">그래프 로딩 중...</p>
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

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="border-b bg-white p-4 flex-shrink-0">
        <div className="container mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Synapse</h1>
            <p className="text-sm text-gray-600">
              {nodeCount}개 노트, {linkCount}개 연결
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/documents")} className="cursor-pointer">
              목록 보기
            </Button>
            <Button onClick={() => router.push("/editor/new")} className="cursor-pointer">
              + 새 노트
            </Button>
          </div>
        </div>
      </header>

      {/* Graph View */}
      <main className="flex-1 bg-gray-50 overflow-hidden">
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
      <div className="border-t bg-white p-3 flex-shrink-0">
        <div className="container mx-auto text-center text-sm text-gray-600">
          <span className="font-semibold">팁:</span> 노드를 클릭하여 노트 보기
          • 마우스를 올려 연결 확인 • 큰 노드 = 더 많은 연결
        </div>
      </div>
    </div>
  );
}
