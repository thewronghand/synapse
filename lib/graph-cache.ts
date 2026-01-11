import fs from 'fs/promises';
import path from 'path';
import {
  parseFrontmatter,
  extractTitle,
  extractWikiLinks,
  calculateBacklinks,
  getSlugFromFilePath,
} from './document-parser';
import { getNotesDir } from './notes-path';
import { isPublishedMode } from './env';
import { Graph, GraphEdge, DigitalGardenNode } from '@/types';

const NOTES_DIR = getNotesDir();

interface DocumentData {
  slug: string;
  title: string;
  links: string[];
  tags: string[];
}

/**
 * In-memory graph cache for fast graph data access
 * Avoids full filesystem scan on every /api/graph request
 */
class GraphCache {
  private graph: Graph | null = null;
  private documents: Map<string, DocumentData> = new Map();
  private isDirty: boolean = true;
  private isInitialized: boolean = false;
  private initPromise: Promise<void> | null = null;

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
          const slug = getSlugFromFilePath(file);
          const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);
          const title = extractTitle(contentWithoutFrontmatter, frontmatter);
          const links = extractWikiLinks(content);

          this.documents.set(slug, {
            slug,
            title,
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
   */
  private buildGraphFromDocuments(): Graph {
    const documents = Array.from(this.documents.values());
    const backlinksMap = calculateBacklinks(documents);

    const nodesObject: { [url: string]: DigitalGardenNode } = {};
    const links: GraphEdge[] = [];
    let nodeId = 0;

    documents.forEach((doc) => {
      const backlinks = backlinksMap.get(doc.slug) || [];
      const allLinks = [...new Set([...doc.links, ...backlinks])];

      nodesObject[`/${doc.slug}`] = {
        id: nodeId++,
        title: doc.title,
        url: `/${doc.slug}`,
        neighbors: allLinks.map(slug => `/${slug}`),
        backLinks: backlinks.map(slug => `/${slug}`),
        size: Math.min(7, Math.max(2, allLinks.length / 2)),
        color: this.getNodeColor(doc.tags, backlinks.length),
        hide: false,
        tags: doc.tags,
      };
    });

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
   * Invalidate cache for a specific document or entire cache
   */
  invalidate(slug?: string): void {
    if (slug) {
      console.log(`[GraphCache] Invalidating document: ${slug}`);
    } else {
      console.log('[GraphCache] Invalidating entire cache');
    }
    this.isDirty = true;
    this.graph = null;
  }

  /**
   * Update a single document in the cache (for incremental updates)
   */
  async updateDocument(slug: string, content: string): Promise<void> {
    const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);
    const title = extractTitle(contentWithoutFrontmatter, frontmatter);
    const links = extractWikiLinks(content);

    this.documents.set(slug, {
      slug,
      title,
      links,
      tags: frontmatter.tags || [],
    });

    this.isDirty = true;
    console.log(`[GraphCache] Updated document: ${slug}`);
  }

  /**
   * Remove a document from the cache
   */
  removeDocument(slug: string): void {
    this.documents.delete(slug);
    this.isDirty = true;
    console.log(`[GraphCache] Removed document: ${slug}`);
  }

  /**
   * Add a new document to the cache
   */
  async addDocument(slug: string, content: string): Promise<void> {
    await this.updateDocument(slug, content);
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
