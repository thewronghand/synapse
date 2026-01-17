import fs from 'fs/promises';
import fss from 'fs';
import path from 'path';
import { parseFrontmatter, extractTitle, getTitleFromFilename } from './document-parser';
import { getNotesDir } from './notes-path';
import { isPublishedMode } from './env';
import { ensureDefaultFolder, DEFAULT_FOLDER_NAME } from './folder-utils';

const NOTES_DIR = getNotesDir();

interface DocumentInfo {
  title: string;      // The document title (from frontmatter or filename)
  filename: string;   // The actual filename (e.g., "회의록 (2024).md")
  folder: string;     // The folder name (e.g., "default", "work")
}

/**
 * In-memory document cache for fast title lookups
 * Now uses title as the primary key and supports folders
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
   * Initialize the cache by scanning all documents in all folders
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

    console.log('[DocumentCache] Initializing document cache with folder support...');
    const startTime = Date.now();

    try {
      // Ensure default folder exists
      await ensureDefaultFolder();

      const entries = await fs.readdir(NOTES_DIR, { withFileTypes: true });
      const folders = entries.filter((e) => e.isDirectory());

      // Also check for root-level md files (legacy, should be migrated)
      const rootFiles = entries.filter((e) => e.isFile() && e.name.endsWith('.md'));

      // Process folders
      await Promise.all(
        folders.map(async (folder) => {
          const folderPath = path.join(NOTES_DIR, folder.name);
          const files = await fs.readdir(folderPath);
          const markdownFiles = files.filter((f) => f.endsWith('.md'));

          await Promise.all(
            markdownFiles.map(async (file) => {
              const filePath = path.join(folderPath, file);
              const content = await fs.readFile(filePath, 'utf-8');
              const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);
              const title = extractTitle(contentWithoutFrontmatter, frontmatter);
              const normalizedFilename = getTitleFromFilename(file);

              const effectiveTitle = title || normalizedFilename;
              const key = this.normalizeKey(effectiveTitle);

              this.documents.set(key, {
                title: effectiveTitle,
                filename: file,
                folder: folder.name,
              });
            })
          );
        })
      );

      // Process root-level files (legacy support)
      if (rootFiles.length > 0) {
        console.log(`[DocumentCache] Found ${rootFiles.length} root-level files (consider migrating)`);
        await Promise.all(
          rootFiles.map(async (file) => {
            const filePath = path.join(NOTES_DIR, file.name);
            const content = await fs.readFile(filePath, 'utf-8');
            const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);
            const title = extractTitle(contentWithoutFrontmatter, frontmatter);
            const normalizedFilename = getTitleFromFilename(file.name);

            const effectiveTitle = title || normalizedFilename;
            const key = this.normalizeKey(effectiveTitle);

            // Mark root files with special folder marker
            this.documents.set(key, {
              title: effectiveTitle,
              filename: file.name,
              folder: '', // Empty string indicates root level
            });
          })
        );
      }

      this.isInitialized = true;
      const duration = Date.now() - startTime;
      console.log(
        `[DocumentCache] Initialized with ${this.documents.size} documents in ${duration}ms`
      );
    } catch (error) {
      console.error('[DocumentCache] Failed to initialize:', error);
    }
  }

  /**
   * Add a document to the cache
   */
  addDocument(title: string, filename: string, folder: string): void {
    const key = this.normalizeKey(title);
    this.documents.set(key, { title, filename, folder });
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
  updateDocument(oldTitle: string, newTitle: string, newFilename: string, folder: string): void {
    const oldKey = this.normalizeKey(oldTitle);
    const newKey = this.normalizeKey(newTitle);

    // Remove old entry if title changed
    if (oldKey !== newKey) {
      this.documents.delete(oldKey);
    }

    this.documents.set(newKey, { title: newTitle, filename: newFilename, folder });
  }

  /**
   * Check if a title exists (case-insensitive) - globally across all folders
   */
  hasTitle(title: string): boolean {
    const key = this.normalizeKey(title);
    return this.documents.has(key);
  }

  /**
   * Check if a title exists in a specific folder (case-insensitive)
   * This allows same titles in different folders (folder isolation)
   */
  hasTitleInFolder(title: string, folder: string): boolean {
    const normalizedTitle = this.normalizeKey(title);
    for (const doc of this.documents.values()) {
      if (this.normalizeKey(doc.title) === normalizedTitle && doc.folder === folder) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get document info by title
   */
  getByTitle(title: string): DocumentInfo | undefined {
    const key = this.normalizeKey(title);
    return this.documents.get(key);
  }

  /**
   * Find document by filename (searches all folders)
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
   * Find document by filename in specific folder
   */
  getByFilenameInFolder(filename: string, folder: string): DocumentInfo | undefined {
    const normalizedFilename = filename.normalize('NFC');
    for (const doc of this.documents.values()) {
      if (
        doc.filename.normalize('NFC') === normalizedFilename &&
        doc.folder === folder
      ) {
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
   * Get all documents as array with title, filename, and folder
   */
  getDocuments(): DocumentInfo[] {
    return Array.from(this.documents.values()).sort((a, b) =>
      a.title.localeCompare(b.title)
    );
  }

  /**
   * Get documents filtered by folder
   */
  getDocumentsByFolder(folder: string): DocumentInfo[] {
    return Array.from(this.documents.values())
      .filter((doc) => doc.folder === folder)
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  /**
   * Get unique folder names from cached documents
   */
  getFolders(): string[] {
    const folders = new Set<string>();
    for (const doc of this.documents.values()) {
      if (doc.folder) {
        folders.add(doc.folder);
      }
    }
    // Sort with default first
    return Array.from(folders).sort((a, b) => {
      if (a === DEFAULT_FOLDER_NAME) return -1;
      if (b === DEFAULT_FOLDER_NAME) return 1;
      return a.localeCompare(b, 'ko');
    });
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
