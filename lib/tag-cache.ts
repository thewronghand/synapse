import fs from 'fs/promises';
import path from 'path';
import { parseFrontmatter } from './document-parser';
import { getNotesDir } from './notes-path';
import { isPublishedMode } from './env';

const NOTES_DIR = getNotesDir();

/**
 * In-memory tag cache for fast tag lookups
 */
class TagCache {
  private tags: Set<string> = new Set();
  private isInitialized: boolean = false;

  /**
   * Initialize the cache by scanning all documents
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Skip initialization in published mode
    if (isPublishedMode()) {
      console.log('[TagCache] Skipping initialization in published mode');
      this.isInitialized = true;
      return;
    }

    console.log('[TagCache] Initializing tag cache...');
    const startTime = Date.now();

    try {
      const files = await fs.readdir(NOTES_DIR);
      const markdownFiles = files.filter((file) => file.endsWith('.md'));

      await Promise.all(
        markdownFiles.map(async (file) => {
          const filePath = path.join(NOTES_DIR, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const { frontmatter } = parseFrontmatter(content);

          if (frontmatter.tags && Array.isArray(frontmatter.tags)) {
            frontmatter.tags.forEach((tag: string) => {
              if (tag && typeof tag === 'string') {
                this.tags.add(tag.trim());
              }
            });
          }
        })
      );

      this.isInitialized = true;
      const duration = Date.now() - startTime;
      console.log(
        `[TagCache] Initialized with ${this.tags.size} tags in ${duration}ms`
      );
    } catch (error) {
      console.error('[TagCache] Failed to initialize:', error);
      // Don't throw - allow the app to continue with empty cache
    }
  }

  /**
   * Add tags to the cache
   */
  addTags(tags: string[]): void {
    tags.forEach((tag) => {
      if (tag && typeof tag === 'string') {
        this.tags.add(tag.trim());
      }
    });
  }

  /**
   * Remove tags that are no longer used
   * This requires scanning all documents to verify
   */
  async refreshTags(): Promise<void> {
    this.tags.clear();
    this.isInitialized = false;
    await this.initialize();
  }

  /**
   * Get all tags as sorted array
   */
  getTags(): string[] {
    return Array.from(this.tags).sort();
  }

  /**
   * Get the number of cached tags
   */
  size(): number {
    return this.tags.size;
  }

  /**
   * Check if cache is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}

// Singleton instance
export const tagCache = new TagCache();

// Initialize on module load (for server startup)
if (typeof window === 'undefined') {
  // Only run on server side
  tagCache.initialize().catch((err) => {
    console.error('[TagCache] Failed to auto-initialize:', err);
  });
}
