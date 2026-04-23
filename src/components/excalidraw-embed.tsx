'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { getNoteContentAction } from '@/app/actions';

const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then((mod) => mod.Excalidraw),
  { ssr: false }
);

interface ExcalidrawEmbedProps {
  slug: string;
}

export function ExcalidrawEmbed({ slug }: ExcalidrawEmbedProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchContent() {
      const result = await getNoteContentAction(slug);
      if (result.success && result.content) {
        try {
          setData(JSON.parse(result.content));
        } catch (e) {
          console.error('Failed to parse excalidraw data', e);
        }
      }
      setLoading(false);
    }
    fetchContent();
  }, [slug]);

  if (loading) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-white/5 animate-pulse rounded-lg my-4 border border-white/5">
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Loading Drawing...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs font-mono my-4">
        Could not load excalidraw file: {slug}
      </div>
    );
  }

  return (
    <div className="relative group my-4 border-l-4 border-primary/40 pl-4 h-[400px] bg-white rounded-xl overflow-hidden border border-white/10">
      <Excalidraw
        initialData={{
          elements: data.elements || [],
          appState: { 
            ...data.appState,
            viewModeEnabled: true,
            zenModeEnabled: true,
          },
          files: data.files || {},
        }}
        viewModeEnabled={true}
        theme="dark"
      />
      <div className="absolute bottom-2 right-2 pointer-events-none z-10">
        <span className="text-[10px] bg-black/50 px-2 py-1 rounded text-white/40 font-medium tracking-wider uppercase backdrop-blur-sm">Excalidraw Drawing</span>
      </div>
    </div>
  );
}
