'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useTheme } from 'next-themes';
import SpriteText from 'three-spritetext';
import * as THREE from 'three';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
});

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), {
  ssr: false,
});

interface Node {
  id: string;
  title: string;
  type: 'note' | 'tag' | 'mention' | 'project';
  createdAt?: string;
  x?: number;
  y?: number;
  z?: number;
  fx?: number;
  fy?: number;
  fz?: number;
}

interface Link {
  source: string | { id: string };
  target: string | { id: string };
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
  const fgRef = useRef<any>();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [filter, setFilter] = useState('');
  const [is3D, setIs3D] = useState(false); // Default to 2D for safety
  const [webglAvailable, setWebglAvailable] = useState(true);
  
  useEffect(() => {
    setMounted(true);
    
    // Check for WebGL support
    try {
      const canvas = document.createElement('canvas');
      const support = !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
      setWebglAvailable(support);
      if (support) {
        setIs3D(true); // Auto-enable 3D only if supported
      }
    } catch (e) {
      setWebglAvailable(false);
    }
  }, []);

  const { processedData, zRange, dateLabels } = useMemo(() => {
    // 1. Filter data
    let nodes = data.nodes;
    let links = data.links;

    if (filter) {
      const lowerFilter = filter.toLowerCase();
      const directMatchNodes = data.nodes.filter(node => 
        node.title.toLowerCase().includes(lowerFilter)
      );
      
      const directMatchIds = new Set(directMatchNodes.map(n => n.id));
      const finalNodeIds = new Set(directMatchIds);
      const finalLinks: Link[] = [];

      data.links.forEach(link => {
        const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id;
        const targetId = typeof link.target === 'string' ? link.target : (link.target as any).id;
        
        if (directMatchIds.has(sourceId) || directMatchIds.has(targetId)) {
          finalLinks.push(link);
          finalNodeIds.add(sourceId);
          finalNodeIds.add(targetId);
        }
      });

      nodes = data.nodes.filter(node => finalNodeIds.has(node.id));
      links = finalLinks;
    }

    // 2. Prepare 3D coordinates if needed
    let minZ = -200;
    let maxZ = 200;
    let minDateStr = '';
    let maxDateStr = '';

    if (is3D) {
      const noteNodes = nodes.filter(n => n.createdAt);
      if (noteNodes.length > 0) {
        const times = noteNodes.map(n => new Date(n.createdAt!).getTime());
        const minTime = Math.min(...times);
        const maxTime = Math.max(...times);
        const timeRange = maxTime - minTime || 1;

        minDateStr = new Date(minTime).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        maxDateStr = new Date(maxTime).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

        nodes = nodes.map(node => {
          if (node.createdAt) {
            const time = new Date(node.createdAt).getTime();
            // Map Z from -400 to 400 (longer axis)
            const z = ((time - minTime) / timeRange) * 800 - 400;
            return { ...node, fz: z, z: z, originalZ: z };
          }
          // Non-note nodes (tags etc) cluster around the middle or 0
          return { ...node, fz: 0, z: 0, originalZ: 0 };
        });
        minZ = -400;
        maxZ = 400;
      }
    } else {
       nodes = nodes.map(node => ({ ...node, fx: undefined, fy: undefined, fz: undefined, originalZ: undefined }));
    }

    // ForceGraph mutates links to replace string IDs with object references.
    // Since we recreate node objects, we must reset link sources/targets to string IDs
    // so ForceGraph can correctly re-bind them to the new node instances.
    const resetLinks = links.map(link => ({
      ...link,
      source: typeof link.source === 'object' ? (link.source as any).id : link.source,
      target: typeof link.target === 'object' ? (link.target as any).id : link.target
    }));

    return { 
      processedData: { nodes, links: resetLinks },
      zRange: { min: minZ, max: maxZ },
      dateLabels: { min: minDateStr, max: maxDateStr }
    };
  }, [data, filter, is3D]);

  // Adjust forces for 3D
  useEffect(() => {
    if (fgRef.current && is3D) {
      const fg = fgRef.current;
      // Pull nodes towards the center axis (X=0, Y=0)
      fg.d3Force('x', (require('d3-force') as any).forceX(0).strength(0.05));
      fg.d3Force('y', (require('d3-force') as any).forceY(0).strength(0.05));
      // Ensure no Z force competes with our fixed Z
      fg.d3Force('z', null);
      // Stronger repulsion to keep them from overlapping the axis line
      fg.d3Force('charge').strength(-150);
    }
  }, [is3D, processedData]);

  if (!mounted) return null;

  const isDark = resolvedTheme === 'dark';

  const colors: Record<string, string> = {
    tag: '#a855f7',
    mention: '#f59e0b',
    project: '#10b981',
    note: '#3b82f6'
  };

  const commonProps = {
    graphData: processedData,
    nodeLabel: "title",
    backgroundColor: isDark ? '#050505' : '#ffffff',
    nodeRelSize: 6,
    onNodeClick: (node: any) => {
      if (node.type === 'note') {
        router.push(`/note/${node.id}`);
      } else {
        setFilter(node.title.replace('#', '').replace('@', '').replace('!', ''));
      }
    },
  };

