"use client";

import { useState } from "react";
import MarkdownEditor from "@/components/editor/MarkdownEditor";
import MarkdownViewer from "@/components/editor/MarkdownViewer";

export default function TestPage() {
  const [markdown, setMarkdown] = useState(`# Welcome to Markdown Editor

This is a **bold** text and this is *italic*.

## Features

- [[Wiki Links]] support
- GitHub Flavored Markdown
- Live preview

## Code Block

\`\`\`typescript
const hello = "world";
console.log(hello);
\`\`\`

Try editing the text on the left!
`);

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Markdown Editor Test</h1>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h2 className="text-xl font-semibold mb-2">Editor</h2>
          <MarkdownEditor value={markdown} onChange={setMarkdown} />
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2">Preview</h2>
          <div className="border rounded-lg min-h-[500px] overflow-auto">
            <MarkdownViewer
              content={markdown}
              onWikiLinkClick={(pageName) => {
                alert(`Clicked wiki link: ${pageName}`);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
