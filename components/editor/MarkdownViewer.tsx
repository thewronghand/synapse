"use client";

import { useState, memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkWikiLink from "remark-wiki-link";
import remarkMath from "remark-math";
import remarkEmoji from "remark-emoji";
import rehypeRaw from "rehype-raw";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import * as Tooltip from "@radix-ui/react-tooltip";
import { ImageOff } from "lucide-react";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github.css";

// 이미지 로딩 실패 캐시 - 컴포넌트 외부에서 관리하여 리렌더링 시 재시도 방지
const failedImageCache = new Set<string>();

// 이미지 로딩 실패 시 대체 UI를 표시하는 컴포넌트
function ImageWithFallback({ src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) {
  // 캐시에서 이미 실패한 이미지인지 확인
  const srcString = typeof src === 'string' ? src : '';
  const [hasError, setHasError] = useState(() => {
    return srcString ? failedImageCache.has(srcString) : false;
  });

  if (hasError) {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-2 bg-muted border border-border rounded-lg">
        <span className="flex items-center justify-center w-10 h-10 bg-muted-foreground/10 rounded">
          <ImageOff className="w-5 h-5 text-muted-foreground" />
        </span>
        <code className="text-sm bg-muted-foreground/10 px-2 py-0.5 rounded font-mono">
          {alt || "이미지를 불러올 수 없습니다"}
        </code>
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      {...props}
      onError={() => {
        if (srcString) failedImageCache.add(srcString);
        setHasError(true);
      }}
    />
  );
}

interface MarkdownViewerProps {
  content: string;
  onWikiLinkClick?: (pageName: string) => void;
  existingTitles?: string[];
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

function MarkdownViewer({
  content,
  onWikiLinkClick,
  existingTitles
}: MarkdownViewerProps) {
  const { frontmatter, contentWithoutFrontmatter } = parseFrontmatter(content);

  // 링크에 커스텀 툴팁을 적용하는 헬퍼 함수
  const renderLinkWithTooltip = (
    linkElement: React.ReactElement,
    title: string | undefined
  ) => {
    if (!title) {
      return linkElement;
    }
    return (
      <Tooltip.Provider delayDuration={300}>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            {linkElement}
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              className="z-50 px-3 py-1.5 text-sm bg-card text-card-foreground border border-border rounded-md shadow-md"
              sideOffset={5}
            >
              {title}
              <Tooltip.Arrow className="fill-card" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    );
  };

  return (
    <div className="p-4">
      {/* Header Section with Title and Tags */}
      {(frontmatter.title || (frontmatter.tags && frontmatter.tags.length > 0)) && (
        <div className="border-b pb-4 mb-6">
          {frontmatter.title && (
            <h1 className="text-xl font-bold">{frontmatter.title}</h1>
          )}
          {frontmatter.tags && frontmatter.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {frontmatter.tags.map((tag, index) => (
                <span
                  key={index}
                  className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded"
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
          remarkMath,
          remarkEmoji,
          [
            remarkWikiLink,
            {
              // 제목을 그대로 사용 (slug 변환 없음)
              pageResolver: (name: string) => [name],
              hrefTemplate: (permalink: string) => `/note/${encodeURIComponent(permalink)}`,
              wikiLinkClassName: "wiki-link text-primary hover:text-primary/80 cursor-pointer no-underline",
            },
          ],
        ]}
        rehypePlugins={[rehypeRaw, rehypeKatex, rehypeHighlight]}
        components={{
          img: ({ src, alt, ...props }) => (
            <ImageWithFallback src={src} alt={alt} {...props} />
          ),
          a: ({ node, href, children, title, ...props }) => {
            // Wiki link 처리
            if (props.className?.includes("wiki-link")) {
              const pageName = children?.toString() || "";
              // existingTitles가 제공되지 않았으면 (undefined) 존재한다고 가정
              // 제공되었으면 (빈 배열 포함) 실제로 제목이 있는지 확인 (대소문자 무시)
              const normalizedPageName = pageName.normalize('NFC').toLowerCase();
              const exists = existingTitles === undefined ||
                existingTitles.some(t => t.normalize('NFC').toLowerCase() === normalizedPageName);

              // 존재하지 않는 링크는 비활성화 (클릭 불가)
              if (!exists) {
                return (
                  <span
                    className="wiki-link wiki-link-missing no-underline cursor-not-allowed opacity-60"
                    title="이 폴더에 해당 문서가 없습니다"
                  >
                    {children}
                  </span>
                );
              }

              return (
                <a
                  {...props}
                  href={href}
                  className="wiki-link cursor-pointer no-underline"
                  onClick={(e) => {
                    e.preventDefault();
                    onWikiLinkClick?.(pageName);
                  }}
                >
                  {children}
                </a>
              );
            }
            // 페이지 내 앵커 링크 (각주 등) - 히스토리 없이 스크롤
            if (href?.startsWith("#")) {
              return (
                <a
                  href={href}
                  {...props}
                  onClick={(e) => {
                    e.preventDefault();
                    const targetId = href.slice(1);
                    const targetElement = document.getElementById(targetId);
                    targetElement?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  {children}
                </a>
              );
            }
            // 외부 링크 - 새 탭에서 열기 (title이 있으면 커스텀 툴팁 적용)
            const linkElement = (
              <a href={href} {...props} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
            return renderLinkWithTooltip(linkElement, title);
          },
        }}
      >
        {contentWithoutFrontmatter}
      </ReactMarkdown>
      </div>
    </div>
  );
}

// memo로 감싸서 props가 같을 때 리렌더링 방지
export default memo(MarkdownViewer);
