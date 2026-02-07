import { NextRequest, NextResponse } from 'next/server';
import { graphCache } from '@/lib/graph-cache';

/**
 * GET /api/graph
 * Get graph data (nodes and edges) from cache
 * Query params:
 * - refresh=true: Force refresh cache (used when folder structure changes)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shouldRefresh = searchParams.get('refresh') === 'true';

    // 폴더 구조 변경 시 강제 리프레시
    if (shouldRefresh) {
      console.log('[GraphAPI] Forcing cache refresh');
      await graphCache.refresh();
    }

    const graph = await graphCache.getGraph();
    const nodeCount = graph.nodes ? Object.keys(graph.nodes).length : 0;
    console.log(`[GraphAPI] Returning graph with ${nodeCount} nodes, refresh=${shouldRefresh}`);

    return NextResponse.json({
      success: true,
      data: graph,
    });
  } catch (error) {
    console.error('Error getting graph:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get graph',
      },
      { status: 500 }
    );
  }
}
