/**
 * remark 플러그인: :::transcript 블록을 커스텀 HTML wrapper로 변환
 *
 * 마크다운에서 fenced block 스타일로 녹취록을 삽입할 수 있게 한다.
 * 예:
 *   :::transcript 전체 녹취록
 *   안녕하세요. 오늘 회의 내용입니다.
 *   두 번째 줄도 자연스럽게 포함됩니다.
 *   :::
 *
 * 변환 결과: <div data-transcript="전체 녹취록">마크다운 내용</div>
 * 내부의 마크다운은 remark/rehype가 정상적으로 파싱한다.
 * MarkdownViewer의 커스텀 렌더러가 접이식 UI로 렌더링한다.
 */

import type { Root, Paragraph, Text, RootContent } from "mdast";

const TRANSCRIPT_START = /^:::transcript\s*(.*)?$/;
const TRANSCRIPT_END = /^:::$/;

export default function remarkTranscript() {
  return (tree: Root) => {
    const children = tree.children;
    let i = 0;

    while (i < children.length) {
      const node = children[i];

      // paragraph 노드에서 :::transcript 시작 찾기
      if (node.type === "paragraph" && node.children.length >= 1) {
        const firstChild = node.children[0];
        if (firstChild.type !== "text") {
          i++;
          continue;
        }

        const lines = (firstChild as Text).value.split("\n");
        const firstLine = lines[0];
        const startMatch = firstLine.match(TRANSCRIPT_START);

        if (!startMatch) {
          i++;
          continue;
        }

        const rest = (startMatch[1] || "").trim();
        const isOpen = rest.startsWith("open");
        const label = isOpen ? (rest.slice(4).trim() || "녹취록") : (rest || "녹취록");
        const openAttr = isOpen ? ' data-open="true"' : '';

        // 같은 paragraph 내에서 ::: 종료가 있는지 확인 (짧은 블록)
        const remainingLines = lines.slice(1);
        const endIndexInSameNode = remainingLines.findIndex((l) =>
          TRANSCRIPT_END.test(l.trim())
        );

        if (endIndexInSameNode !== -1) {
          // 같은 paragraph 내에서 시작과 끝이 모두 있는 경우 (단순 텍스트)
          const contentLines = remainingLines.slice(0, endIndexInSameNode);
          const content = contentLines.join("\n");

          children.splice(i, 1,
            { type: "html", value: `<div data-transcript="${label.replace(/"/g, "&quot;")}"${openAttr}>` } as unknown as RootContent,
            { type: "paragraph", children: [{ type: "text", value: content }] } as unknown as RootContent,
            { type: "html", value: `</div>` } as unknown as RootContent,
          );
          i += 3;
          continue;
        }

        // 여러 노드에 걸친 블록: 끝 마커(:::) 찾기
        let endIndex = -1;
        let trailingText = "";
        for (let j = i + 1; j < children.length; j++) {
          const candidate = children[j];
          if (candidate.type === "paragraph" && candidate.children.length >= 1) {
            const candidateChild = candidate.children[0];
            if (candidateChild.type === "text") {
              const candidateLines = (candidateChild as Text).value.split("\n");
              if (TRANSCRIPT_END.test(candidateLines[0].trim())) {
                endIndex = j;
                // ::: 뒤에 추가 텍스트가 있으면 보존
                if (candidateLines.length > 1) {
                  trailingText = candidateLines.slice(1).join("\n");
                }
                break;
              }
            }
          }
        }

        if (endIndex === -1) {
          i++;
          continue;
        }

        // 시작 노드에서 나머지 줄이 있으면 paragraph로 변환
        const middleNodes: RootContent[] = [];
        if (remainingLines.length > 0) {
          middleNodes.push({
            type: "paragraph",
            children: [{ type: "text", value: remainingLines.join("\n") }],
          } as unknown as RootContent);
        }

        // 중간 노드들을 그대로 유지 (heading, list, paragraph 등 마크다운 파싱 유지)
        for (let j = i + 1; j < endIndex; j++) {
          middleNodes.push(children[j]);
        }

        // 시작~끝 노드를 wrapper HTML + 중간 노드 + 닫기 HTML로 교체
        const openTag = { type: "html", value: `<div data-transcript="${label.replace(/"/g, "&quot;")}"${openAttr}>` } as unknown as RootContent;
        const closeTag = { type: "html", value: `</div>` } as unknown as RootContent;

        const newNodes: RootContent[] = [openTag, ...middleNodes, closeTag];
        // ::: 뒤의 텍스트가 있으면 별도 paragraph로 추가
        if (trailingText) {
          newNodes.push({
            type: "paragraph",
            children: [{ type: "text", value: trailingText }],
          } as unknown as RootContent);
        }

        children.splice(i, endIndex - i + 1, ...newNodes);
        i += newNodes.length;
      } else {
        i++;
      }
    }
  };
}
