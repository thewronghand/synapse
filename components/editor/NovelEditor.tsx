"use client";

import { EditorRoot, EditorContent, StarterKit, Placeholder } from "novel";

const extensions = [
  StarterKit,
  Placeholder.configure({
    placeholder: "Type / for commands..."
  })
];

interface NovelEditorProps {
  initialContent?: string;
  onUpdate?: (content: string) => void;
}

export default function NovelEditor({
  initialContent,
  onUpdate
}: NovelEditorProps) {
  return (
    <EditorRoot>
      <EditorContent
        initialContent={initialContent}
        extensions={extensions}
        onUpdate={({ editor }) => {
          const json = editor.getJSON();
          const jsonString = JSON.stringify(json);
          onUpdate?.(jsonString);
        }}
        immediatelyRender={false}
        editorProps={{
          attributes: {
            class: "prose prose-lg dark:prose-invert focus:outline-none max-w-full p-4"
          }
        }}
        className="min-h-[500px] w-full border rounded-lg"
      />
    </EditorRoot>
  );
}
