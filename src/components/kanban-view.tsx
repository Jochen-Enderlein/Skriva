'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { NoteMetadata } from '@/lib/notes';
import { cn } from '@/lib/utils';
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  useDroppable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import matter from 'gray-matter';
import { ChevronLeft, ChevronRight, Palette, Circle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

interface KanbanViewProps {
  content: string;
  allNotes: NoteMetadata[];
  onContentChange?: (newContent: string) => void;
}

interface KanbanCard {
  id: string;
  display: string;
  target: string;
  slug: string;
}

interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
  color?: string;
  isCollapsed?: boolean;
}

const KANBAN_COLORS = [
  { name: 'default', class: 'border-border/40 bg-accent/5', text: 'text-muted-foreground' },
  { name: 'red', class: 'border-red-500/40 bg-red-500/5', text: 'text-red-500' },
  { name: 'orange', class: 'border-orange-500/40 bg-orange-500/5', text: 'text-orange-500' },
  { name: 'yellow', class: 'border-yellow-500/40 bg-yellow-500/5', text: 'text-yellow-500' },
  { name: 'green', class: 'border-emerald-500/40 bg-emerald-500/5', text: 'text-emerald-500' },
  { name: 'blue', class: 'border-blue-500/40 bg-blue-500/5', text: 'text-blue-500' },
  { name: 'purple', class: 'border-purple-500/40 bg-purple-500/5', text: 'text-purple-500' },
  { name: 'pink', class: 'border-pink-500/40 bg-pink-500/5', text: 'text-pink-500' },
];

function SortableCard({ card, isOverlay = false }: { card: KanbanCard, isOverlay?: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      className={cn(
        "rounded-lg border border-border/50 bg-background p-3 shadow-sm transition-colors group cursor-grab active:cursor-grabbing",
        isOverlay ? "border-primary shadow-xl bg-background scale-105 z-[1000] ring-2 ring-primary/20" : "hover:border-primary/50"
      )}
    >
      <Link href={card.slug} className="block" onClick={(e) => {
        if (isDragging) e.preventDefault();
      }}>
        <p className="text-sm font-medium whitespace-normal leading-relaxed group-hover:text-primary transition-colors">
          {card.display}
        </p>
      </Link>
    </div>
  );
}

