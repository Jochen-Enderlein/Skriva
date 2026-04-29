'use client';

import * as React from 'react';
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
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import 'katex/dist/katex.min.css';
import Link from 'next/link';
import { 
  Bold, 
  Italic, 
  Heading1, 
  Heading2, 
  List as ListIcon, 
  Code, 
  Table as TableIcon,
  Share2,
  FileDown,
  Plus,
  Trash2,
  Info,
  AlertCircle,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, prism } from 'react-syntax-highlighter/dist/esm/styles/prism';

import mermaid from 'mermaid';

function Mermaid({ chart }: { chart: string }) {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);
  const id = React.useId().replace(/:/g, '');

  useEffect(() => {
    let isMounted = true;
    
    const renderChart = async () => {
      if (!chart) {
        setIsRendering(false);
        return;
      }
      
      try {
        setIsRendering(true);
        setError(null);
        
        // Ensure mermaid is initialized
        const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'default',
          securityLevel: 'loose',
          fontFamily: 'var(--font-geist-sans)',
        });

        // Use a unique ID for each render attempt
        const renderId = `mermaid-svg-${id}-${Math.random().toString(36).substr(2, 9)}`;
        const { svg: renderedSvg } = await mermaid.render(renderId, chart);
        
        if (isMounted) {
          setSvg(renderedSvg);
          setIsRendering(false);
        }
      } catch (err) {
        console.error('Mermaid render error:', err);
        if (isMounted) {
          setError('Failed to render diagram');
          setIsRendering(false);
        }
      }
    };

    renderChart();
    return () => {
      isMounted = false;
    };
  }, [chart, id]);

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-lg my-4 text-xs font-mono text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div 
      data-rendering={isRendering ? "true" : "false"}
      className="flex justify-center my-6 overflow-x-auto bg-black/10 rounded-xl p-4 min-h-[100px] items-center print:bg-transparent print:p-0 print:min-h-0" 
      dangerouslySetInnerHTML={{ __html: svg || '<div class="animate-pulse print:hidden">Rendering diagram...</div><div class="hidden print:block text-xs text-muted-foreground">Preparing diagram...</div>' }} 
    />
  );
}

import { ExcalidrawEditor } from './excalidraw-editor';
import { ExcalidrawEmbed } from './excalidraw-embed';

import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { html } from '@codemirror/lang-html';
import { languages } from '@codemirror/language-data';
import { EditorView, scrollPastEnd } from '@codemirror/view';
import { blockIconGutter, autocompleteExtensions, calloutHighlightPlugin } from '@/lib/editor/cm-extensions';
import { tableEditExtension, tableEditTheme } from '@/lib/editor/table-extension';
import { livePreviewExtension, livePreviewTheme } from '@/lib/editor/live-preview';
import { MiniGraphView } from './mini-graph-view';
import { cn } from '@/lib/utils';
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useMediaQuery } from "@/hooks/use-media-query";
import { ContentCard } from "./content-card";
import { SidebarTriggerInternal } from "./sidebar-trigger-internal";

const calloutTheme = EditorView.theme({
  ".cm-callout": {
    paddingLeft: "4px",
    borderLeft: "4px solid transparent",
    backgroundColor: "rgba(255, 255, 255, 0.03)"
  },
  ".cm-callout-info": { borderLeftColor: "#3b82f6", backgroundColor: "rgba(59, 130, 246, 0.05)" },
  ".cm-callout-note": { borderLeftColor: "#3b82f6", backgroundColor: "rgba(59, 130, 246, 0.05)" },
  ".cm-callout-warning": { borderLeftColor: "#f59e0b", backgroundColor: "rgba(245, 158, 11, 0.05)" },
  ".cm-callout-danger": { borderLeftColor: "#ef4444", backgroundColor: "rgba(239, 68, 68, 0.05)" },
  ".cm-callout-error": { borderLeftColor: "#ef4444", backgroundColor: "rgba(239, 68, 68, 0.05)" },
  ".cm-callout-success": { borderLeftColor: "#10b981", backgroundColor: "rgba(16, 185, 129, 0.05)" },
  ".cm-callout-tip": { borderLeftColor: "#8b5cf6", backgroundColor: "rgba(139, 92, 246, 0.05)" },
  ".cm-callout-header": {
    fontWeight: "bold",
    color: "var(--primary)",
    letterSpacing: "0.05em"
  }
});

