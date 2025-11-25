"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkWikiLink from "remark-wiki-link";
import rehypeRaw from "rehype-raw";

interface MarkdownViewerProps {
  content: string;
  onWikiLinkClick?: (pageName: string) => void;
}

// Simple frontmatter parser for preview
function parseFrontmatter(content: string): {
  frontmatter: { title?: string; tags?: string[] };
  contentWithoutFrontmatter: string;
} {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, contentWithoutFrontmatter: content };
  }

  const frontmatterText = match[1];
  const contentWithoutFrontmatter = content.slice(match[0].length);

  // Parse YAML-like frontmatter (simple version)
  const frontmatter: { title?: string; tags?: string[] } = {};

  const titleMatch = frontmatterText.match(/title:\s*(.+)/);
  if (titleMatch) {
    frontmatter.title = titleMatch[1].trim();
  }

  const tagsMatch = frontmatterText.match(/tags:\s*\[(.+)\]/);
  if (tagsMatch) {
    frontmatter.tags = tagsMatch[1]
      .split(',')
      .map((tag) => tag.trim().replace(/['"]/g, ''));
  }

  return { frontmatter, contentWithoutFrontmatter };
}

export default function MarkdownViewer({
  content,
  onWikiLinkClick
}: MarkdownViewerProps) {
  const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);

  return (
    <div className="p-4">
      {/* Header Section with Title and Tags */}
      {(frontmatter.title || (frontmatter.tags && frontmatter.tags.length > 0)) && (
        <div className="border-b pb-4 mb-6">
          {frontmatter.title && (
            <h1 className="text-xl font-bold">{frontmatter.title}</h1>
          )}
          {frontmatter.tags && frontmatter.tags.length > 0 && (
            <div className="flex gap-1 mt-1">
              {frontmatter.tags.map((tag, index) => (
                <span
                  key={index}
                  className="text-xs px-2 py-0.5 bg-gray-100 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Markdown Content */}
      <div className="prose prose-lg dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[
          remarkGfm,
          remarkBreaks,
          [
            remarkWikiLink,
            {
              pageResolver: (name: string) => [name.replace(/ /g, "-").toLowerCase()],
              hrefTemplate: (permalink: string) => `/doc/${permalink}`,
              wikiLinkClassName: "wiki-link text-blue-600 hover:underline cursor-pointer",
            },
          ],
        ]}
        rehypePlugins={[rehypeRaw]}
        components={{
          a: ({ node, href, children, ...props }) => {
            // Wiki link 처리
            if (props.className?.includes("wiki-link")) {
              return (
                <a
                  {...props}
                  href={href}
                  onClick={(e) => {
                    e.preventDefault();
                    const pageName = children?.toString() || "";
                    onWikiLinkClick?.(pageName);
                  }}
                >
                  {children}
                </a>
              );
            }
            // 일반 링크
            return (
              <a href={href} {...props} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {contentWithoutFrontmatter}
      </ReactMarkdown>
      </div>
    </div>
  );
}
