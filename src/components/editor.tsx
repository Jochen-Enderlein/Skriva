'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { saveNoteAction } from '@/app/actions';
import { toast } from 'sonner';
import { useDebounce } from '@/hooks/use-debounce';
import { NoteMetadata } from '@/lib/notes';
import { useTabs } from './tabs-context';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import Link from 'next/link';
import { 
  Bold, 
  Italic, 
  Heading1, 
  Heading2, 
  List as ListIcon, 
  Code, 
  Table as TableIcon,
  Share2
} from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

import { ExcalidrawEditor } from './excalidraw-editor';
import { ExcalidrawEmbed } from './excalidraw-embed';

import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { EditorView } from '@codemirror/view';
import { blockIconGutter, autocompleteExtensions } from '@/lib/editor/cm-extensions';
import { MiniGraphView } from './mini-graph-view';

interface EditorProps {
  slug: string;
  initialContent: string;
  allNotes: NoteMetadata[];
  graphData: any;
  backlinks: any[];
  allTags: string[];
}

export function Editor({ slug, initialContent, allNotes, graphData, backlinks: initialBacklinks, allTags }: EditorProps) {
  const [content, setContent] = useState(initialContent);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [isGraphOpen, setIsGraphOpen] = useState(false);
  const debouncedContent = useDebounce(content, 750);
  const { openTab } = useTabs();
  const codeMirrorRef = useRef<ReactCodeMirrorRef>(null);

  useEffect(() => {
    const title = decodeURIComponent(slug).split('/').pop() || '';
    openTab({ slug, title });
  }, [slug, openTab]);

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

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

  const viewContent = useMemo(() => {
    if (!content) return '';
    let processed = content;

    // If the current file is an excalidraw file, we handle it separately in the return
    if (decodeURIComponent(slug).toLowerCase().endsWith('.excalidraw')) {
      return content;
    }
    
    // Transform [[WikiLink]] syntax to Markdown links for viewing
    processed = processed.replace(/\[\[(.*?)\]\]/g, (match, p1) => {
      const parts = p1.split('|');
      const target = parts[0];
      const display = parts[1] || target;
      
      if (target.toLowerCase().endsWith('.excalidraw')) {
        return `<div class="excalidraw-transclusion" data-slug="${encodeURIComponent(target)}"></div>`;
      }
      
      return `[${display}](/note/${encodeURIComponent(target)})`;
    });

    // Protect code blocks and inline code
    const codeBlocks: string[] = [];
    processed = processed.replace(/```[\s\S]*?```/g, (match) => {
      codeBlocks.push(match);
      return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });
    
    const inlineCode: string[] = [];
    processed = processed.replace(/`[^`]+`/g, (match) => {
      inlineCode.push(match);
      return `__INLINE_CODE_${inlineCode.length - 1}__`;
    });

    // Process Hashtags into Chips
    processed = processed.replace(/(^|\s)#([a-zA-Z0-9_]+)/g, '$1<span class="inline-flex items-center rounded-full bg-primary/20 px-2 py-0.5 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/30 cursor-pointer hover:bg-primary/30 transition-colors mx-1 mb-1">#$2</span>');

    // Restore inline code
    processed = processed.replace(/__INLINE_CODE_(\d+)__/g, (_, idx) => inlineCode[parseInt(idx)]);
    // Restore code blocks
    processed = processed.replace(/__CODE_BLOCK_(\d+)__/g, (_, idx) => codeBlocks[parseInt(idx)]);

    return processed;
  }, [content]);

  const insertFormat = (prefix: string, suffix: string = '') => {
    const view = codeMirrorRef.current?.view;
    if (!view) return;

    const selection = view.state.selection.main;
    const selectedText = view.state.sliceDoc(selection.from, selection.to);
    
    view.dispatch({
      changes: {
        from: selection.from,
        to: selection.to,
        insert: prefix + selectedText + suffix
      },
      selection: { 
        anchor: selection.from + prefix.length, 
        head: selection.from + prefix.length + selectedText.length 
      }
    });
    view.focus();
  };

  const transparentTheme = EditorView.theme({
    "&": {
      backgroundColor: "transparent !important",
    },
    ".cm-gutters": {
      backgroundColor: "transparent !important",
      borderRight: "1px solid rgba(255, 255, 255, 0.1)",
      color: "rgba(255,255,255,0.4)"
    },
    ".cm-activeLine, .cm-activeLineGutter": {
      backgroundColor: "rgba(255, 255, 255, 0.03) !important",
    },
    ".cm-block-icons .cm-gutterElement": {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      padding: "0 4px",
      minWidth: "24px"
    }
  });

  const cmExtensions = useMemo(() => [
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    EditorView.lineWrapping,
    blockIconGutter,
    autocompleteExtensions(allTags, allNotes),
    transparentTheme
  ], [allTags, allNotes, transparentTheme]);

  const BacklinksSection = () => {
    if (!initialBacklinks || initialBacklinks.length === 0) return null;
    return (
      <div className="mt-16 pt-8 border-t border-white/10">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          {initialBacklinks.length} {initialBacklinks.length === 1 ? 'mention' : 'mentions'} in other notes
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {initialBacklinks.map((link) => (
            <Link
              key={link.slug}
              href={`/note/${link.slug}`}
              className="group block p-4 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
            >
              <div className="flex items-center gap-2 font-medium mb-1">
                <div className="h-4 w-4 opacity-40 group-hover:opacity-100 transition-opacity">
                   <ListIcon className="h-4 w-4" />
                </div>
                <span className="text-sm">{link.title}</span>
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-2 italic">
                {link.snippet}
              </p>
            </Link>
          ))}
        </div>
      </div>
    );
  };

  const isExcalidraw = useMemo(() => decodeURIComponent(slug).toLowerCase().endsWith('.excalidraw'), [slug]);

  const toc = useMemo(() => {
    if (isExcalidraw) return [];
    const lines = content.split('\n');
    const headings: { text: string; level: number; line: number }[] = [];
    
    lines.forEach((line, index) => {
      const h1Match = line.match(/^#\s+(.+)$/);
      const h2Match = line.match(/^##\s+(.+)$/);
      
      if (h1Match) {
        headings.push({ text: h1Match[1], level: 1, line: index });
      } else if (h2Match) {
        headings.push({ text: h2Match[1], level: 2, line: index });
      }
    });
    
    return headings;
  }, [content, isExcalidraw]);

  const scrollToHeading = (line: number) => {
    if (isReadOnly) return;
    
    const view = codeMirrorRef.current?.view;
    if (!view) return;

    const linePos = view.state.doc.line(line + 1).from;
    view.dispatch({
      selection: { anchor: linePos, head: linePos },
      scrollIntoView: true
    });
    view.focus();
  };

  return (
    <div className="relative w-full h-full flex flex-col xl:flex-row overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Fixed Toolbar Container */}
        <div className="flex-none flex flex-col items-center pt-4 z-30 mb-6">
          <div className="flex items-center gap-4 bg-[#0f0f0f]/80 backdrop-blur-xl border border-white/10 p-1.5 rounded-full shadow-2xl transition-all">
            {!isExcalidraw && (
              <div className="flex items-center gap-2 px-3 border-r border-white/10 mr-1">
                <Switch 
                  id="read-mode" 
                  checked={isReadOnly} 
                  onCheckedChange={setIsReadOnly}
                />
                <Label htmlFor="read-mode" className="text-[10px] uppercase tracking-widest font-bold opacity-50 cursor-pointer select-none">
                  {isReadOnly ? 'View' : 'Edit'}
                </Label>
              </div>
            )}
            
            <div className="flex items-center gap-1 pr-2">
              {!isExcalidraw && !isReadOnly && (
                <>
                  <button onClick={() => insertFormat('# ')} className="p-1 hover:bg-white/10 rounded" title="Heading 1"><Heading1 className="w-4 h-4" /></button>
                  <button onClick={() => insertFormat('## ')} className="p-1 hover:bg-white/10 rounded" title="Heading 2"><Heading2 className="w-4 h-4" /></button>
                  <Separator orientation="vertical" className="mx-1 h-4 bg-white/10" />
                  <button onClick={() => insertFormat('**', '**')} className="p-1 hover:bg-white/10 rounded" title="Bold"><Bold className="w-4 h-4" /></button>
                  <button onClick={() => insertFormat('*', '*')} className="p-1 hover:bg-white/10 rounded" title="Italic"><Italic className="w-4 h-4" /></button>
                  <Separator orientation="vertical" className="mx-1 h-4 bg-white/10" />
                  <button onClick={() => insertFormat('- ')} className="p-1 hover:bg-white/10 rounded" title="Bullet List"><ListIcon className="w-4 h-4" /></button>
                  <button onClick={() => insertFormat('```\n', '\n```')} className="p-1 hover:bg-white/10 rounded" title="Code Block"><Code className="w-4 h-4" /></button>
                  <Separator orientation="vertical" className="mx-1 h-4 bg-white/10" />
                  <button onClick={() => insertFormat('\n| Header | Header | Header |\n|--------|--------|--------|\n| Cell   | Cell   | Cell   |\n')} className="p-1 hover:bg-white/10 rounded" title="Insert Table"><TableIcon className="w-4 h-4" /></button>
                  <Separator orientation="vertical" className="mx-1 h-4 bg-white/10" />
                </>
              )}

              {/* Graph Panel Toggle */}
              <button 
                onClick={() => setIsGraphOpen(!isGraphOpen)}
                className={`p-1.5 rounded-full transition-all ${isGraphOpen ? 'bg-primary/20 text-primary shadow-[0_0_15px_rgba(var(--primary),0.3)]' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
                title={isGraphOpen ? "Hide Graph" : "Show Graph"}
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
          <div className={`mx-auto w-full ${isExcalidraw ? 'max-w-none px-4 pb-4' : 'max-w-4xl px-6 py-12 pt-0'}`}>
            <div className="w-full h-full relative">
              {isExcalidraw ? (
                <ExcalidrawEditor key={slug} slug={slug} initialContent={initialContent} />
              ) : isReadOnly ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                    components={{
                      div: ({ node, className, ...props }) => {
                        if (className === 'excalidraw-transclusion') {
                          const slug = props['data-slug' as keyof typeof props] as string;
                          return <ExcalidrawEmbed slug={decodeURIComponent(slug)} />;
                        }
                        return <div className={className} {...props} />;
                      },
                      a: ({ node, ...props }) => {
                        if (props.href?.startsWith('/note/')) {
                          return <Link href={props.href}>{props.children}</Link>;
                        }
                        return <a {...props} target="_blank" rel="noopener noreferrer">{props.children}</a>;
                      },
                      code: ({ node, className, children, ...props }) => {
                        const match = /language-(\w+)/.exec(className || '');
                        const isBlock = match || String(children).includes('\n');
                        return isBlock ? (
                          <SyntaxHighlighter
                            style={vscDarkPlus as any}
                            language={match ? match[1] : 'typescript'}
                            PreTag="div"
                            customStyle={{ backgroundColor: 'transparent', padding: 0, margin: '1em 0' }}
                            className="!bg-transparent text-[13px]"
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          <code className="bg-white/10 px-1.5 py-0.5 rounded-md text-[0.9em] font-mono text-primary/90" {...props}>
                            {children}
                          </code>
                        );
                      }
                    }}
                  >
                    {viewContent}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="relative w-full h-[calc(100vh-250px)] rounded-md overflow-hidden bg-transparent">
                  <CodeMirror
                    ref={codeMirrorRef}
                    value={content}
                    height="100%"
                    theme="dark"
                    extensions={cmExtensions}
                    onChange={(val) => setContent(val)}
                    className="h-full text-base font-mono"
                    basicSetup={{
                      lineNumbers: true,
                      foldGutter: true,
                      highlightActiveLine: true,
                      autocompletion: true,
                    }}
                  />
                </div>
              )}
            </div>
            <BacklinksSection />
          </div>
        </div>
      </div>

      {/* Collapsible Side Panel (Graph + ToC) */}
      <div 
        className={`hidden xl:block transition-all duration-300 ease-in-out border-l border-white/5 bg-black/20 backdrop-blur-sm overflow-hidden h-full ${
          isGraphOpen ? 'w-[400px] opacity-100' : 'w-0 opacity-0 border-l-0'
        }`}
      >
        <div className="w-[400px] h-full flex flex-col p-4 gap-4 overflow-hidden">
          {/* Top Section: Local Graph */}
          <div className="flex-[0.4] min-h-0 flex flex-col gap-2">
            <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/20 px-2">Local Graph</div>
            <div className="flex-1 rounded-xl overflow-hidden border border-white/5 bg-black/20">
              <MiniGraphView currentSlug={slug} currentContent={content} globalData={graphData} />
            </div>
          </div>

          {/* Bottom Section: Table of Contents */}
          <div className="flex-[0.6] min-h-0 flex flex-col gap-2">
            <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/20 px-2">Table of Contents</div>
            <div className="flex-1 rounded-xl border border-white/5 bg-black/10 overflow-hidden flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
                {toc.length > 0 ? (
                  <div className="space-y-1">
                    {toc.map((heading, i) => (
                      <button
                        key={i}
                        onClick={() => scrollToHeading(heading.line)}
                        className={`w-full text-left px-3 py-2 rounded-md transition-all hover:bg-white/5 group relative flex items-center gap-3 ${
                          heading.level === 1 ? 'text-white/80' : 'text-white/40 pl-8'
                        }`}
                      >
                        <div className={`h-1 rounded-full transition-all group-hover:w-2 ${
                          heading.level === 1 ? 'w-1 bg-primary/40' : 'w-1 bg-white/10'
                        }`} />
                        <span className={`truncate ${heading.level === 1 ? 'text-xs font-bold' : 'text-[11px] font-medium'}`}>
                          {heading.text}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <span className="text-[10px] text-white/10 uppercase tracking-widest italic">No headings found</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
