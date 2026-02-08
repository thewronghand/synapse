import fs from 'fs/promises';
import path from 'path';
import {
  parseFrontmatter,
  extractTitle,
  extractWikiLinks,
  calculateBacklinks,
  getTitleFromFilename,
  titlesMatch,
} from './document-parser';
import { getNotesDir } from './notes-path';
import { isPublishedMode } from './env';
import { Graph, GraphEdge, DigitalGardenNode } from '@/types';
import { TRASH_FOLDER } from './folder-utils';

const NOTES_DIR = getNotesDir();

interface DocumentData {
  title: string;      // Document title (from frontmatter or filename)
  filename: string;   // Actual filename (e.g., "회의록 (2024).md")
  folder: string;     // Folder name (empty string for root-level files)
  links: string[];    // Wiki link targets (as titles)
  tags: string[];
}

/**
 * In-memory graph cache for fast graph data access
 * Now uses title as the primary identifier instead of slug
 */
class GraphCache {
  private graph: Graph | null = null;
  // Map key: normalized title (lowercase, NFC)
  private documents: Map<string, DocumentData> = new Map();
  private isDirty: boolean = true;
  private isInitialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Normalize title for use as map key
   */
  private normalizeKey(title: string): string {
    if (typeof title !== 'string') {
      console.error('[GraphCache.normalizeKey] title is not a string:', typeof title, title);
      return String(title || '').normalize('NFC').toLowerCase();
    }
    return title.normalize('NFC').toLowerCase();
  }

  /**
   * Initialize the cache by scanning all documents
   */
  async initialize(): Promise<void> {
    if (this.isInitialized && !this.isDirty) {
      return;
    }

    // Prevent multiple simultaneous initializations
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._doInitialize();
    await this.initPromise;
    this.initPromise = null;
  }

  private async _doInitialize(): Promise<void> {
    // Skip in published mode - read from JSON instead
    if (isPublishedMode()) {
      this.isInitialized = true;
      this.isDirty = false;
      return;
    }

    try {
      const entries = await fs.readdir(NOTES_DIR, { withFileTypes: true });
      // .trash 폴더는 제외 (휴지통)
      const folders = entries.filter((e) => e.isDirectory() && e.name !== TRASH_FOLDER);
      const rootFiles = entries.filter((e) => e.isFile() && e.name.endsWith('.md'));

      this.documents.clear();

      // Process folders
      for (const folder of folders) {
        const folderPath = path.join(NOTES_DIR, folder.name);
        const files = await fs.readdir(folderPath);
        const markdownFiles = files.filter((f) => f.endsWith('.md'));

        await Promise.all(
          markdownFiles.map(async (file) => {
            const filePath = path.join(folderPath, file);
            const content = await fs.readFile(filePath, 'utf-8');
            const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);
            const filenameTitle = getTitleFromFilename(file);
            const title = extractTitle(contentWithoutFrontmatter, frontmatter) || filenameTitle;
            const links = extractWikiLinks(content);

            const key = this.normalizeKey(title);
            this.documents.set(key, {
              title,
              filename: file,
              folder: folder.name,
              links,
              tags: frontmatter.tags || [],
            });
          })
        );
      }

      // Process root-level files (legacy support)
      if (rootFiles.length > 0) {
        await Promise.all(
          rootFiles.map(async (entry) => {
            const filePath = path.join(NOTES_DIR, entry.name);
            const content = await fs.readFile(filePath, 'utf-8');
            const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);
            const filenameTitle = getTitleFromFilename(entry.name);
            const title = extractTitle(contentWithoutFrontmatter, frontmatter) || filenameTitle;
            const links = extractWikiLinks(content);

            const key = this.normalizeKey(title);
            this.documents.set(key, {
              title,
              filename: entry.name,
              folder: '',
              links,
              tags: frontmatter.tags || [],
            });
          })
        );
      }

