import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import {
  parseFrontmatter,
  extractTitle,
  extractWikiLinks,
  calculateBacklinks,
  getSlugFromFilePath,
} from '@/lib/document-parser';
import { Graph, GraphNode, GraphEdge, DigitalGardenNode } from '@/types';
import { getNotesDir } from '@/lib/notes-path';

const NOTES_DIR = getNotesDir();

/**
 * GET /api/graph
 * Get graph data (nodes and edges)
 */
export async function GET() {
  try {
    const graph = await buildGraph();

    return NextResponse.json({
      success: true,
      data: graph,
    });
  } catch (error) {
    console.error('Error building graph:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to build graph',
      },
      { status: 500 }
    );
  }
}

/**
 * Build graph data from all documents
 * Digital Garden format: nodes as object with neighbors array
 */
async function buildGraph(): Promise<Graph> {
  const files = await fs.readdir(NOTES_DIR);
  const markdownFiles = files.filter((file) => file.endsWith('.md'));

  // Build documents data
  const documents = await Promise.all(
    markdownFiles.map(async (file) => {
      const filePath = path.join(NOTES_DIR, file);
      const content = await fs.readFile(filePath, 'utf-8');

      const slug = getSlugFromFilePath(file);
      const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);
      const title = extractTitle(contentWithoutFrontmatter, frontmatter);
      const links = extractWikiLinks(content);

      return {
        slug,
        title,
        links,
        tags: frontmatter.tags || [],
      };
    })
  );

  // Calculate backlinks
  const backlinksMap = calculateBacklinks(documents);

  // Build nodes as object (Digital Garden format)
  const nodesObject: { [url: string]: DigitalGardenNode } = {};
  const links: GraphEdge[] = [];
  let nodeId = 0;

  documents.forEach((doc) => {
    const backlinks = backlinksMap.get(doc.slug) || [];
    const allLinks = [...new Set([...doc.links, ...backlinks])]; // Bidirectional neighbors

    nodesObject[`/${doc.slug}`] = {
      id: nodeId++,
      title: doc.title,
      url: `/${doc.slug}`,
      neighbors: allLinks.map(slug => `/${slug}`),
      backLinks: backlinks.map(slug => `/${slug}`),
      size: Math.min(7, Math.max(2, allLinks.length / 2)), // Digital Garden sizing
      color: getNodeColor(doc.tags, backlinks.length),
      hide: false,
      tags: doc.tags,
    };
  });

  // Build edges using node IDs
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

  return {
    nodes: nodesObject,
    links: links
  };
}

/**
 * Get node color based on tags or backlink count
 */
function getNodeColor(tags: string[], backlinkCount: number): string {
  // Color by tag
  if (tags.includes('guide') || tags.includes('tutorial')) {
    return '#3b82f6'; // blue
  }
  if (tags.includes('getting-started')) {
    return '#10b981'; // green
  }
  if (tags.includes('features')) {
    return '#8b5cf6'; // purple
  }

  // Color by importance (backlink count)
  if (backlinkCount >= 3) {
    return '#ef4444'; // red - highly connected
  }
  if (backlinkCount >= 1) {
    return '#f59e0b'; // orange - connected
  }

  return '#6b7280'; // gray - default
}
