'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { getNoteContentAction } from '@/app/actions';
import { useTheme } from 'next-themes';

const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then((mod) => mod.Excalidraw),
  { ssr: false }
);

interface ExcalidrawEmbedProps {
  slug: string;
}

// Simple global cache to avoid redundant fetches during re-renders (especially print)
const excalidrawCache: Record<string, any> = {};

export function ExcalidrawEmbed({ slug }: ExcalidrawEmbedProps) {
  const [data, setData] = useState<any>(excalidrawCache[slug] || null);
  const [loading, setLoading] = useState(!excalidrawCache[slug]);
  const [svgUrl, setSvgUrl] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    let isMounted = true;

    async function fetchAndProcess() {
      let retryCount = 0;
      const maxRetries = 3;

      const attemptFetch = async () => {
        try {
          let parsedData = excalidrawCache[slug];
          
          if (!parsedData) {
            console.log(`[Excalidraw] Fetching content for ${slug} (attempt ${retryCount + 1})...`);
            const result = await getNoteContentAction(slug);
            if (!isMounted) return;

            if (result.success && result.content) {
              parsedData = JSON.parse(result.content);
              excalidrawCache[slug] = parsedData;
              setData(parsedData);
            } else if (retryCount < maxRetries) {
              retryCount++;
              setTimeout(attemptFetch, 1000);
              return;
            }
          }

          if (parsedData && isMounted) {
            // Generate SVG for print
            try {
              const { exportToSvg } = await import('@excalidraw/excalidraw');
              if (exportToSvg && parsedData.elements) {
                const svg = await exportToSvg({
                  elements: parsedData.elements,
                  appState: {
                    ...parsedData.appState,
                    exportWithBlur: false,
                    exportBackground: false,
                    viewBackgroundColor: '#ffffff'
                  },
                  files: parsedData.files,
                  exportPadding: 10,
                });
                
                if (isMounted) {
                  const svgString = new XMLSerializer().serializeToString(svg);
                  const blob = new Blob([svgString], { type: 'image/svg+xml' });
                  setSvgUrl(URL.createObjectURL(blob));
                }
              }
            } catch (svgErr) {
              console.error(`[Excalidraw] SVG error:`, svgErr);
            }
          }
        } catch (e) {
          console.error(`[Excalidraw] Error:`, e);
        } finally {
          if (isMounted && (parsedData || retryCount >= maxRetries)) {
            setLoading(false);
          }
        }
      };

      attemptFetch();
    }

    fetchAndProcess();
    return () => { isMounted = false; };
  }, [slug]);

  if (loading) {
    return (
      <div 
        data-rendering="true"
        className="w-full h-64 flex items-center justify-center bg-white/5 animate-pulse rounded-lg my-4 border border-white/5">
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Loading Drawing...</span>
      </div>
    );
  }

  // If we have data but no svgUrl yet, we are still "rendering" for print purposes
  const isActuallyRendering = !svgUrl && !!data;

  if (!data) {
    return (
      <div 
        data-rendering="false"
        className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs font-mono my-4">
        Could not load excalidraw file: {slug}
      </div>
    );
  }

  return (
    <div 
      data-rendering={isActuallyRendering ? "true" : "false"}
      className="relative group my-4 border-l-4 border-primary/40 pl-4 h-[400px] bg-background rounded-xl overflow-hidden border border-border print:border-none print:pl-0 print:h-auto print:min-h-0">
      {/* Live version for app */}
      <div className="w-full h-full no-print">
        <Excalidraw
          initialData={{
            elements: data.elements || [],
            appState: { 
              ...data.appState,
              viewModeEnabled: true,
              zenModeEnabled: true,
              viewBackgroundColor: 'transparent'
            },
            files: data.files || {},
          }}
          viewModeEnabled={true}
          theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
        />
      </div>

      {/* Static SVG for PDF export */}
      {svgUrl && (
        <div className="hidden print:block w-full">
          <img 
            src={svgUrl} 
            alt="Excalidraw Diagram" 
            className="w-full h-auto max-h-[800px] object-contain"
          />
        </div>
      )}

      <div className="absolute bottom-2 right-2 pointer-events-none z-10 no-print">
        <span className="text-[10px] bg-black/50 px-2 py-1 rounded text-white/40 font-medium tracking-wider uppercase backdrop-blur-sm">Excalidraw Drawing</span>
      </div>
    </div>
  );
}
