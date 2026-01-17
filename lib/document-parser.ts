import matter from 'gray-matter';
import { Frontmatter } from '@/types';

/**
 * Parse frontmatter from markdown content
 */
export function parseFrontmatter(content: string): {
  frontmatter: Frontmatter;
  contentWithoutFrontmatter: string;
} {
  const { data, content: contentWithoutFrontmatter } = matter(content);

  return {
    frontmatter: data as Frontmatter,
    contentWithoutFrontmatter,
  };
}

/**
 * Extract title from frontmatter or first # heading
 */
export function extractTitle(content: string, frontmatter: Frontmatter): string {
  // 1. frontmatter에 title이 있으면 사용
  if (frontmatter.title) {
    return frontmatter.title;
  }

  // 2. 첫 번째 # 헤딩 찾기
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch) {
    return headingMatch[1].trim();
  }

  // 3. 기본값
  return 'Untitled';
}

/**
 * Extract wiki links from markdown content
 * Supports: [[link]], [[link|display text]], [[link#heading]]
 * Returns original link text with NFC normalization only (no slug conversion)
 */
export function extractWikiLinks(content: string): string[] {
  const wikiLinkRegex = /\[\[([^\]|#]+)(?:[|#][^\]]+)?\]\]/g;
  const matches = [...content.matchAll(wikiLinkRegex)];

  // Extract unique link names with NFC normalization only
  const links = matches.map(match => match[1].trim().normalize('NFC'));

  return Array.from(new Set(links)); // Remove duplicates
}

/**
 * Get title from filename (remove .md extension, NFC normalize)
 * Example: "회의록 (2024-01-15).md" -> "회의록 (2024-01-15)"
 */
export function getTitleFromFilename(filename: string): string {
  return filename.replace(/\.md$/, '').normalize('NFC');
}

/**
 * Sanitize title for use as filename
 * Only removes characters that are forbidden in filesystems: / \ : * ? " < > |
 * Preserves spaces, parentheses, and other special characters
 */
export function sanitizeFilename(title: string): string {
  return title
    .normalize('NFC')
    .trim()
    .replace(/[/\\:*?"<>|]/g, '-')  // Replace forbidden chars with hyphen
    .replace(/-+/g, '-')             // Multiple hyphens to single
    .replace(/^\s+|\s+$/g, '');      // Trim whitespace
}

/**
 * Compare two titles (case-insensitive, NFC normalized)
 * Used for checking duplicate titles and matching wiki links to files
 */
export function titlesMatch(title1: string, title2: string): boolean {
  return title1.normalize('NFC').toLowerCase() === title2.normalize('NFC').toLowerCase();
}

/**
 * Check if a wiki link is valid (target file exists)
 * Now compares against existing titles instead of slugs
 */
export function isValidWikiLink(linkText: string, existingTitles: string[]): boolean {
  const normalizedLink = linkText.normalize('NFC');
  return existingTitles.some(title => titlesMatch(title, normalizedLink));
}

/**
 * Calculate backlinks for all documents
 * Returns a map of title -> array of titles that link to it
 */
export function calculateBacklinks(
  documents: Array<{ title: string; links: string[] }>
): Map<string, string[]> {
  const backlinksMap = new Map<string, string[]>();

  // Initialize empty arrays for all documents
  documents.forEach(doc => {
    backlinksMap.set(doc.title.normalize('NFC').toLowerCase(), []);
  });

  // Build backlinks
  documents.forEach(doc => {
    doc.links.forEach(linkedTitle => {
      const normalizedLinkedTitle = linkedTitle.normalize('NFC').toLowerCase();
      const backlinks = backlinksMap.get(normalizedLinkedTitle) || [];
      backlinks.push(doc.title);
      backlinksMap.set(normalizedLinkedTitle, backlinks);
    });
  });

  return backlinksMap;
}

/**
 * Escape special regex characters in a string
 * Used for building regex patterns from user input (like titles)
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Update wiki links in content when a document title changes
 * Handles: [[oldTitle]], [[oldTitle|display]], [[oldTitle#heading]]
 */
export function updateWikiLinksInContent(
  content: string,
  oldTitle: string,
  newTitle: string
): string {
  // Pattern matches [[oldTitle]], [[oldTitle|...]], [[oldTitle#...]]
  const pattern = new RegExp(
    `\\[\\[${escapeRegex(oldTitle)}((?:\\|[^\\]]*)?(?:#[^\\]]*)?)\\]\\]`,
    'gi'
  );

  return content.replace(pattern, (match, suffix) => {
    return `[[${newTitle}${suffix || ''}]]`;
  });
}

// ============================================
// DEPRECATED FUNCTIONS (kept for compatibility during migration)
// These will be removed after full migration
// ============================================

/**
 * @deprecated Use getTitleFromFilename instead
 * Normalize a string to a valid slug
 */
export function normalizeSlug(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * @deprecated No longer needed - use title directly
 */
export function getFilePathFromSlug(slug: string): string {
  return `notes/${slug}.md`;
}

/**
 * @deprecated Use getTitleFromFilename instead
 */
export function getSlugFromFilePath(filePath: string): string {
  const filename = filePath
    .replace(/^notes\//, '')
    .replace(/\.md$/, '');
  return normalizeSlug(filename);
}

/**
 * @deprecated No longer needed
 */
export function buildSlugToFilenameMap(filenames: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const filename of filenames) {
    const originalSlug = filename.replace(/\.md$/, '');
    const normalizedSlug = normalizeSlug(originalSlug);
    map.set(normalizedSlug, filename);
  }
  return map;
}

/**
 * @deprecated No longer needed
 */
export function findFilenameBySlug(
  normalizedSlug: string,
  slugToFilenameMap: Map<string, string>
): string | undefined {
  return slugToFilenameMap.get(normalizedSlug);
}

/**
 * @deprecated No longer needed - titles must be unique
 */
export function createUniqueSlug(title: string): string {
  // Now just returns sanitized filename (no UUID)
  return sanitizeFilename(title);
}
