import { NextResponse } from 'next/server';
import { graphCache } from '@/lib/graph-cache';

/**
 * GET /api/graph
 * Get graph data (nodes and edges) from cache
 */
export async function GET() {
  try {
    const graph = await graphCache.getGraph();

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
