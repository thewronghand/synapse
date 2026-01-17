import fs from 'fs/promises';
import path from 'path';
import { parseFrontmatter, extractTitle, getTitleFromFilename, titlesMatch } from './document-parser';
import { getNotesDir } from './notes-path';
import { isPublishedMode } from './env';

const NOTES_DIR = getNotesDir();

interface DocumentInfo {
  title: string;      // The document title (from frontmatter or filename)
  filename: string;   // The actual filename (e.g., "회의록 (2024).md")
}

/**
 * In-memory document cache for fast title lookups
 * Now uses title as the primary key instead of slug
 */
class DocumentCache {
  // Map key: normalized title (lowercase, NFC), value: DocumentInfo
  private documents: Map<string, DocumentInfo> = new Map();
  private isInitialized: boolean = false;

  /**
   * Normalize title for use as map key (lowercase, NFC)
   */
  private normalizeKey(title: string): string {
    return title.normalize('NFC').toLowerCase();
  }

  /**
   * Initialize the cache by scanning all documents
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Skip initialization in published mode
    if (isPublishedMode()) {
      console.log('[DocumentCache] Skipping initialization in published mode');
      this.isInitialized = true;
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
          const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);
          const title = extractTitle(contentWithoutFrontmatter, frontmatter);
          const normalizedFilename = getTitleFromFilename(file);

          // Use extracted title as key, fallback to filename if no title
          const effectiveTitle = title || normalizedFilename;
          const key = this.normalizeKey(effectiveTitle);

          this.documents.set(key, {
            title: effectiveTitle,
            filename: file,
          });
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
  addDocument(title: string, filename: string): void {
    const key = this.normalizeKey(title);
    this.documents.set(key, { title, filename });
  }

  /**
   * Remove a document from the cache by title
   */
  removeDocument(title: string): void {
    const key = this.normalizeKey(title);
    this.documents.delete(key);
  }

  /**
   * Update a document in the cache (handles title changes)
   */
  updateDocument(oldTitle: string, newTitle: string, newFilename: string): void {
    const oldKey = this.normalizeKey(oldTitle);
    const newKey = this.normalizeKey(newTitle);

    // Remove old entry if title changed
    if (oldKey !== newKey) {
      this.documents.delete(oldKey);
    }

    this.documents.set(newKey, { title: newTitle, filename: newFilename });
  }

  /**
   * Check if a title exists (case-insensitive)
   */
  hasTitle(title: string): boolean {
    const key = this.normalizeKey(title);
    return this.documents.has(key);
  }

  /**
   * Get document info by title
   */
  getByTitle(title: string): DocumentInfo | undefined {
    const key = this.normalizeKey(title);
    return this.documents.get(key);
  }

  /**
   * Find document by filename
   */
  getByFilename(filename: string): DocumentInfo | undefined {
    const normalizedFilename = filename.normalize('NFC');
    for (const doc of this.documents.values()) {
      if (doc.filename.normalize('NFC') === normalizedFilename) {
        return doc;
      }
    }
    return undefined;
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
   * Get all documents as array with title and filename
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
