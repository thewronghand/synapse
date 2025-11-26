import { NextResponse } from 'next/server';
import { exportToJSON } from '@/lib/export';

export async function POST() {
  try {
    const result = await exportToJSON();

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
