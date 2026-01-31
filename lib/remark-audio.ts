/**
 * remark 플러그인: !audio[제목](경로) 문법을 <audio> 태그로 변환
 *
 * 마크다운에서 이미지 문법(![]())과 유사한 형태로 오디오를 삽입할 수 있게 한다.
 * 예: !audio[회의 녹음](/api/audio/default/2026-01-31-abc123.webm)
 *
 * 변환 결과: <audio src="..." data-title="회의 녹음"></audio>
 * MarkdownViewer의 audio 커스텀 렌더러가 AudioPlayer로 렌더링한다.
 */

import { visit } from "unist-util-visit";
import type { Root, Paragraph, Text, Link } from "mdast";

const AUDIO_REGEX = /^!audio\[([^\]]*)\]\(([^)]+)\)$/;

export default function remarkAudio() {
  return (tree: Root) => {
    visit(tree, "paragraph", (node: Paragraph, index, parent) => {
      if (!parent || typeof index !== "number") return;

      // 케이스 1: paragraph가 텍스트 하나만 포함하고, 그 텍스트가 !audio 패턴인 경우
      if (
        node.children.length === 1 &&
        node.children[0].type === "text"
      ) {
        const text = node.children[0] as Text;
        const match = text.value.match(AUDIO_REGEX);

        if (match) {
          const title = match[1];
          const src = match[2];

          parent.children[index] = {
            type: "html",
            value: `<audio src="${src}" data-title="${title.replace(/"/g, "&quot;")}"></audio>`,
          } as unknown as Paragraph;
          return;
        }
      }

      // 케이스 2: remark 파서가 !audio[title](url)을 text("!audio") + link 노드로 분리한 경우
      if (
        node.children.length === 2 &&
        node.children[0].type === "text" &&
        node.children[1].type === "link"
      ) {
        const textNode = node.children[0] as Text;
        const linkNode = node.children[1] as Link;

        if (textNode.value === "!audio") {
          const title = linkNode.children
            .filter((c): c is Text => c.type === "text")
            .map((c) => c.value)
            .join("");
          const src = linkNode.url;

          parent.children[index] = {
            type: "html",
            value: `<audio src="${src}" data-title="${title.replace(/"/g, "&quot;")}"></audio>`,
          } as unknown as Paragraph;
        }
      }
    });
  };
}
