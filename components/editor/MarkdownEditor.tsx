'use client';

import { useState, useRef, useEffect } from 'react';
import { useTheme } from 'next-themes';
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
  Table,
  Sigma,
  Highlighter,
  Footprints,
  MoreHorizontal,
  Smile,
  ChevronsUpDown,
  Keyboard,
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

// Dark theme for CodeMirror
const darkTheme = EditorView.theme({
  '&': {
    backgroundColor: '#3D4A5C',
    color: '#F3F4F6',
  },
  '.cm-content': {
    caretColor: '#F3F4F6',
  },
  '.cm-cursor': {
    borderLeftColor: '#F3F4F6',
  },
  '.cm-gutters': {
    backgroundColor: '#2D3748',
    color: '#9CA3AF',
    borderRight: '1px solid #6B7280',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#4A5568',
  },
  '.cm-activeLine': {
    backgroundColor: '#4A556820',
  },
  '.cm-placeholder': {
    color: '#9CA3AF',
  },
}, { dark: true });


export default function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Start writing...',
}: MarkdownEditorProps) {
  const { resolvedTheme } = useTheme();
  const [isUploading, setIsUploading] = useState(false);
  const [documentTitles, setDocumentTitles] = useState<string[]>([]);
  const editorViewRef = useRef<EditorView | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);

  // Wait for theme to be resolved (avoid hydration mismatch)
  useEffect(() => {
    setMounted(true);
  }, []);

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
      <div className="h-full flex flex-col min-h-0">
        {/* Toolbar */}
        <div className="flex items-center gap-1 p-2 border-b bg-muted flex-wrap">
          {/* Bold */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => insertMarkdown('**', '**')}
                className="cursor-pointer hover:bg-accent"
              >
                <Bold className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-black/80 text-white border-none">
              <p>볼드 (⌘B / Ctrl+B)</p>
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
                className="cursor-pointer hover:bg-accent"
              >
                <Italic className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-black/80 text-white border-none">
              <p>이탤릭 (⌘I / Ctrl+I)</p>
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
                className="cursor-pointer hover:bg-accent"
              >
                <Strikethrough className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-black/80 text-white border-none">
              <p>취소선 (⌘⇧X / Ctrl+Shift+X)</p>
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
                className="cursor-pointer hover:bg-accent"
              >
                <Code className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-black/80 text-white border-none">
              <p>인라인 코드 (⌘E / Ctrl+E)</p>
            </TooltipContent>
          </Tooltip>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Heading Dropdown */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="cursor-pointer hover:bg-accent">
                    <Heading className="h-4 w-4" />
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent className="bg-black/80 text-white border-none">
                <p>제목</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent className="bg-card">
              <DropdownMenuItem onClick={() => insertHeading(1)} className="cursor-pointer hover:bg-accent">
                <span className="font-bold text-lg"># 제목 1</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertHeading(2)} className="cursor-pointer hover:bg-accent">
                <span className="font-bold text-base">## 제목 2</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertHeading(3)} className="cursor-pointer hover:bg-accent">
                <span className="font-semibold text-sm">### 제목 3</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertHeading(4)} className="cursor-pointer hover:bg-accent">
                <span className="font-medium text-sm">#### 제목 4</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Unordered List */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => insertList('-')}
                className="cursor-pointer hover:bg-accent"
              >
                <List className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-black/80 text-white border-none">
              <p>글머리 기호</p>
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
                className="cursor-pointer hover:bg-accent"
              >
                <ListOrdered className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-black/80 text-white border-none">
              <p>번호 목록</p>
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
                className="cursor-pointer hover:bg-accent"
              >
                <CheckSquare className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-black/80 text-white border-none">
              <p>체크박스</p>
            </TooltipContent>
          </Tooltip>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Link */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => insertMarkdown('[', '](url)')}
                className="cursor-pointer hover:bg-accent"
              >
                <Link className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-black/80 text-white border-none">
              <p>링크 (⌘K / Ctrl+K)</p>
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
                className="cursor-pointer hover:bg-accent"
              >
                <Code className="h-4 w-4" />
                <Code className="h-4 w-4 -ml-2" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-black/80 text-white border-none">
              <p>코드 블록 (⌘⇧C / Ctrl+Shift+C)</p>
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
                className="cursor-pointer hover:bg-accent"
              >
                <Quote className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-black/80 text-white border-none">
              <p>인용</p>
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
                className="cursor-pointer hover:bg-accent"
              >
                <Minus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-black/80 text-white border-none">
              <p>구분선</p>
            </TooltipContent>
          </Tooltip>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Image */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleImageButtonClick}
                disabled={isUploading}
                className="cursor-pointer hover:bg-accent"
              >
                <ImagePlus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-black/80 text-white border-none text-center">
              <p className="font-medium">이미지 첨부</p>
              <p className="text-xs opacity-80">💡 드래그&드롭이나 붙여넣기로도 이미지를 넣을 수 있어요!</p>
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
                className="cursor-pointer hover:bg-accent"
              >
                <span className="text-xs font-bold">[[]]</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-black/80 text-white border-none">
              <p>위키 링크</p>
            </TooltipContent>
          </Tooltip>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Table */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => insertMarkdown('\n| 헤더 1 | 헤더 2 | 헤더 3 |\n|--------|--------|--------|\n| 셀 1 | 셀 2 | 셀 3 |\n')}
                className="cursor-pointer hover:bg-accent"
              >
                <Table className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-black/80 text-white border-none">
              <p>테이블</p>
            </TooltipContent>
          </Tooltip>

          {/* Math */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="cursor-pointer hover:bg-accent">
                    <Sigma className="h-4 w-4" />
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent className="bg-black/80 text-white border-none">
                <p>수학 수식</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent className="bg-card">
              <DropdownMenuItem onClick={() => insertMarkdown('$', '$')} className="cursor-pointer hover:bg-accent">
                <span>인라인 수식 $...$</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertMarkdown('\n$$\n', '\n$$\n')} className="cursor-pointer hover:bg-accent">
                <span>블록 수식 $$...$$</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Highlight */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => insertMarkdown('<mark>', '</mark>')}
                className="cursor-pointer hover:bg-accent"
              >
                <Highlighter className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-black/80 text-white border-none">
              <p>하이라이트</p>
            </TooltipContent>
          </Tooltip>

          {/* Footnote */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => insertMarkdown('[^1]\n\n[^1]: ', '\n')}
                className="cursor-pointer hover:bg-accent"
              >
                <Footprints className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-black/80 text-white border-none">
              <p>각주</p>
            </TooltipContent>
          </Tooltip>

          {/* More Options */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="cursor-pointer hover:bg-accent">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent className="bg-black/80 text-white border-none">
                <p>더보기</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent className="bg-card">
              <DropdownMenuItem onClick={() => insertMarkdown(':smile: ')} className="cursor-pointer hover:bg-accent">
                <Smile className="h-4 w-4 mr-2" />
                <span>이모지 :emoji:</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertMarkdown('<details>\n<summary>제목</summary>\n\n', '\n\n</details>')} className="cursor-pointer hover:bg-accent">
                <ChevronsUpDown className="h-4 w-4 mr-2" />
                <span>접는 섹션</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertMarkdown('<kbd>', '</kbd>')} className="cursor-pointer hover:bg-accent">
                <Keyboard className="h-4 w-4 mr-2" />
                <span>키보드 단축키</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {isUploading && (
            <span className="text-sm text-primary ml-2">업로드 중...</span>
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
          className="flex-1 relative overflow-hidden min-h-0"
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
              EditorView.lineWrapping,
              ...(mounted && resolvedTheme === 'dark' ? [darkTheme] : []),
            ]}
            placeholder={placeholder}
            className="h-full"
            basicSetup={{
              lineNumbers: true,
              highlightActiveLineGutter: true,
              highlightActiveLine: true,
              foldGutter: true,
            }}
            theme={mounted && resolvedTheme === 'dark' ? 'dark' : 'light'}
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
