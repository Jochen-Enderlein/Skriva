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
  Share2,
  FileDown
} from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, prism } from 'react-syntax-highlighter/dist/esm/styles/prism';

import { ExcalidrawEditor } from './excalidraw-editor';
import { ExcalidrawEmbed } from './excalidraw-embed';

import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { EditorView } from '@codemirror/view';
import { blockIconGutter, autocompleteExtensions } from '@/lib/editor/cm-extensions';
import { MiniGraphView } from './mini-graph-view';
import { cn } from '@/lib/utils';
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useMediaQuery } from "@/hooks/use-media-query";
import { ContentCard } from "./content-card";
import { SidebarTriggerInternal } from "./sidebar-trigger-internal";

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

    // Process Mentions into Chips
    processed = processed.replace(/(^|\s)@([a-zA-Z0-9_]+)/g, '$1<span class="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-600 ring-1 ring-inset ring-amber-500/30 cursor-pointer hover:bg-amber-500/30 transition-colors mx-1 mb-1">@$2</span>');

    // Restore inline code
    processed = processed.replace(/__INLINE_CODE_(\d+)__/g, (_, idx) => inlineCode[parseInt(idx)]);
    // Restore code blocks
    processed = processed.replace(/__CODE_BLOCK_(\d+)__/g, (_, idx) => codeBlocks[parseInt(idx)]);

    return processed;
  }, [content, slug]);

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
    EditorView.lineWrapping,
    blockIconGutter,
    autocompleteExtensions(allTags, allMentions, allNotes),
    transparentTheme
  ], [allTags, allMentions, allNotes, transparentTheme]);

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
    }, 500);
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

  const renderSidePanelContent = () => (
    <div className="w-full bg-transparent h-full flex flex-col p-4 gap-4 overflow-hidden">
      {/* Top Section: Local Graph */}
      <div className="flex-[0.4] min-h-0 flex flex-col gap-2">
        <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground px-2">Local Graph</div>
        <div className="flex-1 w-full rounded-xl overflow-hidden bg-transparent">
          <MiniGraphView currentSlug={slug} currentContent={content} globalData={graphData} />
        </div>
      </div>

      {/* Bottom Section: Table of Contents */}
      <div className="flex-[0.6] min-h-0 flex flex-col gap-2">
        <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground px-2">Table of Contents</div>
        <div className="flex-1 rounded-xl bg-background/50 overflow-hidden flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
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
            <div className="flex items-center gap-4 bg-popover/80 backdrop-blur-xl border border-border p-1.5 rounded-full shadow-2xl transition-all">
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
                      onClick={() => insertFormat('\n| Header | Header | Header |\n|--------|--------|--------|\n| Cell   | Cell   | Cell   |\n')} 
                      icon={TableIcon} 
                      title="Insert Table" 
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
          <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth print:overflow-visible">
            <div className={`mx-auto w-full print-content ${isExcalidraw ? 'max-w-none px-4 pb-4 print:p-0' : 'max-w-4xl px-6 py-12 pt-0 print:p-0'}`}>
              <div className="w-full h-full relative">
                {isExcalidraw ? (
                  <ExcalidrawEditor key={slug} slug={slug} initialContent={initialContent} />
                ) : isReadOnly ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none print:prose-headings:text-black print:prose-p:text-black">
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
                            <div className="relative group">
                              <SyntaxHighlighter
                                style={vscDarkPlus as any}
                                language={match ? match[1] : 'typescript'}
                                PreTag="div"
                                customStyle={{ backgroundColor: 'transparent', padding: 0, margin: '1em 0' }}
                                className="!bg-transparent text-[13px] no-print"
                              >
                                {String(children).replace(/\n$/, '')}
                              </SyntaxHighlighter>
                              <SyntaxHighlighter
                                style={prism as any}
                                language={match ? match[1] : 'typescript'}
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
      </ContentCard>

      {/* Side Panel (Graph + ToC) - Separate Card or Flying Modal */}
      {isGraphOpen && (
        isCompact ? (
          <Dialog open={isGraphOpen} onOpenChange={setIsGraphOpen}>
            <DialogContent className="sm:max-w-[600px] h-[80vh] p-0 bg-background border-border overflow-hidden flex flex-col">
              <DialogHeader className="sr-only">
                <DialogTitle>Graph and Table of Contents</DialogTitle>
                <DialogDescription>View local graph and table of contents for this note.</DialogDescription>
              </DialogHeader>
              {renderSidePanelContent()}
            </DialogContent>
          </Dialog>
        ) : (
          <ContentCard className="w-[400px] flex-none">
            {renderSidePanelContent()}
          </ContentCard>
        )
      )}
    </div>
  );
}
