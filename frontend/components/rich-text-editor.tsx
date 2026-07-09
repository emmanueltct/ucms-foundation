'use client';

// components/rich-text-editor.tsx
// A small, dependency-free rich text editor — bold/italic/underline,
// headings, bullet/numbered lists, and links — built on a plain
// contentEditable div and the browser's Selection/Range API rather than a
// heavy third-party WYSIWYG package. Stores/returns sanitized-on-render
// HTML. Used wherever a `richtext` custom field, an announcement body, or
// a long-form notes field wants formatting beyond plain text.
//
// Deliberately scoped: this covers the common "format some text, add a
// link, add a list" case well. It does not implement image/video embeds,
// tables, mentions, or emoji pickers — those would each be a real feature
// in their own right, not a natural extension of a lightweight editor. See
// docs/custom-fields/business-analysis.md for the scope note.

import { useCallback, useEffect, useRef } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Link as LinkIcon, Heading2 } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  id?: string;
}

const TOOLBAR_BUTTONS: { command: string; icon: typeof Bold; label: string; arg?: string }[] = [
  { command: 'bold', icon: Bold, label: 'Bold' },
  { command: 'italic', icon: Italic, label: 'Italic' },
  { command: 'underline', icon: Underline, label: 'Underline' },
  { command: 'formatBlock', icon: Heading2, label: 'Heading', arg: 'h3' },
  { command: 'insertUnorderedList', icon: List, label: 'Bulleted list' },
  { command: 'insertOrderedList', icon: ListOrdered, label: 'Numbered list' },
];

export function RichTextEditor({ value, onChange, placeholder, id }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalUpdate = useRef(false);

  // Only push external `value` changes into the DOM — never on every
  // keystroke, or the cursor would jump to the start on each render.
  useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const handleInput = useCallback(() => {
    if (!editorRef.current) return;
    isInternalUpdate.current = true;
    onChange(editorRef.current.innerHTML);
  }, [onChange]);

  function exec(command: string, arg?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    handleInput();
  }

  function insertLink() {
    const url = window.prompt('Link URL:');
    if (url) exec('createLink', url);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-[#1E2A44]/20">
      <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-slate-100 bg-slate-50/60">
        {TOOLBAR_BUTTONS.map((btn) => (
          <button
            key={btn.command + (btn.arg ?? '')}
            type="button"
            title={btn.label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(btn.command, btn.arg)}
            className="h-6 w-6 rounded flex items-center justify-center text-slate-500 hover:bg-slate-200/70 hover:text-[#1E2A44]"
          >
            <btn.icon className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        ))}
        <button
          type="button"
          title="Insert link"
          onMouseDown={(e) => e.preventDefault()}
          onClick={insertLink}
          className="h-6 w-6 rounded flex items-center justify-center text-slate-500 hover:bg-slate-200/70 hover:text-[#1E2A44]"
        >
          <LinkIcon className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>
      <div
        id={id}
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        data-placeholder={placeholder}
        suppressContentEditableWarning
        className="min-h-[100px] px-3 py-2 text-sm text-slate-800 outline-none prose-sm [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h3]:font-serif [&_h3]:text-base [&_h3]:text-[#1E2A44] [&_a]:text-[#1E2A44] [&_a]:underline empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400"
      />
    </div>
  );
}
