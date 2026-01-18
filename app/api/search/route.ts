import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import fss from 'fs';
import path from 'path';
import {
  parseFrontmatter,
  extractTitle,
  getTitleFromFilename,
} from '@/lib/document-parser';
import { getNotesDir } from '@/lib/notes-path';
import { isPublishedMode } from '@/lib/env';

const NOTES_DIR = getNotesDir();

interface SearchResult {
  title: string;
  folder: string;
  snippet: string;
  matchStart: number;
  matchEnd: number;
  tags: string[];
}

/**
 * GET /api/search
 * Search documents by content
 * Query params:
 *   - q: search query (required)
 *   - folder: folder filter (optional)
 *   - limit: max results (default: 20)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const folder = searchParams.get('folder');
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    if (!query || query.trim().length === 0) {
      return NextResponse.json({
        success: true,
        data: { results: [], total: 0 },
      });
    }

    const results = await searchDocuments(query.trim(), folder || undefined, limit);

    return NextResponse.json({
      success: true,
      data: {
        results,
        total: results.length,
        query,
        folder: folder || 'all',
      },
    });
  } catch (error) {
    console.error('Error searching documents:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to search documents',
      },
      { status: 500 }
    );
  }
}

/**
 * Search documents by content
 */
async function searchDocuments(
  query: string,
  folderFilter?: string,
  limit: number = 20
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const lowerQuery = query.toLowerCase();

  // In published mode, read from JSON file
  if (isPublishedMode()) {
    const jsonPath = path.join(process.cwd(), 'public', 'data', 'documents.json');
    const jsonData = await fs.readFile(jsonPath, 'utf-8');
    const docs = JSON.parse(jsonData);

    for (const doc of docs) {
      if (folderFilter && doc.folder !== folderFilter) continue;
      if (results.length >= limit) break;

      const content = doc.contentWithoutFrontmatter || doc.content || '';
      const lowerContent = content.toLowerCase();
      const matchIndex = lowerContent.indexOf(lowerQuery);

      if (matchIndex !== -1) {
        const snippet = extractSnippet(content, matchIndex, query.length);
        results.push({
          title: doc.title,
          folder: doc.folder || '',
          snippet: snippet.text,
          matchStart: snippet.matchStart,
          matchEnd: snippet.matchEnd,
          tags: doc.frontmatter?.tags || [],
        });
      }
    }

    return results;
  }

  // Read from file system
  const entries = await fs.readdir(NOTES_DIR, { withFileTypes: true });
  const folders = entries.filter((e) => e.isDirectory());

  for (const folder of folders) {
    if (folderFilter && folder.name !== folderFilter) continue;
    if (results.length >= limit) break;

    const folderPath = path.join(NOTES_DIR, folder.name);
    const files = await fs.readdir(folderPath);
    const markdownFiles = files.filter((f) => f.endsWith('.md'));

    for (const file of markdownFiles) {
      if (results.length >= limit) break;

      const filePath = path.join(folderPath, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);
      const filenameTitle = getTitleFromFilename(file);
      const title = extractTitle(contentWithoutFrontmatter, frontmatter) || filenameTitle;

      const lowerContent = contentWithoutFrontmatter.toLowerCase();
      const matchIndex = lowerContent.indexOf(lowerQuery);

      if (matchIndex !== -1) {
        const snippet = extractSnippet(contentWithoutFrontmatter, matchIndex, query.length);
        results.push({
          title,
          folder: folder.name,
          snippet: snippet.text,
          matchStart: snippet.matchStart,
          matchEnd: snippet.matchEnd,
          tags: frontmatter.tags || [],
        });
      }
    }
  }

  // Also check root-level files (legacy)
  if (!folderFilter) {
    const rootFiles = entries.filter((e) => e.isFile() && e.name.endsWith('.md'));
    for (const fileEntry of rootFiles) {
      if (results.length >= limit) break;

      const filePath = path.join(NOTES_DIR, fileEntry.name);
      const content = await fs.readFile(filePath, 'utf-8');
      const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);
      const filenameTitle = getTitleFromFilename(fileEntry.name);
      const title = extractTitle(contentWithoutFrontmatter, frontmatter) || filenameTitle;

      const lowerContent = contentWithoutFrontmatter.toLowerCase();
      const matchIndex = lowerContent.indexOf(lowerQuery);

      if (matchIndex !== -1) {
        const snippet = extractSnippet(contentWithoutFrontmatter, matchIndex, query.length);
        results.push({
          title,
          folder: '',
          snippet: snippet.text,
          matchStart: snippet.matchStart,
          matchEnd: snippet.matchEnd,
          tags: frontmatter.tags || [],
        });
      }
    }
  }

  return results;
}

/**
 * Extract a snippet around the match with context
 */
function extractSnippet(
  content: string,
  matchIndex: number,
  queryLength: number,
  contextChars: number = 80
): { text: string; matchStart: number; matchEnd: number } {
  const start = Math.max(0, matchIndex - contextChars);
  const end = Math.min(content.length, matchIndex + queryLength + contextChars);

  let snippet = content.slice(start, end);

  // Clean up the snippet - remove markdown syntax, newlines
  snippet = snippet
    .replace(/\n+/g, ' ')
    .replace(/#{1,6}\s*/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .trim();

  // Add ellipsis if truncated
  const prefix = start > 0 ? '...' : '';
  const suffix = end < content.length ? '...' : '';

  const finalSnippet = prefix + snippet + suffix;

  // Find the actual match position in the cleaned snippet
  // The original query text should still exist after markdown removal
  const originalMatch = content.slice(matchIndex, matchIndex + queryLength);
  const lowerSnippet = finalSnippet.toLowerCase();
  const lowerMatch = originalMatch.toLowerCase();

  const matchStartInSnippet = lowerSnippet.indexOf(lowerMatch);

  if (matchStartInSnippet !== -1) {
    return {
      text: finalSnippet,
      matchStart: matchStartInSnippet,
      matchEnd: matchStartInSnippet + queryLength,
    };
  }

  // Fallback: if exact match not found, return without highlight
  return {
    text: finalSnippet,
    matchStart: 0,
    matchEnd: 0,
  };
}
