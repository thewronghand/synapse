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

const NOTES_DIR = getNotesDir();

interface DocumentData {
  title: string;      // Document title (from frontmatter or filename)
  filename: string;   // Actual filename (e.g., "회의록 (2024).md")
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
      console.log('[GraphCache] Skipping initialization in published mode');
      this.isInitialized = true;
      this.isDirty = false;
      return;
    }

    console.log('[GraphCache] Initializing graph cache...');
    const startTime = Date.now();

    try {
      const files = await fs.readdir(NOTES_DIR);
      const markdownFiles = files.filter((file) => file.endsWith('.md'));

      this.documents.clear();

      await Promise.all(
        markdownFiles.map(async (file) => {
          const filePath = path.join(NOTES_DIR, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);
          const filenameTitle = getTitleFromFilename(file);
          const title = extractTitle(contentWithoutFrontmatter, frontmatter) || filenameTitle;
          const links = extractWikiLinks(content); // Now returns titles, not slugs

          const key = this.normalizeKey(title);
          this.documents.set(key, {
            title,
            filename: file,
            links,
            tags: frontmatter.tags || [],
          });
        })
      );

      // Build graph from documents
      this.graph = this.buildGraphFromDocuments();
      this.isInitialized = true;
      this.isDirty = false;

      const duration = Date.now() - startTime;
      console.log(
        `[GraphCache] Initialized with ${this.documents.size} documents in ${duration}ms`
      );
    } catch (error) {
      console.error('[GraphCache] Failed to initialize:', error);
    }
  }

  /**
   * Build graph data from cached documents
   * URLs now use encodeURIComponent(title) instead of slug
   */
  private buildGraphFromDocuments(): Graph {
    const documents = Array.from(this.documents.values());

    // Calculate backlinks using title-based system
    const backlinksMap = calculateBacklinks(
      documents.map(doc => ({ title: doc.title, links: doc.links }))
    );

    const nodesObject: { [url: string]: DigitalGardenNode } = {};
    const links: GraphEdge[] = [];
    let nodeId = 0;

    // Create a map for quick title lookup
    const titleToDoc = new Map<string, DocumentData>();
    documents.forEach(doc => {
      titleToDoc.set(this.normalizeKey(doc.title), doc);
    });

    documents.forEach((doc) => {
      const normalizedTitle = this.normalizeKey(doc.title);
      const backlinks = backlinksMap.get(normalizedTitle) || [];

      // Combine forward links and backlinks for neighbors
      const allLinkedTitles = [...new Set([...doc.links, ...backlinks])];

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
      };
    });

    // Create edges for links between existing documents
    documents.forEach((doc) => {
      const sourceUrl = `/${encodeURIComponent(doc.title)}`;
      const sourceNode = nodesObject[sourceUrl];

      doc.links.forEach((linkedTitle) => {
        const targetUrl = `/${encodeURIComponent(linkedTitle)}`;
        const targetNode = nodesObject[targetUrl];

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
    if (title) {
      console.log(`[GraphCache] Invalidating document: ${title}`);
    } else {
      console.log('[GraphCache] Invalidating entire cache');
    }
    this.isDirty = true;
    this.graph = null;
  }

  /**
   * Update a single document in the cache (for incremental updates)
   */
  async updateDocument(title: string, filename: string, content: string): Promise<void> {
    const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);
    const extractedTitle = extractTitle(contentWithoutFrontmatter, frontmatter) || title;
    const links = extractWikiLinks(content);

    const key = this.normalizeKey(extractedTitle);
    this.documents.set(key, {
      title: extractedTitle,
      filename,
      links,
      tags: frontmatter.tags || [],
    });

    this.isDirty = true;
    console.log(`[GraphCache] Updated document: ${extractedTitle}`);
  }

  /**
   * Remove a document from the cache by title
   */
  removeDocument(title: string): void {
    const key = this.normalizeKey(title);
    this.documents.delete(key);
    this.isDirty = true;
    console.log(`[GraphCache] Removed document: ${title}`);
  }

  /**
   * Handle document rename (title change)
   */
  renameDocument(oldTitle: string, newTitle: string, newFilename: string, content: string): void {
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
      links,
      tags: frontmatter.tags || [],
    });

    this.isDirty = true;
    console.log(`[GraphCache] Renamed document: ${oldTitle} -> ${newTitle}`);
  }

  /**
   * Add a new document to the cache
   */
  async addDocument(title: string, filename: string, content: string): Promise<void> {
    await this.updateDocument(title, filename, content);
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