function DroppableColumn({ 
  column, 
  children, 
  onToggleCollapse, 
  onSetColor 
}: { 
  column: KanbanColumn, 
  children: React.ReactNode,
  onToggleCollapse: () => void,
  onSetColor: (color: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    disabled: column.isCollapsed
  });

  const colorConfig = KANBAN_COLORS.find(c => c.name === column.color) || KANBAN_COLORS[0];

  return (
    <div 
      ref={setNodeRef}
      className={cn(
        "flex flex-col shrink-0 rounded-2xl border transition-all duration-300 h-full max-h-full shadow-sm overflow-hidden group/column",
        column.isCollapsed ? "w-12" : "w-80",
        isOver ? "border-primary/40 ring-2 ring-primary/10" : colorConfig.class
      )}
    >
      <div className={cn(
        "p-4 border-b border-border/20 flex items-center justify-between shrink-0 bg-accent/5",
        column.isCollapsed && "flex-col h-full border-b-0 p-2"
      )}>
        {column.isCollapsed ? (
          <>
            <button 
              onClick={onToggleCollapse}
              className="p-1 rounded hover:bg-accent/20 text-muted-foreground transition-colors mb-4"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="flex-1 flex items-center justify-center">
              <h3 
                className="font-black uppercase tracking-[0.2em] text-[10px] text-muted-foreground/70 whitespace-nowrap"
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
              >
                {column.title}
              </h3>
            </div>
            <div className="mt-4 px-1.5 py-0.5 rounded-full bg-accent/10 text-[9px] font-bold text-muted-foreground/50">
              {column.cards.length}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 overflow-hidden mr-2">
              <h3 className={cn("font-black uppercase tracking-[0.2em] text-[10px] truncate", colorConfig.text)}>
                {column.title}
              </h3>
              <span className="shrink-0 px-2 py-0.5 rounded-full bg-accent/10 text-[9px] font-bold text-muted-foreground/50">
                {column.cards.length}
              </span>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover/column:opacity-100 transition-opacity">
              <Popover>
                <PopoverTrigger asChild>
                  <button className="p-1 rounded hover:bg-accent/20 text-muted-foreground transition-colors">
                    <Palette className="h-3.5 w-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-40 p-2" align="end">
                  <div className="grid grid-cols-4 gap-1">
                    {KANBAN_COLORS.map((c) => (
                      <button
                        key={c.name}
                        onClick={() => onSetColor(c.name)}
                        className={cn(
                          "h-6 w-6 rounded-full border border-border/50 flex items-center justify-center transition-transform hover:scale-110",
                          c.class,
                          column.color === c.name && "ring-2 ring-primary ring-offset-1 ring-offset-background"
                        )}
                        title={c.name}
                      >
                        {column.color === c.name && <Circle className="h-2 w-2 fill-current" />}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <button 
                onClick={onToggleCollapse}
                className="p-1 rounded hover:bg-accent/20 text-muted-foreground transition-colors"
                title="Collapse Column"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        )}
      </div>
      {!column.isCollapsed && children}
    </div>
  );
}

export function KanbanView({ content, allNotes, onContentChange }: KanbanViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  
  const isInternalUpdate = useRef(false);
  const lastProcessedContent = useRef("");

  const parseMarkdown = useCallback((md: string) => {
    try {
      const { content: body } = matter(md);
      const lines = body.split('\n');
      const newColumns: KanbanColumn[] = [];
      let currentColumn: KanbanColumn | null = null;
      let colIdx = 0;

      lines.forEach((line) => {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('## ')) {
          const titleLine = trimmedLine.replace(/^##\s+/, '').trim();
          
          // Extract metadata from title: ## Title [color] [collapsed]
          const colorMatch = titleLine.match(/\[(red|orange|yellow|green|blue|purple|pink|gray|default)\]/);
          const collapsedMatch = titleLine.match(/\[collapsed\]/);
          const cleanTitle = titleLine
            .replace(/\[(red|orange|yellow|green|blue|purple|pink|gray|default)\]/, '')
            .replace(/\[collapsed\]/, '')
            .trim();

          currentColumn = {
            id: `col-${colIdx++}`,
            title: cleanTitle,
            color: colorMatch ? colorMatch[1] : 'default',
            isCollapsed: !!collapsedMatch,
            cards: []
          };
          newColumns.push(currentColumn);
        } else if (currentColumn) {
          const wikiLinkRegex = /\[\[(.*?)\]\]/g;
          let match;
          while ((match = wikiLinkRegex.exec(line)) !== null) {
            const p1 = match[1];
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
              hashTarget = target.substring(specialIndex);
            }

            const targetNote = allNotes.find(n => n.title === baseTarget || n.slug === baseTarget);
            const slug = targetNote ? targetNote.slug : baseTarget;
            
            currentColumn.cards.push({
              id: `card-${p1}-${newColumns.length}-${currentColumn.cards.length}`,
              display,
              target: p1,
              slug: `/note/${encodeURIComponent(slug)}${hashTarget}`
            });
          }
        }
      });
      return newColumns;
    } catch (e) {
      console.error("Kanban parse error:", e);
      return [];
    }
  }, [allNotes]);

  useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    if (content !== lastProcessedContent.current) {
      setColumns(parseMarkdown(content));
      lastProcessedContent.current = content;
    }
  }, [content, parseMarkdown]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const findColumn = useCallback((id: string, cols: KanbanColumn[]) => {
    if (cols.some(col => col.id === id)) return cols.find(col => col.id === id);
    return cols.find(col => col.cards.some(card => card.id === id));
  }, []);

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragOver = (event: any) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    const activeCol = findColumn(activeId, columns);
    const overCol = findColumn(overId, columns);

    if (!activeCol || !overCol || activeCol.id === overCol.id) return;
    if (overCol.isCollapsed) return; // Don't drop on collapsed columns

    setColumns(prev => {
      const activeCol = findColumn(activeId, prev);
      const overCol = findColumn(overId, prev);
      if (!activeCol || !overCol) return prev;

      const activeIndex = activeCol.cards.findIndex(c => c.id === activeId);
      const activeItem = activeCol.cards[activeIndex];
      if (!activeItem) return prev;

      const overIndex = overCol.id === overId 
        ? overCol.cards.length 
        : overCol.cards.findIndex(c => c.id === overId);

      return prev.map(col => {
        if (col.id === activeCol.id) {
          return { ...col, cards: col.cards.filter(c => c.id !== activeId) };
        }
        if (col.id === overCol.id) {
          const newCards = [...col.cards];
          newCards.splice(overIndex >= 0 ? overIndex : newCards.length, 0, activeItem);
          return { ...col, cards: newCards };
        }
        return col;
      });
    });
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    const activeCol = findColumn(activeId, columns);
    const overCol = findColumn(overId, columns);

    if (activeCol && overCol && activeCol.id === overCol.id) {
      const activeIndex = activeCol.cards.findIndex(c => c.id === activeId);
      const overIndex = overCol.cards.findIndex(c => c.id === overId);

      if (activeIndex !== overIndex) {
        const newCols = columns.map(col => {
          if (col.id === activeCol.id) {
            return { ...col, cards: arrayMove(col.cards, activeIndex, overIndex) };
          }
          return col;
        });
        setColumns(newCols);
        updateMarkdown(newCols);
      }
    } else {
      updateMarkdown(columns);
    }
  };

  const updateMarkdown = (newColumns: KanbanColumn[]) => {
    if (!onContentChange) return;

    const { data, content: body } = matter(content);
    const firstH2Index = body.search(/\n## |^## /);
    let newBody = firstH2Index !== -1 ? body.substring(0, firstH2Index).trim() : "";
    
    newColumns.forEach(col => {
      let titleSuffix = "";
      if (col.color && col.color !== 'default') titleSuffix += ` [${col.color}]`;
      if (col.isCollapsed) titleSuffix += ` [collapsed]`;
      
      newBody += (newBody ? "\n\n" : "") + `## ${col.title}${titleSuffix}`;
      col.cards.forEach(card => {
        newBody += `\n[[${card.target}]]`;
      });
    });

    const newContent = matter.stringify(newBody + "\n", data);
    isInternalUpdate.current = true;
    lastProcessedContent.current = newContent;
    onContentChange(newContent);
  };

  const handleToggleCollapse = (colId: string) => {
    const newCols = columns.map(col => 
      col.id === colId ? { ...col, isCollapsed: !col.isCollapsed } : col
    );
    setColumns(newCols);
    updateMarkdown(newCols);
  };

  const handleSetColor = (colId: string, color: string) => {
    const newCols = columns.map(col => 
      col.id === colId ? { ...col, color } : col
    );
    setColumns(newCols);
    updateMarkdown(newCols);
  };

  const activeCard = useMemo(() => 
    activeId ? columns.flatMap(c => c.cards).find(c => c.id === activeId) : null
  , [activeId, columns]);

  return (
    <div className="absolute inset-0 flex flex-col bg-background z-[100] overflow-hidden">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 scrollbar-thin scrollbar-thumb-primary/20">
          <div className="flex h-full gap-4 items-start min-w-full">
            {columns.map((column) => (
              <DroppableColumn 
                key={column.id} 
                column={column}
                onToggleCollapse={() => handleToggleCollapse(column.id)}
                onSetColor={(color) => handleSetColor(column.id, color)}
              >
                <SortableContext
                  id={column.id}
                  items={column.cards.map(c => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[150px] scrollbar-none bg-accent/5">
                    {column.cards.map((card) => (
                      <SortableCard key={card.id} card={card} />
                    ))}
                    {column.cards.length === 0 && (
                      <div className="py-12 text-center border-2 border-dashed border-border/10 rounded-xl bg-accent/5">
                        <span className="text-[9px] uppercase tracking-widest text-muted-foreground/30 font-bold italic">Empty</span>
                      </div>
                    )}
                  </div>
                </SortableContext>
              </DroppableColumn>
            ))}
            {columns.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center p-20 text-muted-foreground italic border-2 border-dashed border-border/20 rounded-3xl m-4 bg-accent/5">
                <div className="text-sm font-bold mb-2 text-primary/50 tracking-tighter uppercase">Kanban</div>
                <div className="text-xs opacity-50 text-center">No columns found.<br/>Use ## Headers to define columns.</div>
              </div>
            )}
          </div>
        </div>
        <DragOverlay zIndex={20000}>
          {activeCard ? <SortableCard card={activeCard} isOverlay /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
