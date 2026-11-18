import {
  Bold,
  Code,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  hasError?: boolean;
}

export function RichTextEditor({ value, onChange, hasError }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [sourceMode, setSourceMode] = useState(false);
  const [linkInputOpen, setLinkInputOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');

  useEffect(() => {
    if (!sourceMode && editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '<p></p>';
    }
  }, [value, sourceMode]);

  function exec(command: string, commandValue?: string) {
    if (sourceMode || !editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, commandValue);
    onChange(editorRef.current.innerHTML);
  }

  function applyLink() {
    const trimmed = linkUrl.trim();
    if (trimmed && /^https?:\/\//i.test(trimmed)) {
      exec('createLink', trimmed);
    }
    setLinkInputOpen(false);
    setLinkUrl('https://');
  }

  return (
    <div
      className={`border rounded-lg bg-white overflow-hidden ${
        hasError ? 'border-red-500' : 'border-stone-300 focus-within:border-stone-800'
      }`}
    >
      {/* Formatting Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-stone-50 border-b border-stone-200">
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            title="Heading 2"
            onClick={() => exec('formatBlock', '<h2>')}
            className="p-2 rounded text-stone-700 hover:bg-stone-200/70 transition-colors"
          >
            <Heading2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Heading 3"
            onClick={() => exec('formatBlock', '<h3>')}
            className="p-2 rounded text-stone-700 hover:bg-stone-200/70 transition-colors"
          >
            <Heading3 className="w-4 h-4" />
          </button>
          <span className="w-px h-4 bg-stone-300 mx-1" aria-hidden="true" />
          <button
            type="button"
            title="Bold"
            onClick={() => exec('bold')}
            className="p-2 rounded text-stone-700 hover:bg-stone-200/70 transition-colors"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Italic"
            onClick={() => exec('italic')}
            className="p-2 rounded text-stone-700 hover:bg-stone-200/70 transition-colors"
          >
            <Italic className="w-4 h-4" />
          </button>
          <span className="w-px h-4 bg-stone-300 mx-1" aria-hidden="true" />
          <button
            type="button"
            title="Bullet List"
            onClick={() => exec('insertUnorderedList')}
            className="p-2 rounded text-stone-700 hover:bg-stone-200/70 transition-colors"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Numbered List"
            onClick={() => exec('insertOrderedList')}
            className="p-2 rounded text-stone-700 hover:bg-stone-200/70 transition-colors"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Blockquote"
            onClick={() => exec('formatBlock', '<blockquote>')}
            className="p-2 rounded text-stone-700 hover:bg-stone-200/70 transition-colors"
          >
            <Quote className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Code Block"
            onClick={() => exec('formatBlock', '<pre>')}
            className="p-2 rounded text-stone-700 hover:bg-stone-200/70 transition-colors"
          >
            <Code className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Insert Link"
            onClick={() => setLinkInputOpen((prev) => !prev)}
            className="p-2 rounded text-stone-700 hover:bg-stone-200/70 transition-colors"
          >
            <LinkIcon className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setSourceMode((prev) => !prev)}
          className="px-2.5 py-1 text-xs font-medium text-stone-700 bg-white border border-stone-300 rounded hover:bg-stone-100 whitespace-nowrap shrink-0"
        >
          {sourceMode ? 'Visual Editor' : 'HTML Source'}
        </button>
      </div>

      {linkInputOpen && !sourceMode && (
        <div className="flex items-center gap-2 px-3 py-2 bg-stone-50 border-b border-stone-200">
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://example.com"
            className="flex-1 px-2.5 py-1 text-sm border border-stone-300 rounded bg-white focus:outline-none focus:border-stone-800"
          />
          <button
            type="button"
            onClick={applyLink}
            className="px-3 py-1 text-xs font-medium text-white bg-stone-900 rounded hover:bg-stone-800"
          >
            Apply Link
          </button>
          <button
            type="button"
            onClick={() => setLinkInputOpen(false)}
            className="px-2.5 py-1 text-xs text-stone-600 hover:text-stone-900"
          >
            Cancel
          </button>
        </div>
      )}

      {sourceMode ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={12}
          className="w-full p-4 font-code text-sm text-stone-800 focus:outline-none resize-y"
          placeholder="<p>Write your article HTML...</p>"
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={() => {
            if (editorRef.current) {
              onChange(editorRef.current.innerHTML);
            }
          }}
          className="editorial-prose min-h-[280px] max-w-none p-5 focus:outline-none"
        />
      )}
    </div>
  );
}
