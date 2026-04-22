'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { saveNoteAction } from '@/app/actions';
import { toast } from 'sonner';
import { useDebounce } from '@/hooks/use-debounce';
import { WikiLink } from '@/lib/editor/wiki-link-extension';
import { NoteMetadata } from '@/lib/notes';
import Image from '@tiptap/extension-image';
import { useTabs } from './tabs-context';
import { ActiveLine } from '@/lib/editor/active-line';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { slashCommandSuggestion } from '@/lib/editor/slash-command-suggestion';
import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { 
  Bold, 
  Italic, 
  Heading1, 
  Heading2, 
  List, 
  Code, 
  Table as TableIcon,
  Trash2,
  ArrowRight,
  ArrowDown,
  ChevronLast,
  ChevronDown
} from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const SlashCommand = Extension.create({
  name: 'slashCommand',
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...slashCommandSuggestion,
      }),
    ];
  },
});

interface EditorProps {
  slug: string;
  initialContent: string;
  allNotes: NoteMetadata[];
}

const lowlight = createLowlight(common);

export function Editor({ slug, initialContent, allNotes }: EditorProps) {
  const [content, setContent] = useState(initialContent);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const debouncedContent = useDebounce(content, 750);
  const { openTab } = useTabs();

  useEffect(() => {
    const title = decodeURIComponent(slug).split('/').pop() || '';
    openTab({ slug, title });
  }, [slug, openTab]);

  const noteTitles = useMemo(() => allNotes.map(n => n.title), [allNotes]);

  const editor = useEditor({
    immediatelyRender: false,
    editable: !isReadOnly,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
      }),
      ActiveLine,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      CodeBlockLowlight.configure({ lowlight }),
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-lg max-w-full h-auto border border-white/10 shadow-lg my-4',
        },
      }),
      WikiLink.configure({
        suggestion: {
          items: ({ query }: { query: string }) => {
            return allNotes
              .filter(note => note.title.toLowerCase().includes(query.toLowerCase()))
              .slice(0, 10);
          },
        },
      }),
      SlashCommand,
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      setContent(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert mx-auto focus:outline-none min-h-[500px] py-12 px-6',
      },
    },
  });

  useEffect(() => {
    if (editor) {
      editor.setEditable(!isReadOnly);
    }
  }, [isReadOnly, editor]);

  const saveContent = useCallback(async (newContent: string) => {
    const result = await saveNoteAction(slug, newContent);
    if (!result.success) {
      toast.error('Failed to auto-save');
    }
  }, [slug]);

  useEffect(() => {
    if (debouncedContent !== initialContent && !isReadOnly) {
      saveContent(debouncedContent);
    }
  }, [debouncedContent, initialContent, saveContent, isReadOnly]);

  useEffect(() => {
    if (editor && initialContent !== editor.getHTML()) {
      editor.commands.setContent(initialContent);
    }
  }, [initialContent, editor]);

  if (!editor) return null;

  return (
    <div className="relative w-full h-full">
      {/* Main Toolbar */}
      <div className="sticky top-0 z-30 flex flex-col items-center pt-4 pointer-events-none">
        <div className="flex items-center gap-4 bg-[#0f0f0f]/80 backdrop-blur-xl border border-white/10 p-1.5 rounded-full shadow-2xl pointer-events-auto transition-all">
          <div className="flex items-center gap-2 px-3 border-r border-white/10 mr-1">
            <Switch 
              id="read-mode" 
              checked={isReadOnly} 
              onCheckedChange={setIsReadOnly}
            />
            <Label htmlFor="read-mode" className="text-[10px] uppercase tracking-widest font-bold opacity-50 cursor-pointer select-none">
              {isReadOnly ? 'Read' : 'Edit'}
            </Label>
          </div>
          
          {!isReadOnly && (
            <div className="flex items-center gap-0.5 pr-1">
              <Toggle 
                size="sm" 
                pressed={editor.isActive('heading', { level: 1 })}
                onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className="h-7 w-7 p-0"
              >
                <Heading1 className="h-4 w-4" />
              </Toggle>
              <Toggle 
                size="sm" 
                pressed={editor.isActive('heading', { level: 2 })}
                onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className="h-7 w-7 p-0"
              >
                <Heading2 className="h-4 w-4" />
              </Toggle>
              <Separator orientation="vertical" className="mx-1 h-4 bg-white/10" />
              <Toggle 
                size="sm" 
                pressed={editor.isActive('bold')}
                onPressedChange={() => editor.chain().focus().toggleBold().run()}
                className="h-7 w-7 p-0"
              >
                <Bold className="h-4 w-4" />
              </Toggle>
              <Toggle 
                size="sm" 
                pressed={editor.isActive('italic')}
                onPressedChange={() => editor.chain().focus().toggleItalic().run()}
                className="h-7 w-7 p-0"
              >
                <Italic className="h-4 w-4" />
              </Toggle>
              <Separator orientation="vertical" className="mx-1 h-4 bg-white/10" />
              <Toggle 
                size="sm" 
                pressed={editor.isActive('bulletList')}
                onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
                className="h-7 w-7 p-0"
              >
                <List className="h-4 w-4" />
              </Toggle>
              <Toggle 
                size="sm" 
                pressed={editor.isActive('codeBlock')}
                onPressedChange={() => editor.chain().focus().toggleCodeBlock().run()}
                className="h-7 w-7 p-0"
              >
                <Code className="h-4 w-4" />
              </Toggle>
              <Separator orientation="vertical" className="mx-1 h-4 bg-white/10" />
              <button 
                onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                className="h-7 w-7 flex items-center justify-center hover:bg-white/5 rounded-md transition-colors"
                title="Insert Table"
              >
                <TableIcon className="h-4 w-4" />
              </button>
              
              {editor.isActive('table') && (
                <div className="flex items-center gap-0.5 ml-1 border-l border-white/10 pl-1">
                  <Button size="icon-sm" variant="ghost" className="h-7 w-7" onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add Col">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon-sm" variant="ghost" className="h-7 w-7" onClick={() => editor.chain().focus().addRowAfter().run()} title="Add Row">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Separator orientation="vertical" className="h-4 bg-white/10 mx-1" />
                  <Button size="icon-sm" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => editor.chain().focus().deleteColumn().run()} title="Del Col">
                    <ChevronLast className="h-3.5 w-3.5 rotate-180" />
                  </Button>
                  <Button size="icon-sm" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => editor.chain().focus().deleteRow().run()} title="Del Row">
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon-sm" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => editor.chain().focus().deleteTable().run()} title="Delete Table">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )}
          
          {isReadOnly && (
            <div className="flex items-center px-4 py-1 text-[10px] uppercase tracking-widest font-bold text-white/30 italic">
              View Only Mode
            </div>
          )}
        </div>
      </div>

      <div className="w-full h-full">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