      // Build graph from documents
      this.graph = this.buildGraphFromDocuments();
      this.isInitialized = true;
      this.isDirty = false;

    } catch (error) {
      console.error('[GraphCache] Failed to initialize:', error);
    }
  }

  /**
   * Build graph data from cached documents
   * URLs now use encodeURIComponent(title) instead of slug
   * Backlinks and edges are now folder-scoped (folder isolation)
   */
  private buildGraphFromDocuments(): Graph {
    const documents = Array.from(this.documents.values());

    // Group documents by folder for folder-scoped backlink calculation
    const documentsByFolder = new Map<string, DocumentData[]>();
    documents.forEach(doc => {
      const folder = doc.folder || 'default';
      if (!documentsByFolder.has(folder)) {
        documentsByFolder.set(folder, []);
      }
      documentsByFolder.get(folder)!.push(doc);
    });

    // Calculate backlinks per folder (folder isolation)
    const folderBacklinksMaps = new Map<string, Map<string, string[]>>();
    for (const [folder, docs] of documentsByFolder) {
      const backlinksMap = calculateBacklinks(
        docs.map(doc => ({ title: doc.title, links: doc.links }))
      );
      folderBacklinksMaps.set(folder, backlinksMap);
    }

    // Create a map for quick title+folder lookup
    const titleFolderToDoc = new Map<string, DocumentData>();
    documents.forEach(doc => {
      const key = `${doc.folder || 'default'}:${this.normalizeKey(doc.title)}`;
      titleFolderToDoc.set(key, doc);
    });

    const nodesObject: { [url: string]: DigitalGardenNode } = {};
    const links: GraphEdge[] = [];
    let nodeId = 0;

    documents.forEach((doc) => {
      const folder = doc.folder || 'default';
      const normalizedTitle = this.normalizeKey(doc.title);
      const folderBacklinks = folderBacklinksMaps.get(folder);
      const backlinks = folderBacklinks?.get(normalizedTitle) || [];

      // Only include links/neighbors that exist in the same folder
      const sameFolderLinks = doc.links.filter(linkedTitle => {
        const linkedKey = `${folder}:${this.normalizeKey(linkedTitle)}`;
        return titleFolderToDoc.has(linkedKey);
      });

      // Combine forward links and backlinks for neighbors (all same-folder)
      const allLinkedTitles = [...new Set([...sameFolderLinks, ...backlinks])];

      // URL uses encoded title
      const url = `/${encodeURIComponent(doc.title)}`;

      nodesObject[url] = {
        id: nodeId++,
        title: doc.title,
        url: url,
        neighbors: allLinkedTitles.map(t => `/${encodeURIComponent(t)}`),
        backLinks: backlinks.map(t => `/${encodeURIComponent(t)}`),
        size: Math.min(7, Math.max(2, allLinkedTitles.length / 2)),
        color: this.getNodeColor(doc.tags, backlinks.length),
        hide: false,
        tags: doc.tags,
        folder: doc.folder,
      } as DigitalGardenNode & { folder: string };
    });

    // Create edges only for links within the same folder (folder isolation)
    documents.forEach((doc) => {
      const folder = doc.folder || 'default';
      const sourceUrl = `/${encodeURIComponent(doc.title)}`;
      const sourceNode = nodesObject[sourceUrl];

      doc.links.forEach((linkedTitle) => {
        // Only create edge if target is in the same folder
        const targetKey = `${folder}:${this.normalizeKey(linkedTitle)}`;
        const targetDoc = titleFolderToDoc.get(targetKey);

        if (targetDoc) {
          // Use targetDoc.title to ensure correct URL matching
          const targetUrl = `/${encodeURIComponent(targetDoc.title)}`;
          const targetNode = nodesObject[targetUrl];

          if (sourceNode && targetNode) {
            links.push({
              source: sourceNode.id,
              target: targetNode.id,
            });
          }
        }
      });
    });

    return { nodes: nodesObject, links };
  }

  private getNodeColor(tags: string[], backlinkCount: number): string {
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
   * Get cached graph data
   */
  async getGraph(): Promise<Graph> {
    // In published mode, read from JSON
    if (isPublishedMode()) {
      const jsonPath = path.join(process.cwd(), 'public', 'data', 'graph.json');
      const jsonData = await fs.readFile(jsonPath, 'utf-8');
      return JSON.parse(jsonData);
    }

    // Ensure cache is initialized
    await this.initialize();

    if (this.isDirty || !this.graph) {
      this.graph = this.buildGraphFromDocuments();
      this.isDirty = false;
    }

    return this.graph;
  }

  /**
   * Get all existing titles (for wiki link validation)
   */
  getExistingTitles(): string[] {
    return Array.from(this.documents.values()).map(doc => doc.title);
  }

  /**
   * Invalidate cache for a specific document or entire cache
   */
  invalidate(title?: string): void {
    this.isDirty = true;
    this.graph = null;
  }

  /**
   * Update a single document in the cache (for incremental updates)
   */
  async updateDocument(title: string, filename: string, content: string, folder: string = ''): Promise<void> {
    const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);
    const extractedTitle = extractTitle(contentWithoutFrontmatter, frontmatter) || title;
    const links = extractWikiLinks(content);

    const key = this.normalizeKey(extractedTitle);
    this.documents.set(key, {
      title: extractedTitle,
      filename,
      folder,
      links,
      tags: frontmatter.tags || [],
    });

    this.isDirty = true;
  }

  /**
   * Remove a document from the cache by title
   */
  removeDocument(title: string): void {
    const key = this.normalizeKey(title);
    this.documents.delete(key);
    this.isDirty = true;
  }

  /**
   * Handle document rename (title change)
   */
  renameDocument(oldTitle: string, newTitle: string, newFilename: string, content: string, folder: string = ''): void {
    const oldKey = this.normalizeKey(oldTitle);
    const newKey = this.normalizeKey(newTitle);

    // Remove old entry
    this.documents.delete(oldKey);

    // Parse and add new entry
    const { frontmatter } = parseFrontmatter(content);
    const links = extractWikiLinks(content);

    this.documents.set(newKey, {
      title: newTitle,
      filename: newFilename,
      folder,
      links,
      tags: frontmatter.tags || [],
    });

    this.isDirty = true;
  }

  /**
   * Add a new document to the cache
   */
  async addDocument(title: string, filename: string, content: string, folder: string = ''): Promise<void> {
    await this.updateDocument(title, filename, content, folder);
  }

  /**
   * Force refresh the cache
   */
  async refresh(): Promise<void> {
    this.documents.clear();
    this.graph = null;
    this.isDirty = true;
    this.isInitialized = false;
    await this.initialize();
  }

  /**
   * Check if cache is ready
   */
  isReady(): boolean {
    return this.isInitialized && !this.isDirty;
  }
}

// Singleton instance
export const graphCache = new GraphCache();

// Initialize on module load (server-side only)
if (typeof window === 'undefined') {
  graphCache.initialize().catch((err) => {
    console.error('[GraphCache] Failed to auto-initialize:', err);
  });
}