  return (
    <div className="w-full flex-1 h-[calc(100vh-140px)] bg-transparent  overflow-hidden relative flex flex-col">
      {/* Local Filter Bar */}
      <div className="absolute top-4 left-4 z-10 flex gap-2 w-full max-w-md">
        <div className="relative flex-1 group">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/60" />
          <Input
            placeholder="Filter graph..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-9 pl-8 bg-background/80 backdrop-blur-md border-border text-[12px] focus-visible:ring-ring rounded-full"
          />
        </div>
        <button
          onClick={() => setIs3D(!is3D)}
          disabled={!webglAvailable}
          className={`h-9 px-4 bg-background/80 backdrop-blur-md border border-border text-[10px] font-bold uppercase tracking-widest rounded-full transition-colors pointer-events-auto ${
            !webglAvailable ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent'
          }`}
          title={!webglAvailable ? "WebGL not supported in this environment" : ""}
        >
          {!webglAvailable ? '3D Not Supported' : (is3D ? 'Switch to 2D' : 'Switch to 3D')}
        </button>
      </div>

      <div className="flex-1 w-full">
        {is3D && webglAvailable ? (
          <ForceGraph3D
            {...commonProps}
            ref={fgRef}
            linkColor={() => isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}
            linkWidth={1}
            nodeThreeObject={(node: any) => {
              const group = new THREE.Group();
              
              // Node sphere
              const sphereGeom = new THREE.SphereGeometry(node.type === 'note' ? 4 : 3);
              const sphereMat = new THREE.MeshLambertMaterial({ 
                color: colors[node.type] || colors.note,
                transparent: true,
                opacity: 0.9
              });
              const sphere = new THREE.Mesh(sphereGeom, sphereMat);
              group.add(sphere);

              // Label
              const sprite = new SpriteText(node.title);
              sprite.color = isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)';
              sprite.textHeight = 4;
              sprite.position.y = 8;
              group.add(sprite);

              return group;
            }}
            onNodeDrag={(node: any) => {
               // Lock Z strictly during drag using originalZ
               if (node.originalZ !== undefined) {
                 node.z = node.originalZ;
                 node.fz = node.originalZ;
               }
            }}
            onNodeDragEnd={(node: any) => {
               // Re-enforce lock after drag
               if (node.originalZ !== undefined) {
                 node.z = node.originalZ;
                 node.fz = node.originalZ;
               }
            }}
            // Add the visible time axis line and labels at ends
            customLayerData={[{ type: 'axis' }, { type: 'label-min' }, { type: 'label-max' }]}
            customLayerThreeObject={(data: any) => {
              if (data.type === 'axis') {
                const height = (zRange.max - zRange.min) + 100;
                const geometry = new THREE.CylinderGeometry(1.5, 1.5, height, 16);
                const material = new THREE.MeshLambertMaterial({ 
                  color: isDark ? '#60a5fa' : '#2563eb', 
                  transparent: false, 
                  opacity: 1 
                });
                const axis = new THREE.Mesh(geometry, material);
                axis.rotation.x = Math.PI / 2; // Align with Z axis
                axis.position.z = (zRange.max + zRange.min) / 2;
                return axis;
              }
              if (data.type === 'label-min' && dateLabels.min) {
                const sprite = new SpriteText(`Start: ${dateLabels.min}`);
                sprite.color = isDark ? '#93c5fd' : '#1e3a8a';
                sprite.textHeight = 12;
                sprite.fontWeight = 'bold';
                sprite.position.z = zRange.min - 60;
                sprite.position.y = 0;
                return sprite;
              }
              if (data.type === 'label-max' && dateLabels.max) {
                const sprite = new SpriteText(`End: ${dateLabels.max}`);
                sprite.color = isDark ? '#93c5fd' : '#1e3a8a';
                sprite.textHeight = 12;
                sprite.fontWeight = 'bold';
                sprite.position.z = zRange.max + 60;
                sprite.position.y = 0;
                return sprite;
              }
              return undefined;
            }}
            showNavInfo={false}
          />
        ) : (
          <ForceGraph2D
            {...commonProps}
            linkColor={() => isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'}
            linkWidth={1.5}
            nodeCanvasObject={(node: any, ctx, globalScale) => {
              const label = node.title;
              const fontSize = 12 / globalScale;
              ctx.font = `${fontSize}px Inter`;
              const textWidth = ctx.measureText(label).width;
              const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.4);

              // Draw node circle
              ctx.beginPath();
              ctx.arc(node.x, node.y, node.type === 'note' ? 4 : 3, 0, 2 * Math.PI, false);
              
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
        )}
      </div>

      <div className="absolute bottom-4 left-4 pointer-events-none text-[10px] text-muted-foreground bg-background/50 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border">
        {is3D ? 'Z-Axis: Time (Old → New)' : '2D Force Directed Graph'}
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
