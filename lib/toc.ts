/**
 * Table of Contents utility functions
 */

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

/**
 * Extract headings from markdown content (without frontmatter)
 */
export function extractHeadings(content: string): TocItem[] {
  const headings: TocItem[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    // Match markdown headings (## Heading)
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      // Create slug from heading text
      const id = text
        .toLowerCase()
        .normalize('NFC')
        .replace(/[^\w\s가-힣-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      headings.push({ id, text, level });
    }
  }

  return headings;
}

/**
 * Generate unique IDs for duplicate headings
 */
export function generateUniqueIds(headings: TocItem[]): TocItem[] {
  const idCounts = new Map<string, number>();

  return headings.map((heading) => {
    const count = idCounts.get(heading.id) || 0;
    idCounts.set(heading.id, count + 1);

    if (count === 0) {
      return heading;
    }

    return {
      ...heading,
      id: `${heading.id}-${count}`,
    };
  });
}
