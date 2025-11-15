"use client";

import CodeMirror from "@uiw/react-codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function MarkdownEditor({
  value,
  onChange,
  placeholder = "Start writing..."
}: MarkdownEditorProps) {
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={[
        markdown({
          base: markdownLanguage,
          codeLanguages: languages
        })
      ]}
      placeholder={placeholder}
      className="border rounded-lg overflow-hidden"
      basicSetup={{
        lineNumbers: true,
        highlightActiveLineGutter: true,
        highlightActiveLine: true,
        foldGutter: true,
      }}
      style={{
        fontSize: "14px",
        minHeight: "500px",
      }}
    />
  );
}
