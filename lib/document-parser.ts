import matter from 'gray-matter';
import { Frontmatter } from '@/types';
import { randomBytes } from 'crypto';

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
 */
export function extractWikiLinks(content: string): string[] {
  const wikiLinkRegex = /\[\[([^\]|#]+)(?:[|#][^\]]+)?\]\]/g;
  const matches = [...content.matchAll(wikiLinkRegex)];

  // Extract unique link names and normalize
  const links = matches.map(match => normalizeSlug(match[1].trim()));

  return Array.from(new Set(links)); // Remove duplicates
}

/**
 * Normalize a string to a valid slug
 * Example: "Getting Started" -> "getting-started"
 * Example: "핀테크" -> "핀테크"
 * Example: "BNPL 서비스" -> "bnpl-서비스"
 */
export function normalizeSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // spaces to hyphens
    .replace(/[^\p{L}\p{N}-]/gu, '') // keep unicode letters, numbers, hyphens
    .replace(/-+/g, '-') // multiple hyphens to single
    .replace(/^-|-$/g, ''); // remove leading/trailing hyphens
}

/**
 * Get file path from slug
 */
export function getFilePathFromSlug(slug: string): string {
  return `notes/${slug}.md`;
}

/**
 * Get slug from file path
 * Normalizes the filename to ensure consistency with wiki link slugs
 */
export function getSlugFromFilePath(filePath: string): string {
  const filename = filePath
    .replace(/^notes\//, '')
    .replace(/\.md$/, '');
  return normalizeSlug(filename);
}

/**
 * Check if a wiki link is valid (target file exists)
 */
export function isValidWikiLink(linkText: string, existingSlugs: string[]): boolean {
  const normalizedLink = normalizeSlug(linkText);
  return existingSlugs.includes(normalizedLink);
}

/**
 * Calculate backlinks for all documents
 * Returns a map of slug -> array of slugs that link to it
 */
export function calculateBacklinks(
  documents: Array<{ slug: string; links: string[] }>
): Map<string, string[]> {
  const backlinksMap = new Map<string, string[]>();

  // Initialize empty arrays for all documents
  documents.forEach(doc => {
    backlinksMap.set(doc.slug, []);
  });

  // Build backlinks
  documents.forEach(doc => {
    doc.links.forEach(linkedSlug => {
      const backlinks = backlinksMap.get(linkedSlug) || [];
      backlinks.push(doc.slug);
      backlinksMap.set(linkedSlug, backlinks);
    });
  });

  return backlinksMap;
}

/**
 * Build a mapping from normalized slugs to original filenames
 * This allows looking up files by their normalized slug
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
 * Find the original filename for a normalized slug
 */
export function findFilenameBySlug(
  normalizedSlug: string,
  slugToFilenameMap: Map<string, string>
): string | undefined {
  return slugToFilenameMap.get(normalizedSlug);
}

/**
 * Generate a short unique ID (6 characters)
 */
export function generateShortId(): string {
  return randomBytes(3).toString('hex'); // 6 hex characters
}

/**
 * Create a unique slug with ID suffix
 * Example: "TN 죽이기 - 설계" -> "tn-죽이기-설계-a1b2c3"
 */
export function createUniqueSlug(title: string): string {
  const baseSlug = normalizeSlug(title);
  const shortId = generateShortId();
  return `${baseSlug}-${shortId}`;
}
