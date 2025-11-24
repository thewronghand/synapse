import fs from 'fs/promises';
import path from 'path';
import { parseFrontmatter, extractTitle, getSlugFromFilePath } from './document-parser';

const NOTES_DIR = path.join(process.cwd(), 'notes');

interface DocumentInfo {
  slug: string;
  title: string;
}

/**
 * In-memory document cache for fast title lookups
 */
class DocumentCache {
  private documents: Map<string, DocumentInfo> = new Map();
  private isInitialized: boolean = false;

  /**
   * Initialize the cache by scanning all documents
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('[DocumentCache] Initializing document cache...');
    const startTime = Date.now();

    try {
      const files = await fs.readdir(NOTES_DIR);
      const markdownFiles = files.filter((file) => file.endsWith('.md'));

      await Promise.all(
        markdownFiles.map(async (file) => {
          const filePath = path.join(NOTES_DIR, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const slug = getSlugFromFilePath(file);
          const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);
          const title = extractTitle(contentWithoutFrontmatter, frontmatter);

          this.documents.set(slug, { slug, title });
        })
      );

      this.isInitialized = true;
      const duration = Date.now() - startTime;
      console.log(
        `[DocumentCache] Initialized with ${this.documents.size} documents in ${duration}ms`
      );
    } catch (error) {
      console.error('[DocumentCache] Failed to initialize:', error);
      // Don't throw - allow the app to continue with empty cache
    }
  }

  /**
   * Add a document to the cache
   */
  addDocument(slug: string, title: string): void {
    this.documents.set(slug, { slug, title });
  }

  /**
   * Remove a document from the cache
   */
  removeDocument(slug: string): void {
    this.documents.delete(slug);
  }

  /**
   * Update a document in the cache
   */
  updateDocument(slug: string, title: string): void {
    this.documents.set(slug, { slug, title });
  }

  /**
   * Get all document titles as sorted array
   */
  getTitles(): string[] {
    return Array.from(this.documents.values())
      .map((doc) => doc.title)
      .sort();
  }

  /**
   * Get all documents as array
   */
  getDocuments(): DocumentInfo[] {
    return Array.from(this.documents.values()).sort((a, b) =>
      a.title.localeCompare(b.title)
    );
  }

  /**
   * Refresh the cache by rescanning all documents
   */
  async refresh(): Promise<void> {
    this.documents.clear();
    this.isInitialized = false;
    await this.initialize();
  }

  /**
   * Get the number of cached documents
   */
  size(): number {
    return this.documents.size;
  }

  /**
   * Check if cache is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}

// Singleton instance
export const documentCache = new DocumentCache();

// Initialize on module load (for server startup)
if (typeof window === 'undefined') {
  // Only run on server side
  documentCache.initialize().catch((err) => {
    console.error('[DocumentCache] Failed to auto-initialize:', err);
  });
}
