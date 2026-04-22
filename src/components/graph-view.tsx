'use client';

import React, { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
});

interface Node {
  id: string;
  title: string;
  type: 'note' | 'tag';
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
  const [mounted, setMounted] = useState(false);
  const [filter, setFilter] = useState('');
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const filteredData = useMemo(() => {
    if (!filter) return data;
    
    const lowerFilter = filter.toLowerCase();
    const filteredNodes = data.nodes.filter(node => 
      node.title.toLowerCase().includes(lowerFilter)
    );
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredLinks = data.links.filter(link => 
      nodeIds.has(typeof link.source === 'string' ? link.source : (link.source as any).id) && 
      nodeIds.has(typeof link.target === 'string' ? link.target : (link.target as any).id)
    );

    return { nodes: filteredNodes, links: filteredLinks };
  }, [data, filter]);

  if (!mounted) return null;

  return (
    <div className="w-full h-[calc(100vh-140px)] bg-[#050505] rounded-xl overflow-hidden border border-white/5 relative flex flex-col">
      {/* Local Filter Bar */}
      <div className="absolute top-4 left-4 z-10 w-64 group">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-white/30" />
          <Input
            placeholder="Filter graph..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-9 pl-8 bg-[#0f0f0f]/80 backdrop-blur-md border-white/10 text-[12px] focus-visible:ring-white/20 rounded-full"
          />
        </div>
      </div>

      <div className="flex-1">
        <ForceGraph2D
          graphData={filteredData}
          nodeLabel="title"
          backgroundColor="#050505"
          linkColor={() => 'rgba(255, 255, 255, 0.15)'}
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
            ctx.arc(node.x, node.y, node.type === 'tag' ? 3 : 4, 0, 2 * Math.PI, false);
            ctx.fillStyle = node.type === 'tag' ? '#a855f7' : '#3b82f6';
            ctx.fill();
            
            // Add a glow effect
            ctx.shadowBlur = 15;
            ctx.shadowColor = node.type === 'tag' ? 'rgba(168, 85, 247, 0.4)' : 'rgba(59, 130, 246, 0.4)';

            // Draw label text (only if zoom is high enough)
            if (globalScale > 1.5 || filter) {
              ctx.shadowBlur = 0;
              ctx.fillStyle = 'rgba(15, 15, 15, 0.9)';
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
              ctx.fillStyle = node.type === 'tag' ? '#d8b4fe' : 'rgba(255, 255, 255, 0.8)';
              ctx.fillText(label, node.x, node.y + 7);
            }
          }}
        />
      </div>

      <div className="absolute bottom-4 right-4 flex gap-4 pointer-events-none">
        <div className="flex items-center gap-2 text-[10px] text-white/30 uppercase tracking-widest font-bold bg-[#0f0f0f]/50 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/5">
          <div className="w-2 h-2 rounded-full bg-[#3b82f6]" /> Note
        </div>
        <div className="flex items-center gap-2 text-[10px] text-white/30 uppercase tracking-widest font-bold bg-[#0f0f0f]/50 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/5">
          <div className="w-2 h-2 rounded-full bg-[#a855f7]" /> Tag
        </div>
      </div>
    </div>
  );
}
