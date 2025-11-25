'use client';

import { useState, useRef, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { EditorView, keymap } from '@codemirror/view';
import { autocompletion } from '@codemirror/autocomplete';
import type { CompletionContext } from '@codemirror/autocomplete';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ImagePlus,
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading,
  List,
  ListOrdered,
  CheckSquare,
  Link,
  Quote,
  Minus,
  ChevronDown,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Start writing...',
}: MarkdownEditorProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [documentTitles, setDocumentTitles] = useState<string[]>([]);
  const editorViewRef = useRef<EditorView | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch document titles for wiki link autocomplete
  useEffect(() => {
    async function fetchDocumentTitles() {
      try {
        const res = await fetch('/api/documents/titles');
        const data = await res.json();
        if (data.success) {
          setDocumentTitles(data.data.titles);
        }
      } catch (err) {
        console.error('Failed to fetch document titles:', err);
      }
    }
    fetchDocumentTitles();
  }, []);

  // Wiki link autocomplete function
  const wikiLinkCompletion = (context: CompletionContext) => {
    const { state, pos } = context;
    const line = state.doc.lineAt(pos);
    const textBefore = line.text.slice(0, pos - line.from);
    const textAfter = line.text.slice(pos - line.from);

    // Check if we're typing a wiki link [[...
    const match = textBefore.match(/\[\[([^\]]*?)$/);
    if (!match) return null;

    const searchText = match[1].toLowerCase();
    const from = pos - searchText.length;

    // Check if ]] already exists after cursor (auto-closing brackets)
    const hasClosingBrackets = textAfter.startsWith(']]');

    // Filter document titles
    const options = documentTitles
      .filter((title) => title.toLowerCase().includes(searchText))
      .map((title) => ({
        label: title,
        // If ]] already exists, just insert title, otherwise insert title]]
        apply: hasClosingBrackets ? title : `${title}]]`,
        type: 'text',
      }));

    return {
      from,
      options,
      validFor: /^[^\]]*$/,
    };
  };

  // Markdown formatting functions
  const insertMarkdown = (before: string, after: string = '') => {
    if (!editorViewRef.current) return;

    const view = editorViewRef.current;
    const { from, to } = view.state.selection.main;
    const selectedText = view.state.doc.sliceString(from, to);

    if (selectedText) {
      // Wrap selected text
      view.dispatch({
        changes: { from, to, insert: `${before}${selectedText}${after}` },
        selection: { anchor: from + before.length + selectedText.length + after.length },
      });
    } else {
      // Insert at cursor with placeholder
      const placeholder = 'text';
      view.dispatch({
        changes: { from, insert: `${before}${placeholder}${after}` },
        selection: { anchor: from + before.length, head: from + before.length + placeholder.length },
      });
    }
    view.focus();
  };

  const insertHeading = (level: number) => {
    if (!editorViewRef.current) return;

    const view = editorViewRef.current;
    const { from } = view.state.selection.main;
    const line = view.state.doc.lineAt(from);
    const lineStart = line.from;
    const lineText = line.text;

    // Remove existing heading markers
    const cleanText = lineText.replace(/^#+\s*/, '');
    const headingMarker = '#'.repeat(level) + ' ';

    view.dispatch({
      changes: { from: lineStart, to: line.to, insert: headingMarker + cleanText },
      selection: { anchor: lineStart + headingMarker.length + cleanText.length },
    });
    view.focus();
  };

  const insertList = (marker: string) => {
    if (!editorViewRef.current) return;

    const view = editorViewRef.current;
    const { from } = view.state.selection.main;
    const line = view.state.doc.lineAt(from);
    const lineStart = line.from;
    const lineText = line.text;

    // Check if already a list item
    if (lineText.trim().startsWith(marker)) {
      // Remove marker
      const newText = lineText.replace(new RegExp(`^\\s*${marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`), '');
      view.dispatch({
        changes: { from: lineStart, to: line.to, insert: newText },
      });
    } else {
      // Add marker
      view.dispatch({
        changes: { from: lineStart, to: line.to, insert: `${marker} ${lineText}` },
      });
    }
    view.focus();
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      setIsUploading(true);

      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        return data.data.path;
      } else {
        console.error('Failed to upload image:', data.error);
        return null;
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const insertMarkdownImage = (
    imagePath: string,
    altText: string = 'image'
  ) => {
    const markdown = `![${altText}](${imagePath})`;

    if (editorViewRef.current) {
      const view = editorViewRef.current;
      const pos = view.state.selection.main.head;
      view.dispatch({
        changes: { from: pos, insert: markdown },
      });
    } else {
      // Fallback: append to end
      onChange(value + '\n' + markdown);
    }
  };

  const handlePaste = async (event: React.ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (item.type.startsWith('image/')) {
        event.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const imagePath = await uploadImage(file);
          if (imagePath) {
            insertMarkdownImage(imagePath);
          }
        }
        break;
      }
    }
  };

  const handleDrop = async (event: React.DragEvent) => {
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const imageFiles = Array.from(files).filter((file) =>
      file.type.startsWith('image/')
    );

    if (imageFiles.length > 0) {
      event.preventDefault();

      for (const file of imageFiles) {
        const imagePath = await uploadImage(file);
        if (imagePath) {
          insertMarkdownImage(imagePath, file.name.split('.')[0]);
        }
      }
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleImageButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        const imagePath = await uploadImage(file);
        if (imagePath) {
          insertMarkdownImage(imagePath, file.name.split('.')[0]);
        }
      }
    }

    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Keyboard shortcuts
  const markdownKeymap = keymap.of([
    {
      key: 'Mod-b',
      run: () => {
        insertMarkdown('**', '**');
        return true;
      },
    },
    {
      key: 'Mod-i',
      run: () => {
        insertMarkdown('*', '*');
        return true;
      },
    },
    {
      key: 'Mod-k',
      run: () => {
        insertMarkdown('[', '](url)');
        return true;
      },
    },
    {
      key: 'Mod-e',
      run: () => {
        insertMarkdown('`', '`');
        return true;
      },
    },
    {
      key: 'Mod-Shift-x',
      run: () => {
        insertMarkdown('~~', '~~');
        return true;
      },
    },
    {
      key: 'Mod-Shift-c',
      run: () => {
        insertMarkdown('```\n', '\n```');
        return true;
      },
    },
  ]);

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center gap-1 p-2 border-b bg-gray-50 flex-wrap">
          {/* Bold */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => insertMarkdown('**', '**')}
                className="cursor-pointer hover:bg-gray-200"
              >
                <Bold className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-black/80 text-white border-none">
              <p>Bold (⌘B / Ctrl+B)</p>
            </TooltipContent>
          </Tooltip>

          {/* Italic */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => insertMarkdown('*', '*')}
                className="cursor-pointer hover:bg-gray-200"
              >
                <Italic className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-black/80 text-white border-none">
              <p>Italic (⌘I / Ctrl+I)</p>
            </TooltipContent>
          </Tooltip>

          {/* Strikethrough */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => insertMarkdown('~~', '~~')}
                className="cursor-pointer hover:bg-gray-200"
              >
                <Strikethrough className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-black/80 text-white border-none">
              <p>Strikethrough (⌘⇧X / Ctrl+Shift+X)</p>
            </TooltipContent>
          </Tooltip>

          {/* Inline Code */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => insertMarkdown('`', '`')}
                className="cursor-pointer hover:bg-gray-200"
              >
                <Code className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-black/80 text-white border-none">
              <p>Inline Code (⌘E / Ctrl+E)</p>
            </TooltipContent>
          </Tooltip>

          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* Heading Dropdown */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="cursor-pointer hover:bg-gray-200">
                    <Heading className="h-4 w-4" />
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent className="bg-black/80 text-white border-none">
                <p>Heading</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent className="bg-white">
              <DropdownMenuItem onClick={() => insertHeading(1)} className="cursor-pointer hover:bg-gray-100">
                <span className="font-bold text-lg"># Heading 1</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertHeading(2)} className="cursor-pointer hover:bg-gray-100">
                <span className="font-bold text-base">## Heading 2</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertHeading(3)} className="cursor-pointer hover:bg-gray-100">
                <span className="font-semibold text-sm">### Heading 3</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertHeading(4)} className="cursor-pointer hover:bg-gray-100">
                <span className="font-medium text-sm">#### Heading 4</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* Unordered List */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => insertList('-')}
                className="cursor-pointer hover:bg-gray-200"
              >
                <List className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-black/80 text-white border-none">
              <p>Bullet List</p>
            </TooltipContent>
          </Tooltip>

          {/* Ordered List */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => insertList('1.')}
                className="cursor-pointer hover:bg-gray-200"
              >
                <ListOrdered className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-black/80 text-white border-none">
              <p>Numbered List</p>
            </TooltipContent>
          </Tooltip>

          {/* Checkbox */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => insertList('- [ ]')}
                className="cursor-pointer hover:bg-gray-200"
              >
                <CheckSquare className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-black/80 text-white border-none">
              <p>Checkbox</p>
            </TooltipContent>
          </Tooltip>

          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* Link */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => insertMarkdown('[', '](url)')}
                className="cursor-pointer hover:bg-gray-200"
              >
                <Link className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-black/80 text-white border-none">
              <p>Link (⌘K / Ctrl+K)</p>
            </TooltipContent>
          </Tooltip>

          {/* Code Block */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => insertMarkdown('```\n', '\n```')}
                className="cursor-pointer hover:bg-gray-200"
              >
                <Code className="h-4 w-4" />
                <Code className="h-4 w-4 -ml-2" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-black/80 text-white border-none">
              <p>Code Block (⌘⇧C / Ctrl+Shift+C)</p>
            </TooltipContent>
          </Tooltip>

          {/* Blockquote */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => insertList('>')}
                className="cursor-pointer hover:bg-gray-200"
              >
                <Quote className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-black/80 text-white border-none">
              <p>Quote</p>
            </TooltipContent>
          </Tooltip>

          {/* Horizontal Rule */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => insertMarkdown('\n---\n')}
                className="cursor-pointer hover:bg-gray-200"
              >
                <Minus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-black/80 text-white border-none">
              <p>Horizontal Rule</p>
            </TooltipContent>
          </Tooltip>

          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* Image */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleImageButtonClick}
                disabled={isUploading}
                className="cursor-pointer hover:bg-gray-200"
              >
                <ImagePlus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-black/80 text-white border-none">
              <p>💡 드래그&드롭이나 붙여넣기로도 이미지를 넣을 수 있어요!</p>
            </TooltipContent>
          </Tooltip>

          {/* Wiki Link */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => insertMarkdown('[[', ']]')}
                className="cursor-pointer hover:bg-gray-200"
              >
                <span className="text-xs font-bold">[[]]</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-black/80 text-white border-none">
              <p>Wiki Link</p>
            </TooltipContent>
          </Tooltip>

          {isUploading && (
            <span className="text-sm text-blue-600 ml-2">업로드 중...</span>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
        />

        {/* Editor */}
        <div
          onPaste={handlePaste}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="flex-1 relative"
        >
          <CodeMirror
            value={value}
            onChange={onChange}
            onCreateEditor={(view) => {
              editorViewRef.current = view;
            }}
            extensions={[
              markdown({
                base: markdownLanguage,
                codeLanguages: languages,
              }),
              autocompletion({
                override: [wikiLinkCompletion],
                activateOnTyping: true,
              }),
              markdownKeymap,
            ]}
            placeholder={placeholder}
            className="h-full"
            basicSetup={{
              lineNumbers: true,
              highlightActiveLineGutter: true,
              highlightActiveLine: true,
              foldGutter: true,
            }}
            style={{
              fontSize: '14px',
              height: '100%',
            }}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}
