import { NextResponse } from 'next/server';
import { getExportDataDir } from '@/lib/data-path';
import fs from 'fs/promises';
import path from 'path';

/**
 * GET /api/export/status
 * Check if export data exists and return basic info
 */
export async function GET() {
  try {
    const exportDir = getExportDataDir();

    // Check if export directory exists
    const dirExists = await fs.stat(exportDir).then(() => true).catch(() => false);

    if (!dirExists) {
      return NextResponse.json({
        success: true,
        data: {
          hasExportData: false,
          documentsCount: 0,
          foldersCount: 0,
          exportPath: exportDir,
        },
      });
    }

    // Check for required files
    const graphJsonPath = path.join(exportDir, 'graph.json');
    const documentsJsonPath = path.join(exportDir, 'documents.json');
    const foldersJsonPath = path.join(exportDir, 'folders.json');

    const [hasGraphJson, hasDocumentsJson, hasFoldersJson] = await Promise.all([
      fs.stat(graphJsonPath).then(() => true).catch(() => false),
      fs.stat(documentsJsonPath).then(() => true).catch(() => false),
      fs.stat(foldersJsonPath).then(() => true).catch(() => false),
    ]);

    // If key files don't exist, consider export data as not available
    if (!hasGraphJson || !hasDocumentsJson) {
      return NextResponse.json({
        success: true,
        data: {
          hasExportData: false,
          documentsCount: 0,
          foldersCount: 0,
          exportPath: exportDir,
        },
      });
    }

    // Get counts from JSON files
    let documentsCount = 0;
    let foldersCount = 0;

    try {
      const documentsData = await fs.readFile(documentsJsonPath, 'utf-8');
      const documents = JSON.parse(documentsData);
      documentsCount = Array.isArray(documents) ? documents.length : 0;
    } catch {
      // ignore
    }

    try {
      const foldersData = await fs.readFile(foldersJsonPath, 'utf-8');
      const folders = JSON.parse(foldersData);
      foldersCount = Array.isArray(folders) ? folders.length : 0;
    } catch {
      // ignore
    }

    // Get last modified time of documents.json as export time
    let lastExportTime: string | null = null;
    try {
      const stats = await fs.stat(documentsJsonPath);
      lastExportTime = stats.mtime.toISOString();
    } catch {
      // ignore
    }

    return NextResponse.json({
      success: true,
      data: {
        hasExportData: true,
        documentsCount,
        foldersCount,
        lastExportTime,
        exportPath: exportDir,
      },
    });
  } catch (error) {
    console.error('[Export Status] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check export status',
      },
      { status: 500 }
    );
  }
}
