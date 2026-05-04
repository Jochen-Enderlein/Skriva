'use client';

import React, { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useTheme } from 'next-themes';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
});

interface Node {
  id: string;
  title: string;
  type: 'note' | 'tag' | 'mention' | 'project';
  x?: number;
  y?: number;
}

interface Link {
  source: string;
  target: string;
}

interface GraphData {
  nodes: Node[];
  links: Link[];
}

interface GraphViewProps {
  data: GraphData;
}

export function GraphView({ data }: GraphViewProps) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [filter, setFilter] = useState('');
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const filteredData = useMemo(() => {
    if (!filter) return data;
    
    const lowerFilter = filter.toLowerCase();
    
    // 1. Find nodes that directly match the filter
    const directMatchNodes = data.nodes.filter(node => 
      node.title.toLowerCase().includes(lowerFilter)
    );
    
    const directMatchIds = new Set(directMatchNodes.map(n => n.id));
    const finalNodeIds = new Set(directMatchIds);
    const finalLinks: Link[] = [];

    // 2. Find links connected to direct matches and collect neighbor IDs
    data.links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id;
      const targetId = typeof link.target === 'string' ? link.target : (link.target as any).id;
      
      if (directMatchIds.has(sourceId) || directMatchIds.has(targetId)) {
        finalLinks.push(link);
        finalNodeIds.add(sourceId);
        finalNodeIds.add(targetId);
      }
    });

    // 3. Filter the full node list to get our expanded set
    const finalNodes = data.nodes.filter(node => finalNodeIds.has(node.id));

    return { nodes: finalNodes, links: finalLinks };
  }, [data, filter]);

  if (!mounted) return null;

  const isDark = resolvedTheme === 'dark';

  return (
    <div className="w-full flex-1 h-[calc(100vh-140px)] bg-transparent  overflow-hidden relative flex flex-col">
      {/* Local Filter Bar */}
      <div className="absolute top-4 left-4 z-10 w-64 group">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/60" />
          <Input
            placeholder="Filter graph..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-9 pl-8 bg-background/80 backdrop-blur-md border-border text-[12px] focus-visible:ring-ring rounded-full"
          />
        </div>
      </div>

      <div className="flex-1 w-full">
        <ForceGraph2D
          graphData={filteredData}
          nodeLabel="title"
          backgroundColor={isDark ? '#050505' : '#ffffff'}
          linkColor={() => isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'}
          linkWidth={1.5}
          nodeRelSize={6}
          onNodeClick={(node: any) => {
            if (node.type === 'note') {
              router.push(`/note/${node.id}`);
            } else {
              setFilter(node.title.replace('#', ''));
            }
          }}
          nodeCanvasObject={(node: any, ctx, globalScale) => {
            const label = node.title;
            const fontSize = 12 / globalScale;
            ctx.font = `${fontSize}px Inter`;
            const textWidth = ctx.measureText(label).width;
            const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.4);

            // Draw node circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.type === 'note' ? 4 : 3, 0, 2 * Math.PI, false);
            
            const colors: Record<string, string> = {
              tag: '#a855f7',
              mention: '#f59e0b',
              project: '#10b981',
              note: '#3b82f6'
            };
            
            ctx.fillStyle = colors[node.type] || colors.note;
            ctx.fill();
            
            // Add a glow effect
            ctx.shadowBlur = isDark ? 15 : 5;
            const glowColors: Record<string, string> = {
              tag: 'rgba(168, 85, 247, 0.4)',
              mention: 'rgba(245, 158, 11, 0.4)',
              project: 'rgba(16, 185, 129, 0.4)',
              note: 'rgba(59, 130, 246, 0.4)'
            };
            ctx.shadowColor = glowColors[node.type] || glowColors.note;

            // Draw label text (only if zoom is high enough)
            if (globalScale > 1.5 || filter) {
              ctx.shadowBlur = 0;
              ctx.fillStyle = isDark ? 'rgba(15, 15, 15, 0.9)' : 'rgba(255, 255, 255, 0.95)';
              ctx.roundRect(
                node.x - bckgDimensions[0] / 2, 
                node.y + 6, 
                bckgDimensions[0] as number, 
                bckgDimensions[1] as number,
                4
              );
              ctx.fill();

              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';
              
              const textColors: Record<string, string> = {
                tag: '#a855f7',
                mention: '#f59e0b',
                project: '#10b981'
              };
              
              ctx.fillStyle = textColors[node.type] || (isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)');
              ctx.fillText(label, node.x, node.y + 7);
            }
          }}
        />
      </div>

      <div className="absolute bottom-4 right-4 flex gap-4 pointer-events-none flex-wrap max-w-[calc(100%-2rem)] justify-end">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-widest font-bold bg-background/50 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border">
          <div className="w-2 h-2 rounded-full bg-[#3b82f6]" /> Note
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-widest font-bold bg-background/50 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border">
          <div className="w-2 h-2 rounded-full bg-[#10b981]" /> Project
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-widest font-bold bg-background/50 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border">
          <div className="w-2 h-2 rounded-full bg-[#a855f7]" /> Tag
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-widest font-bold bg-background/50 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border">
          <div className="w-2 h-2 rounded-full bg-[#f59e0b]" /> Mention
        </div>
      </div>
    </div>
  );
}
