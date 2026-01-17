import fs from 'fs/promises';
import fss from 'fs';
import path from 'path';
import { Document } from '@/types';
import { parseFrontmatter, extractTitle, extractWikiLinks, getTitleFromFilename, titlesMatch } from './document-parser';
import { getNotesDir } from './notes-path';
import { ensureDefaultFolder } from './folder-utils';

const NOTES_DIR = getNotesDir();

/**
 * Get all documents (폴더 지원)
 */
async function getAllDocuments(): Promise<Document[]> {
  await ensureDefaultFolder();

  const entries = await fs.readdir(NOTES_DIR, { withFileTypes: true });
  const folders = entries.filter((e) => e.isDirectory());
  const rootFiles = entries.filter((e) => e.isFile() && e.name.endsWith('.md'));

  const documentsWithoutBacklinks: Document[] = [];

  // Process folders
  for (const folder of folders) {
    const folderPath = path.join(NOTES_DIR, folder.name);
    const files = await fs.readdir(folderPath);
    const markdownFiles = files.filter((f) => f.endsWith('.md'));

    const folderDocs = await Promise.all(
      markdownFiles.map(async (file) => {
        const filePath = path.join(folderPath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const stats = await fs.stat(filePath);

        const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);
        const filenameTitle = getTitleFromFilename(file);
        const title = extractTitle(contentWithoutFrontmatter, frontmatter) || filenameTitle;
        const links = extractWikiLinks(content);

        return {
          slug: title,
          filePath: `notes/${folder.name}/${file}`,
          title,
          folder: folder.name,
          content,
          contentWithoutFrontmatter,
          frontmatter,
          links,
          backlinks: [] as string[],
          createdAt: stats.birthtime,
          updatedAt: stats.mtime,
        };
      })
    );
    documentsWithoutBacklinks.push(...folderDocs);
  }

  // Process root-level files (legacy)
  if (rootFiles.length > 0) {
    const rootDocs = await Promise.all(
      rootFiles.map(async (file) => {
        const filePath = path.join(NOTES_DIR, file.name);
        const content = await fs.readFile(filePath, 'utf-8');
        const stats = await fs.stat(filePath);

        const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);
        const filenameTitle = getTitleFromFilename(file.name);
        const title = extractTitle(contentWithoutFrontmatter, frontmatter) || filenameTitle;
        const links = extractWikiLinks(content);

        return {
          slug: title,
          filePath: `notes/${file.name}`,
          title,
          folder: '',
          content,
          contentWithoutFrontmatter,
          frontmatter,
          links,
          backlinks: [] as string[],
          createdAt: stats.birthtime,
          updatedAt: stats.mtime,
        };
      })
    );
    documentsWithoutBacklinks.push(...rootDocs);
  }

  // Calculate backlinks per folder (folder isolation)
  const documentsByFolder = new Map<string, Document[]>();
  documentsWithoutBacklinks.forEach(doc => {
    const folder = doc.folder || 'default';
    if (!documentsByFolder.has(folder)) {
      documentsByFolder.set(folder, []);
    }
    documentsByFolder.get(folder)!.push(doc);
  });

  // Calculate backlinks within each folder separately
  const folderBacklinksMaps = new Map<string, Map<string, string[]>>();
  for (const [folder, docs] of documentsByFolder) {
    const backlinksMap = calculateBacklinksByTitle(docs);
    folderBacklinksMaps.set(folder, backlinksMap);
  }

  // Add folder-scoped backlinks to documents
  const documents = documentsWithoutBacklinks.map((doc) => {
    const folder = doc.folder || 'default';
    const folderBacklinks = folderBacklinksMaps.get(folder);
    return {
      ...doc,
      backlinks: folderBacklinks?.get(doc.title) || [],
    };
  });

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
 * Edges and neighbors are now folder-scoped (folder isolation)
 */
function buildGraph(documents: Document[]) {
  const nodesObject: { [url: string]: any } = {};
  const links: any[] = [];
  let nodeId = 0;

  // Create a map for quick title+folder lookup
  const titleFolderToDoc = new Map<string, Document>();
  documents.forEach(doc => {
    const folder = doc.folder || 'default';
    const key = `${folder}:${doc.title.normalize('NFC').toLowerCase()}`;
    titleFolderToDoc.set(key, doc);
  });

  documents.forEach((doc) => {
    const folder = doc.folder || 'default';

    // Only include links/neighbors that exist in the same folder
    const sameFolderLinks = doc.links.filter(linkedTitle => {
      const linkedKey = `${folder}:${linkedTitle.normalize('NFC').toLowerCase()}`;
      return titleFolderToDoc.has(linkedKey);
    });

    // Combine forward links and backlinks for neighbors (all same-folder)
    const allLinks = [...new Set([...sameFolderLinks, ...doc.backlinks])];
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
      folder: doc.folder, // Include folder info in graph
    };
  });

  // Build edges only for links within the same folder (folder isolation)
  documents.forEach((doc) => {
    const folder = doc.folder || 'default';
    const encodedSourceTitle = encodeURIComponent(doc.title);

    doc.links.forEach((targetTitle) => {
      // Only create edge if target is in the same folder
      const targetKey = `${folder}:${targetTitle.normalize('NFC').toLowerCase()}`;
      const targetDoc = titleFolderToDoc.get(targetKey);

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
  if (tags.includes('guide') || tags.includes('tutorial')) {
    return '#3b82f6';
  }
  if (tags.includes('getting-started')) {
    return '#10b981';
  }
  if (tags.includes('features')) {
    return '#8b5cf6';
  }

  if (backlinkCount >= 3) {
    return '#ef4444';
  }
  if (backlinkCount >= 1) {
    return '#f59e0b';
  }

  return '#6b7280';
}

/**
 * Export all documents and graph data to JSON files for static deployment
 */
export async function exportToJSON() {
  const exportDir = path.join(process.cwd(), 'public', 'data');

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

  // 4. Export tags
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

  // 5. Export titles
  const titles = documents.map(doc => doc.title).sort();

  await fs.writeFile(
    path.join(exportDir, 'titles.json'),
    JSON.stringify(titles, null, 2)
  );
  console.log(`[Export] Exported ${titles.length} titles`);

  // 6. Export folders
  const foldersSet = new Set<string>();
  documents.forEach(doc => {
    if (doc.folder) {
      foldersSet.add(doc.folder);
    }
  });

  const foldersArray = Array.from(foldersSet).sort();

  await fs.writeFile(
    path.join(exportDir, 'folders.json'),
    JSON.stringify(foldersArray, null, 2)
  );
  console.log(`[Export] Exported ${foldersArray.length} folders`);

  console.log('[Export] Export complete!');

  return {
    success: true,
    documentsCount: documents.length,
    tagsCount: tagsArray.length,
    foldersCount: foldersArray.length,
    exportPath: exportDir,
  };
}
