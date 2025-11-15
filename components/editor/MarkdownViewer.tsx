"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkWikiLink from "remark-wiki-link";
import rehypeRaw from "rehype-raw";

interface MarkdownViewerProps {
  content: string;
  onWikiLinkClick?: (pageName: string) => void;
}

export default function MarkdownViewer({
  content,
  onWikiLinkClick
}: MarkdownViewerProps) {
  return (
    <div className="prose prose-lg dark:prose-invert max-w-none p-4">
      <ReactMarkdown
        remarkPlugins={[
          remarkGfm,
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
        {content}
      </ReactMarkdown>
    </div>
  );
}
