import { NextRequest, NextResponse } from 'next/server';
import { exportToJSON } from '@/lib/export';

export async function POST(request: NextRequest) {
  try {
    // Parse optional excludedFolders from request body
    let excludedFolders: string[] = [];
    try {
      const body = await request.json();
      if (Array.isArray(body.excludedFolders)) {
        excludedFolders = body.excludedFolders;
      }
    } catch {
      // No body or invalid JSON - use empty array
    }

    const result = await exportToJSON(excludedFolders);

    return NextResponse.json({
      success: true,
      message: 'Export completed successfully',
      data: result,
    });
  } catch (error) {
    console.error('[Export API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Export failed',
      },
      { status: 500 }
    );
  }
}
