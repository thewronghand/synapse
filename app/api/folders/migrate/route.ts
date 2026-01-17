import { NextResponse } from 'next/server';
import { migrateRootNotesToDefault } from '@/lib/folder-utils';
import fs from 'fs/promises';
import { getNotesDir } from '@/lib/notes-path';

const NOTES_DIR = getNotesDir();

/**
 * GET /api/folders/migrate
 * Preview root notes that will be migrated to default folder
 */
export async function GET() {
  try {
    // Check for root-level markdown files
    const entries = await fs.readdir(NOTES_DIR, { withFileTypes: true });
    const rootFiles = entries.filter(
      (e) => e.isFile() && e.name.endsWith('.md')
    );

    return NextResponse.json({
      success: true,
      data: {
        count: rootFiles.length,
        files: rootFiles.map((f) => f.name),
      },
    });
  } catch (error) {
    console.error('Error previewing folder migration:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/folders/migrate
 * Execute migration of root notes to default folder
 */
export async function POST() {
  try {
    const result = await migrateRootNotesToDefault();

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        migrated: result.migrated,
      },
    });
  } catch (error) {
    console.error('Error executing folder migration:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
