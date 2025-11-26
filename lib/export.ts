import fs from 'fs/promises';
import fss from 'fs';
import path from 'path';
import { Document } from '@/types';
import { parseFrontmatter, extractTitle, extractWikiLinks, calculateBacklinks, getSlugFromFilePath } from './document-parser';
import { getNotesDir } from './notes-path';

const NOTES_DIR = getNotesDir();

/**
 * Get all documents
 */
async function getAllDocuments(): Promise<Document[]> {
  const files = await fs.readdir(NOTES_DIR);
  const markdownFiles = files.filter((file) => file.endsWith('.md'));

  const documentsWithoutBacklinks = await Promise.all(
    markdownFiles.map(async (file) => {
      const filePath = path.join(NOTES_DIR, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const stats = await fs.stat(filePath);

      const slug = getSlugFromFilePath(file);
      const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);
      const title = extractTitle(contentWithoutFrontmatter, frontmatter);
      const links = extractWikiLinks(content);

      return {
        slug,
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

  // Calculate backlinks
  const backlinksMap = calculateBacklinks(documentsWithoutBacklinks);

  // Add backlinks to documents
  const documents = documentsWithoutBacklinks.map((doc) => ({
    ...doc,
    backlinks: backlinksMap.get(doc.slug) || [],
  }));

  return documents;
}

/**
 * Build graph from documents (Digital Garden format)
 */
function buildGraph(documents: Document[]) {
  const nodesObject: { [url: string]: any } = {};
  const links: any[] = [];
  let nodeId = 0;

  documents.forEach((doc) => {
    const allLinks = [...new Set([...doc.links, ...doc.backlinks])]; // Bidirectional neighbors

    nodesObject[`/${doc.slug}`] = {
      id: nodeId++,
      title: doc.title,
      url: `/${doc.slug}`,
      neighbors: allLinks.map(slug => `/${slug}`),
      backLinks: doc.backlinks.map(slug => `/${slug}`),
      size: Math.min(7, Math.max(2, allLinks.length / 2)),
      color: getNodeColor(doc.frontmatter.tags || [], doc.backlinks.length),
      hide: false,
      tags: doc.frontmatter.tags || [],
    };
  });

  // Build edges using node IDs
  documents.forEach((doc) => {
    doc.links.forEach((targetSlug) => {
      const sourceNode = nodesObject[`/${doc.slug}`];
      const targetNode = nodesObject[`/${targetSlug}`];

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

  // 2. Export individual documents
  const docsDir = path.join(exportDir, 'docs');
  if (!fss.existsSync(docsDir)) {
    fss.mkdirSync(docsDir, { recursive: true });
  }

  for (const doc of documents) {
    await fs.writeFile(
      path.join(docsDir, `${doc.slug}.json`),
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