interface EditorProps {
  slug: string;
  initialContent: string;
  allNotes: NoteMetadata[];
  graphData: any;
  backlinks: any[];
  allTags: string[];
  allMentions: string[];
}

export function Editor({ slug, initialContent, allNotes, graphData, backlinks: initialBacklinks, allTags, allMentions }: EditorProps) {
  const isCompact = useMediaQuery("(max-width: 1279px)");
  const [content, setContent] = useState(initialContent);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [tableEditData, setTableEditData] = useState<{
    data: string[][];
    originalString: string;
    isOpen: boolean;
  }>({ data: [], originalString: '', isOpen: false });
  const { isGraphOpen, setIsGraphOpen, openTab } = useTabs();
  const debouncedContent = useDebounce(content, 750);
  const codeMirrorRef = useRef<ReactCodeMirrorRef>(null);

  useEffect(() => {
    const title = decodeURIComponent(slug).split('/').pop() || '';
    openTab({ slug, title });
  }, [slug, openTab]);

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  useEffect(() => {
    const handleHashScroll = () => {
      if (window.location.hash) {
        const hash = window.location.hash.substring(1);
        const el = document.getElementById(hash);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }
    };
    
    // Attempt scroll on mount and when switching to read-only mode
    if (isReadOnly) {
      setTimeout(handleHashScroll, 100);
    }
    
    window.addEventListener('hashchange', handleHashScroll);
    return () => window.removeEventListener('hashchange', handleHashScroll);
  }, [slug, isReadOnly]);

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
      
      const hashIndex = target.indexOf('#');
      const blockIndex = target.indexOf('^');
      const specialIndex = hashIndex !== -1 ? hashIndex : (blockIndex !== -1 ? blockIndex : -1);
      
      let baseTarget = target;
      let hashTarget = '';
      if (specialIndex !== -1) {
        baseTarget = target.substring(0, specialIndex);
        const originalHash = target.substring(specialIndex);
        if (originalHash.startsWith('#')) {
           const slugifiedHash = originalHash.substring(1).toLowerCase().trim().replace(/[\s_]+/g, '-').replace(/[^\w\p{L}-]+/gu, '');
           hashTarget = '#' + slugifiedHash;
        } else {
           hashTarget = originalHash;
        }
      }
      
      if (baseTarget.toLowerCase().endsWith('.excalidraw')) {
        return `<div class="excalidraw-transclusion" data-slug="${encodeURIComponent(baseTarget)}"></div>`;
      }
      
      const noteUrl = baseTarget ? `/note/${encodeURIComponent(baseTarget)}` : '';
      return `[${display}](${noteUrl}${hashTarget})`;
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

    // Restore inline code
    processed = processed.replace(/__INLINE_CODE_(\d+)__/g, (_, idx) => inlineCode[parseInt(idx)]);
    // Restore code blocks
    processed = processed.replace(/__CODE_BLOCK_(\d+)__/g, (_, idx) => codeBlocks[parseInt(idx)]);

    return processed;
  }, [content, slug]);

  const handleSaveTable = () => {
    if (!tableEditData.originalString) return;

    const markdownTable = tableEditData.data.map((row, i) => {
      const line = `| ${row.join(' | ')} |`;
      if (i === 0) {
        const separator = `| ${row.map(() => '---').join(' | ')} |`;
        return `${line}\n${separator}`;
      }
      return line;
    }).join('\n');

    const newContent = content.replace(tableEditData.originalString, markdownTable);
    setContent(newContent);
    setTableEditData(prev => ({ ...prev, isOpen: false }));
    toast.success('Table updated');
  };

  const openTableEditorAtCursor = (forcedPos?: number) => {
    const view = codeMirrorRef.current?.view;
    if (!view) return;

    const { state } = view;
    const pos = forcedPos !== undefined ? forcedPos : state.selection.main.head;
    const line = state.doc.lineAt(pos);
    
    if (!line.text.includes('|')) {
      // If not in a table, just insert a template
      insertFormat('\n| Header | Header | Header |\n|--------|--------|--------|\n| Cell   | Cell   | Cell   |\n');
      return;
    }

    // Find table boundaries
    let startLine = line.number;
    while (startLine > 1 && state.doc.line(startLine - 1).text.includes('|')) {
      startLine--;
    }
    let endLine = line.number;
    while (endLine < state.doc.lines && state.doc.line(endLine + 1).text.includes('|')) {
      endLine++;
    }

    const tableText = state.doc.sliceString(state.doc.line(startLine).from, state.doc.line(endLine).to);
    
    // Parse
    const rows = tableText.split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.match(/^\|?(\s*:?---*:?\s*\|?)+\s*$/));
    
    const data = rows.map(row => {
      let cells = row.split('|');
      if (cells[0] === '') cells.shift();
      if (cells[cells.length - 1] === '') cells.pop();
      return cells.map(c => c.trim());
    });

    setTableEditData({
      data,
      originalString: tableText,
      isOpen: true
    });
  };

  const insertFormat = (prefix: string, suffix: string = '') => {
    if (isReadOnly) return;
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
    ".cm-content": {
      lineHeight: "1.6",
      padding: "10px 0"
    },
    ".cm-line": {
      padding: "0 8px"
    },
    ".cm-gutters": {
      backgroundColor: "transparent !important",
      borderRight: "1px solid var(--border)",
      color: "var(--muted-foreground)"
    },
    ".cm-activeLine, .cm-activeLineGutter": {
      backgroundColor: "var(--accent) !important",
      opacity: "0.5"
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
    html(),
    EditorView.lineWrapping,
    scrollPastEnd(),
    blockIconGutter,
    calloutHighlightPlugin,
    tableEditExtension((pos) => openTableEditorAtCursor(pos)),
    tableEditTheme,
    autocompleteExtensions(allTags, allMentions, allNotes),
    calloutTheme,
    transparentTheme,
    livePreviewExtension,
    livePreviewTheme
  ], [allTags, allMentions, allNotes, transparentTheme, openTableEditorAtCursor]);

  const BacklinksSection = () => {
    if (!initialBacklinks || initialBacklinks.length === 0) return null;
    return (
      <div className="mt-16 pt-8 border-t border-border no-print">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          {initialBacklinks.length} {initialBacklinks.length === 1 ? 'mention' : 'mentions'} in other notes
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {initialBacklinks.map((link) => (
            <Link
              key={link.slug}
              href={`/note/${link.slug}`}
              className="group block p-4 rounded-lg border border-border bg-accent/20 hover:bg-accent/40 transition-colors"
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

  const handleExportPdf = async () => {
    const title = decodeURIComponent(slug).split('/').pop()?.replace(/\.(md|excalidraw)$/i, '') || 'note';
    
    // Switch to read mode for better print layout if not already
    const wasReadOnly = isReadOnly;
    if (!wasReadOnly) setIsReadOnly(true);

    // Give it a moment to switch UI and render Excalidraw properly
    setTimeout(async () => {
      if (typeof window !== 'undefined' && (window as any).electron) {
        // Desktop: Use Electron API
        toast.info("Preparing PDF...");
        const success = await (window as any).electron.saveNoteAsPdf(title);
        if (success) {
          toast.success("PDF exported successfully");
        } else {
          toast.error("Failed to export PDF");
        }
      } else {
        // Web: Use browser print dialog
        window.print();
      }
      
      // Switch back if needed
      if (!wasReadOnly) setIsReadOnly(false);
    }, 1000);
  };

  const FormatButton = ({ onClick, icon: Icon, title }: { onClick: () => void, icon: any, title: string }) => (
    <button 
      disabled={isReadOnly}
      onClick={onClick} 
      className={cn(
        "p-1 rounded transition-all",
        isReadOnly 
          ? "opacity-20 cursor-not-allowed" 
          : "hover:bg-accent text-foreground active:scale-95"
      )}
      title={isReadOnly ? "Editor is in view mode" : title}
    >
      <Icon className="w-4 h-4" />
    </button>
  );

  const renderGraphContent = () => (
    <div className="w-full h-full flex flex-col p-4 gap-2 overflow-hidden">
      <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground px-2">Local Graph</div>
      <div className="flex-1 w-full rounded-xl overflow-hidden bg-transparent relative flex flex-col min-h-0">
        <MiniGraphView currentSlug={slug} currentContent={content} globalData={graphData} />
      </div>
    </div>
  );

  const renderTocContent = () => (
    <div className="w-full h-full flex flex-col p-4 gap-2 overflow-hidden">
      <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground px-2">Table of Contents</div>
      <div className="flex-1 rounded-xl bg-background/50 overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto p-4">
          {toc.length > 0 ? (
            <div className="space-y-1">
              {toc.map((heading, i) => (
                <button
                  key={i}
                  onClick={() => {
                    scrollToHeading(heading.line);
                    if (isCompact) setIsGraphOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-md transition-all hover:bg-accent group relative flex items-center gap-3 ${
                    heading.level === 1 ? 'text-foreground' : 'text-muted-foreground pl-8'
                  }`}
                >
                  <div className={`h-1 rounded-full transition-all group-hover:w-2 ${
                    heading.level === 1 ? 'w-1 bg-primary/40' : 'w-1 bg-border'
                  }`} />
                  <span className={`truncate ${heading.level === 1 ? 'text-xs font-bold' : 'text-[11px] font-medium'}`}>
                    {heading.text}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest italic">No headings found</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full w-full gap-2 md:gap-4 overflow-hidden">
      <ContentCard className="flex-1">
        <SidebarTriggerInternal />

        <div className="absolute top-3 right-3 z-50 flex items-center gap-2 no-print transition-all duration-300">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsGraphOpen(!isGraphOpen)}
            className={cn(
              "h-8 w-8 transition-all rounded-xl",
              isGraphOpen ? "bg-primary/20 text-primary opacity-100 shadow-[0_0_10px_rgba(var(--primary),0.2)]" : "text-foreground opacity-30 hover:opacity-100 hover:bg-accent"
            )}
            title={isGraphOpen ? "Hide Local Graph" : "Show Local Graph"}
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          {/* Fixed Toolbar Container */}
          <div className="flex-none flex flex-col items-center pt-4 z-30 mb-6 no-print">
            <div className="flex items-center gap-4 bg-popover/90 backdrop-blur-md border border-border p-1.5 rounded-full shadow-lg transition-all">
              {!isExcalidraw && (
                <div className="flex items-center gap-2 px-3 border-r border-border mr-1">
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
                {!isExcalidraw ? (
                  <>
                    <FormatButton onClick={() => insertFormat('# ')} icon={Heading1} title="Heading 1" />
                    <FormatButton onClick={() => insertFormat('## ')} icon={Heading2} title="Heading 2" />
                    <Separator orientation="vertical" className="mx-1 h-4 bg-border opacity-50" />
                    <FormatButton onClick={() => insertFormat('**', '**')} icon={Bold} title="Bold" />
                    <FormatButton onClick={() => insertFormat('*', '*')} icon={Italic} title="Italic" />
                    <Separator orientation="vertical" className="mx-1 h-4 bg-border opacity-50" />
                    <FormatButton onClick={() => insertFormat('- ')} icon={ListIcon} title="Bullet List" />
                    <FormatButton onClick={() => insertFormat('```\n', '\n```')} icon={Code} title="Code Block" />
                    <Separator orientation="vertical" className="mx-1 h-4 bg-border opacity-50" />
                    <FormatButton 
                      onClick={openTableEditorAtCursor} 
                      icon={TableIcon} 
                      title="Insert or Edit Table" 
                    />
                    <Separator orientation="vertical" className="mx-1 h-4 bg-border opacity-50" />
                  </>
                ) : (
                  <div className="px-3 text-[10px] uppercase tracking-widest font-bold opacity-50 select-none border-r border-border mr-2">
                    Excalidraw
                  </div>
                )}
                <button 
                  onClick={handleExportPdf}
                  className="p-1 hover:bg-accent rounded text-foreground active:scale-95 transition-all"
                  title="Export as PDF"
                >
                  <FileDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Scrollable Content Area */}
          <div className={cn(
            "flex-1 scroll-smooth print:overflow-visible",
            isExcalidraw ? "overflow-hidden h-full" : "overflow-y-auto"
          )}>
            <div className={cn(
              "mx-auto w-full print-content",
              isExcalidraw ? "max-w-none p-0 h-full" : "max-w-4xl px-6 py-12 pt-0"
            )}>
              <div className={cn("w-full relative", isExcalidraw ? "h-full" : "h-full")}>
                {isExcalidraw ? (
                  <ExcalidrawEditor key={slug} slug={slug} initialContent={initialContent} />
                ) : isReadOnly ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none print:prose-headings:text-black print:prose-p:text-black">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeRaw, rehypeKatex, rehypeSlug]}
                      components={{
                        p: ({ node, children, ...props }) => {
                          const textContent = node?.children
                            ? (node.children as any[]).map(c => c.value || (c.children ? c.children.map((cc: any) => cc.value).join('') : '')).join('')
                            : '';
                          
                          const calloutMatch = textContent.match(/^\[!(\w+)\]/);
                          if (calloutMatch) {
                            const type = calloutMatch[1].toLowerCase();
                            const colors: Record<string, { border: string, bg: string, text: string, ring: string }> = {
                              info: { border: 'border-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-400', ring: 'ring-blue-500/20' },
                              note: { border: 'border-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-400', ring: 'ring-blue-500/20' },
                              warning: { border: 'border-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-400', ring: 'ring-amber-500/20' },
                              danger: { border: 'border-red-500', bg: 'bg-red-500/10', text: 'text-red-400', ring: 'ring-red-500/20' },
                              error: { border: 'border-red-500', bg: 'bg-red-500/10', text: 'text-red-400', ring: 'ring-red-500/20' },
                              success: { border: 'border-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-400', ring: 'ring-emerald-500/20' },
                              tip: { border: 'border-purple-500', bg: 'bg-purple-500/10', text: 'text-purple-400', ring: 'ring-purple-500/20' },
                              todo: { border: 'border-cyan-500', bg: 'bg-cyan-500/10', text: 'text-cyan-400', ring: 'ring-cyan-500/20' },
                            };
                            const icons: Record<string, any> = {
                              info: <Info className="h-4 w-4 mr-2" />,
                              note: <Info className="h-4 w-4 mr-2" />,
                              warning: <AlertTriangle className="h-4 w-4 mr-2" />,
                              danger: <AlertCircle className="h-4 w-4 mr-2" />,
                              error: <AlertCircle className="h-4 w-4 mr-2" />,
                              success: <CheckCircle2 className="h-4 w-4 mr-2" />,
                              tip: <Plus className="h-4 w-4 mr-2" />,
                              todo: <CheckCircle2 className="h-4 w-4 mr-2" />,
                            };
                            const color = colors[type] || colors.info;

                            // Robustly remove [!type] from the children
                            const stripCalloutTag = (nodes: React.ReactNode): React.ReactNode => {
                              return React.Children.map(nodes, (child, i) => {
                                if (i !== 0) return child;
                                if (typeof child === 'string') {
                                  return child.replace(/^\[!\w+\]\s*/, '');
                                }
                                if (React.isValidElement(child) && (child.props as any).children) {
                                  return React.cloneElement(child, {
                                    children: stripCalloutTag((child.props as any).children)
                                  } as any);
                                }
                                return child;
                              });
                            };

                            return (
                              <div className={cn(
                                "my-6 border-l-4 p-4 rounded-r-xl shadow-lg ring-1",
                                color.border, color.bg, color.ring
                              )}>
                                <div className={cn("flex items-center font-black uppercase text-[11px] tracking-[0.2em] mb-3", color.text)}>
                                  {icons[type]}
                                  <span>{type}</span>
                                </div>
                                <div className="prose-p:m-0 text-[14px] text-foreground/90 leading-relaxed">
                                  {stripCalloutTag(children)}
                                </div>
                              </div>
                            );
                          }
                          return <p {...props}>{children}</p>;
                        },
                        input: ({ node, ...props }) => {
                          if (props.type === 'checkbox') {
                            return (
                              <input
                                type="checkbox"
                                checked={props.checked}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer transition-all mr-2"
                                onChange={(e) => {
                                  // Find this checkbox in the source text and toggle it
                                  const isChecked = e.target.checked;
                                  
                                  // We need to find which checkbox this is in the UI
                                  // This is a bit tricky with ReactMarkdown, so we find all checkboxes
                                  const checkboxes = document.querySelectorAll('.prose input[type="checkbox"]');
                                  const index = Array.from(checkboxes).indexOf(e.target as HTMLInputElement);
                                  
                                  if (index !== -1) {
                                    let count = 0;
                                    const newContent = content.replace(/^(\s*[-*+]\s+\[)([ xX])(\].*)$/gm, (match, p1, p2, p3) => {
                                      if (count === index) {
                                        count++;
                                        return p1 + (isChecked ? 'x' : ' ') + p3;
                                      }
                                      count++;
                                      return match;
                                    });
                                    setContent(newContent);
                                  }
                                }}
                              />
                            );
                          }
                          return <input {...props} />;
                        },
                        table: ({ node, children, ...props }) => {
                          return (
                            <div className="relative group/table mb-6">
                              <div className="overflow-x-auto">
                                <table className="w-full border-collapse" {...props}>
                                  {children}
                                </table>
                              </div>
                              <Button
                                size="sm"
                                variant="secondary"
                                className="absolute -top-3 -right-3 h-7 px-2 text-[10px] opacity-0 group-hover/table:opacity-100 transition-opacity shadow-lg"
                                onClick={() => {
                                  // Extract table data from the DOM or original content
                                  // Finding the exact table in content is hard by index, 
                                  // but we can search for the markdown block.
                                  const tableRows: string[][] = [];
                                  const rows = (node as any).children.filter((c: any) => c.type === 'element' && (c.tagName === 'thead' || c.tagName === 'tbody'));
                                  
                                  rows.forEach((rowGroup: any) => {
                                    rowGroup.children.forEach((tr: any) => {
                                      if (tr.type === 'element' && tr.tagName === 'tr') {
                                        const cells: string[] = [];
                                        tr.children.forEach((td: any) => {
                                          if (td.type === 'element' && (td.tagName === 'td' || td.tagName === 'th')) {
                                            // Extract text content recursively
                                            const getText = (n: any): string => {
                                              if (n.type === 'text') return n.value;
                                              if (n.children) return n.children.map(getText).join('');
                                              return '';
                                            };
                                            cells.push(getText(td).trim());
                                          }
                                        });
                                        if (cells.length > 0) tableRows.push(cells);
                                      }
                                    });
                                  });

                                  // Simple heuristic to find this table in original content
                                  // This works best if tables are unique or we use the first match
                                  const tableRegex = /\|(.+)\|[\s\S]+?\|(.+)\|/g;
                                  let match;
                                  let bestMatch = '';
                                  while ((match = tableRegex.exec(content)) !== null) {
                                    // Check if this match contains the first row of our table
                                    if (tableRows[0] && match[0].includes(tableRows[0][0])) {
                                      bestMatch = match[0];
                                      break;
                                    }
                                  }

                                  setTableEditData({
                                    data: tableRows,
                                    originalString: bestMatch || '',
                                    isOpen: true
                                  });
                                }}
                              >
                                <TableIcon className="h-3 w-3 mr-1" /> Edit Table
                              </Button>
                            </div>
                          );
                        },
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
                        text: ({ node, children, ...props }) => {
                          // Handle Hashtags and Mentions during text rendering
                          if (typeof children === 'string') {
                            const segments = children.split(/((?:^|\s)#\w+|(?:^|\s)@\w+)/g);
                            return (
                              <>
                                {segments.map((segment, i) => {
                                  if (segment.match(/(^|\s)#\w+/)) {
                                    return (
                                      <span key={i} className="inline-flex items-center rounded-full bg-primary/20 px-2 py-0.5 text-[11px] font-bold text-primary ring-1 ring-inset ring-primary/30 mx-0.5">
                                        {segment.trim()}
                                      </span>
                                    );
                                  }
                                  if (segment.match(/(^|\s)@\w+/)) {
                                    return (
                                      <span key={i} className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-500 ring-1 ring-inset ring-amber-500/30 mx-0.5">
                                        {segment.trim()}
                                      </span>
                                    );
                                  }
                                  return segment;
                                })}
                              </>
                            );
                          }
                          return children;
                        },
                        blockquote: ({ node, children, ...props }) => {
                          // Standard blockquote styling, callouts are now handled in paragraph component for better compatibility
                          return <blockquote className="border-l-4 border-muted/30 pl-4 italic my-6 text-muted-foreground" {...props}>{children}</blockquote>;
                        },
                        code: ({ node, className, children, ...props }) => {
                          const match = /language-(\w+)/.exec(className || '');
                          const lang = match ? match[1] : 'text';

                          if (lang === 'mermaid') {
                            return <Mermaid chart={String(children).replace(/\n$/, '')} />;
                          }

                          const isBlock = match || String(children).includes('\n');
                          return isBlock ? (
                            <div className="relative group">
                              <SyntaxHighlighter
                                style={vscDarkPlus as any}
                                language={lang}
                                PreTag="div"
                                customStyle={{ backgroundColor: 'transparent', padding: 0, margin: '1em 0' }}
                                className="!bg-transparent text-[13px] no-print"
                              >
                                {String(children).replace(/\n$/, '')}
                              </SyntaxHighlighter>
                              <SyntaxHighlighter
                                style={prism as any}
                                language={lang}
                                PreTag="div"
                                customStyle={{ 
                                  backgroundColor: '#f8f9fa', 
                                  padding: '12px', 
                                  margin: '1em 0', 
                                  border: '1px solid #e1e4e8',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  lineHeight: '1.5'
                                }}
                                className="hidden print:block"
                              >
                                {String(children).replace(/\n$/, '')}
                              </SyntaxHighlighter>
                            </div>
                          ) : (
                            <code className="bg-white/10 px-1.5 py-0.5 rounded-md text-[0.9em] font-mono text-primary/90 print:bg-[#f3f4f6] print:text-[#eb5757] print:border print:border-[#e1e4e8] print:px-1 print:py-0" {...props}>
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
                      className="h-full text-base"
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
      </ContentCard>

      {/* Side Panel (Graph + ToC) - Separate Cards or Flying Modal */}
      {isGraphOpen && (
        isCompact ? (
          <Dialog open={isGraphOpen} onOpenChange={setIsGraphOpen}>
            <DialogContent className="sm:max-w-[600px] h-[80vh] p-4 bg-background border-border overflow-hidden flex flex-col gap-4">
              <DialogHeader className="sr-only">
                <DialogTitle>Graph and Table of Contents</DialogTitle>
                <DialogDescription>View local graph and table of contents for this note.</DialogDescription>
              </DialogHeader>
              <div className="flex-[0.4] min-h-0 bg-accent/20 rounded-2xl overflow-hidden">
                {renderGraphContent()}
              </div>
              <div className="flex-[0.6] min-h-0 bg-accent/20 rounded-2xl overflow-hidden">
                {renderTocContent()}
              </div>
            </DialogContent>
          </Dialog>
        ) : (
          <div className="w-[400px] flex-none flex flex-col gap-4 overflow-hidden">
            <ContentCard className="flex-[0.4] min-h-0">
              {renderGraphContent()}
            </ContentCard>
            <ContentCard className="flex-[0.6] min-h-0">
              {renderTocContent()}
            </ContentCard>
          </div>
        )
      )}

      {/* Table Editor Dialog */}
      <Dialog 
        open={tableEditData.isOpen} 
        onOpenChange={(open) => !open && setTableEditData(prev => ({ ...prev, isOpen: false }))}
      >
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col bg-popover border-border">
          <DialogHeader className="px-1">
            <DialogTitle className="text-xl">Edit Table</DialogTitle>
            <DialogDescription>Modify table cells, add or remove rows and columns.</DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto p-1 mt-4">
            <div className="inline-block min-w-full align-middle">
              <table className="min-w-full border-collapse border border-border">
                <tbody>
                  {tableEditData.data.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, colIndex) => (
                        <td key={colIndex} className="border border-border p-0">
                          <input
                            value={cell}
                            onChange={(e) => {
                              const newData = [...tableEditData.data];
                              newData[rowIndex][colIndex] = e.target.value;
                              setTableEditData(prev => ({ ...prev, data: newData }));
                            }}
                            className="w-full px-3 py-2 bg-transparent text-sm focus:bg-accent outline-none min-w-[120px]"
                          />
                        </td>
                      ))}
                      <td className="border-none p-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive opacity-30 hover:opacity-100"
                          onClick={() => {
                            const newData = tableEditData.data.filter((_, i) => i !== rowIndex);
                            setTableEditData(prev => ({ ...prev, data: newData }));
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                const newRow = Array(tableEditData.data[0]?.length || 1).fill('');
                setTableEditData(prev => ({ ...prev, data: [...prev.data, newRow] }));
              }}
            >
              <Plus className="h-3 w-3 mr-2" /> Add Row
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                const newData = tableEditData.data.map(row => [...row, '']);
                setTableEditData(prev => ({ ...prev, data: newData }));
              }}
            >
              <Plus className="h-3 w-3 mr-2" /> Add Column
            </Button>
            <div className="flex-1" />
            <Button variant="ghost" onClick={() => setTableEditData(prev => ({ ...prev, isOpen: false }))}>
              Cancel
            </Button>
            <Button onClick={handleSaveTable}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
