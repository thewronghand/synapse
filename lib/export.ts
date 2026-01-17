import fs from 'fs/promises';
import fss from 'fs';
import path from 'path';
import { Document } from '@/types';
import { parseFrontmatter, extractTitle, extractWikiLinks, getTitleFromFilename, titlesMatch } from './document-parser';
import { getNotesDir } from './notes-path';

const NOTES_DIR = getNotesDir();

/**
 * Get all documents (제목 기반)
 */
async function getAllDocuments(): Promise<Document[]> {
  const files = await fs.readdir(NOTES_DIR);
  const markdownFiles = files.filter((file) => file.endsWith('.md'));

  const documentsWithoutBacklinks = await Promise.all(
    markdownFiles.map(async (file) => {
      const filePath = path.join(NOTES_DIR, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const stats = await fs.stat(filePath);

      const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);
      const filenameTitle = getTitleFromFilename(file);
      const title = extractTitle(contentWithoutFrontmatter, frontmatter) || filenameTitle;
      const links = extractWikiLinks(content);

      return {
        slug: title, // 제목을 slug로 사용 (하위 호환성)
        filePath: `notes/${file}`,
        title,
        content,
        contentWithoutFrontmatter,
        frontmatter,
        links,
        backlinks: [],
        createdAt: stats.birthtime,
        updatedAt: stats.mtime,
      };
    })
  );

  // Calculate backlinks (제목 기반)
  const backlinksMap = calculateBacklinksByTitle(documentsWithoutBacklinks);

  // Add backlinks to documents
  const documents = documentsWithoutBacklinks.map((doc) => ({
    ...doc,
    backlinks: backlinksMap.get(doc.title) || [],
  }));

  return documents;
}

/**
 * Calculate backlinks by title (제목 기반)
 */
function calculateBacklinksByTitle(documents: Document[]): Map<string, string[]> {
  const backlinksMap = new Map<string, string[]>();

  // Initialize backlinks for all documents
  documents.forEach(doc => {
    backlinksMap.set(doc.title, []);
  });

  // For each document, check its links
  documents.forEach(sourceDoc => {
    sourceDoc.links.forEach(linkTitle => {
      // Find the target document by title (case-insensitive)
      const targetDoc = documents.find(d => titlesMatch(d.title, linkTitle));
      if (targetDoc) {
        const existingBacklinks = backlinksMap.get(targetDoc.title) || [];
        if (!existingBacklinks.some(bl => titlesMatch(bl, sourceDoc.title))) {
          existingBacklinks.push(sourceDoc.title);
          backlinksMap.set(targetDoc.title, existingBacklinks);
        }
      }
    });
  });

  return backlinksMap;
}

/**
 * Build graph from documents (Digital Garden format) - 제목 기반
 */
function buildGraph(documents: Document[]) {
  const nodesObject: { [url: string]: any } = {};
  const links: any[] = [];
  let nodeId = 0;

  documents.forEach((doc) => {
    const allLinks = [...new Set([...doc.links, ...doc.backlinks])]; // Bidirectional neighbors
    const encodedTitle = encodeURIComponent(doc.title);

    nodesObject[`/${encodedTitle}`] = {
      id: nodeId++,
      title: doc.title,
      url: `/${encodedTitle}`,
      neighbors: allLinks.map(title => `/${encodeURIComponent(title)}`),
      backLinks: doc.backlinks.map(title => `/${encodeURIComponent(title)}`),
      size: Math.min(7, Math.max(2, allLinks.length / 2)),
      color: getNodeColor(doc.frontmatter.tags || [], doc.backlinks.length),
      hide: false,
      tags: doc.frontmatter.tags || [],
    };
  });

  // Build edges using node IDs
  documents.forEach((doc) => {
    const encodedSourceTitle = encodeURIComponent(doc.title);
    doc.links.forEach((targetTitle) => {
      // Find target document by title (case-insensitive)
      const targetDoc = documents.find(d => titlesMatch(d.title, targetTitle));
      if (!targetDoc) return;

      const encodedTargetTitle = encodeURIComponent(targetDoc.title);
      const sourceNode = nodesObject[`/${encodedSourceTitle}`];
      const targetNode = nodesObject[`/${encodedTargetTitle}`];

      if (sourceNode && targetNode) {
        links.push({
          source: sourceNode.id,
          target: targetNode.id,
        });
      }
    });
  });

  return { nodes: nodesObject, links };
}

/**
 * Get node color based on tags or backlink count
 */
function getNodeColor(tags: string[], backlinkCount: number): string {
  // Color by tag
  if (tags.includes('guide') || tags.includes('tutorial')) {
    return '#3b82f6'; // blue
  }
  if (tags.includes('getting-started')) {
    return '#10b981'; // green
  }
  if (tags.includes('features')) {
    return '#8b5cf6'; // purple
  }

  // Color by importance (backlink count)
  if (backlinkCount >= 3) {
    return '#ef4444'; // red - highly connected
  }
  if (backlinkCount >= 1) {
    return '#f59e0b'; // orange - connected
  }

  return '#6b7280'; // gray - default
}

/**
 * Export all documents and graph data to JSON files for static deployment
 */
export async function exportToJSON() {
  const exportDir = path.join(process.cwd(), 'public', 'data');

  // Create export directory if it doesn't exist
  if (!fss.existsSync(exportDir)) {
    fss.mkdirSync(exportDir, { recursive: true });
  }

  console.log('[Export] Starting data export...');

  // 1. Export all documents
  const documents = await getAllDocuments();

  await fs.writeFile(
    path.join(exportDir, 'documents.json'),
    JSON.stringify(documents, null, 2)
  );
  console.log(`[Export] Exported ${documents.length} documents`);

  // 2. Export individual documents (제목을 인코딩하여 파일명으로 사용)
  const docsDir = path.join(exportDir, 'docs');
  if (!fss.existsSync(docsDir)) {
    fss.mkdirSync(docsDir, { recursive: true });
  }

  for (const doc of documents) {
    // 제목을 URL 인코딩하여 파일명으로 사용
    const encodedTitle = encodeURIComponent(doc.title);
    await fs.writeFile(
      path.join(docsDir, `${encodedTitle}.json`),
      JSON.stringify(doc, null, 2)
    );
  }
  console.log(`[Export] Exported individual document files`);

  // 3. Export graph data
  const graph = buildGraph(documents);

  await fs.writeFile(
    path.join(exportDir, 'graph.json'),
    JSON.stringify(graph, null, 2)
  );
  console.log('[Export] Exported graph data');

  // 4. Export tags (as sorted string array)
  const tagsSet = new Set<string>();
  documents.forEach(doc => {
    if (doc.frontmatter.tags) {
      doc.frontmatter.tags.forEach(tag => {
        tagsSet.add(tag);
      });
    }
  });

  const tagsArray = Array.from(tagsSet).sort();

  await fs.writeFile(
    path.join(exportDir, 'tags.json'),
    JSON.stringify(tagsArray, null, 2)
  );
  console.log(`[Export] Exported ${tagsArray.length} tags`);

  // 5. Export titles (as sorted string array)
  const titles = documents
    .map(doc => doc.title)
    .sort();

  await fs.writeFile(
    path.join(exportDir, 'titles.json'),
    JSON.stringify(titles, null, 2)
  );
  console.log(`[Export] Exported ${titles.length} titles`);

  console.log('[Export] Export complete!');

  return {
    success: true,
    documentsCount: documents.length,
    tagsCount: tagsArray.length,
    exportPath: exportDir,
  };
}
