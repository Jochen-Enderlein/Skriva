'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { saveNoteAction } from '@/app/actions';
import { toast } from 'sonner';
import { useDebounce, useDebouncedCallback } from '@/hooks/use-debounce';
import { useTheme } from 'next-themes';

const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then((mod) => mod.Excalidraw),
  { ssr: false }
);

interface ExcalidrawEditorProps {
  slug: string;
  initialContent: string;
}

export function ExcalidrawEditor({ slug, initialContent }: ExcalidrawEditorProps) {
  const [data, setData] = useState<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const { resolvedTheme } = useTheme();
  const [svgUrl, setSvgUrl] = useState<string | null>(null);

  const generateSvg = useCallback(async (parsedData: any) => {
    if (parsedData.elements && parsedData.elements.length > 0) {
      try {
        const { exportToSvg } = await import('@excalidraw/excalidraw');
        if (exportToSvg) {
          const svg = await exportToSvg({
            elements: parsedData.elements,
            appState: {
              ...parsedData.appState,
              exportWithBlur: false,
              exportBackground: true,
              viewBackgroundColor: '#ffffff'
            },
            files: parsedData.files,
            exportPadding: 10,
          });
          
          const svgString = new XMLSerializer().serializeToString(svg);
          const blob = new Blob([svgString], { type: 'image/svg+xml' });
          setSvgUrl(URL.createObjectURL(blob));
        }
      } catch (e) {
        console.error('Failed to generate SVG', e);
      }
    }
  }, []);

  useEffect(() => {
    try {
      if (!initialContent || initialContent.trim() === '') {
        const defaultData = {
          elements: [],
          appState: { viewBackgroundColor: resolvedTheme != 'dark' ? "#121212" : "#ffffff" },
          files: {},
        };
        setData(defaultData);
      } else {
        const parsed = JSON.parse(initialContent);
        setData(parsed);
        generateSvg(parsed);
      }
      setIsLoaded(true);
    } catch (e) {
      console.error('Failed to parse excalidraw data', e);
      const fallbackData = {
        elements: [],
        appState: { viewBackgroundColor: resolvedTheme != 'dark' ? "#121212" : "#ffffff" },
        files: {},
      };
      setData(fallbackData);
      setIsLoaded(true);
    }
  }, [initialContent, resolvedTheme, generateSvg]);

  const saveData = useDebouncedCallback(async (newData: any) => {
    if (!newData) return;
    const content = JSON.stringify(newData);
    const result = await saveNoteAction(slug, content);
    if (!result.success) {
      toast.error('Failed to auto-save drawing');
    }
    // Update SVG preview after save
    generateSvg(newData);
  }, 1000);

  const handleChange = (elements: any, appState: any, files: any) => {
    const newData = {
      type: "excalidraw",
      version: 2,
      source: "https://excalidraw.com",
      elements,
      appState: {
        ...appState,
        collaborators: []
      },
      files,
    };
    
    saveData(newData);
  };

  if (!isLoaded || !data) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <span className="text-xs text-muted-foreground uppercase tracking-widest animate-pulse">Loading Drawing...</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative print:h-auto print:border-none print:shadow-none print:mt-0">
      <div className="w-full h-full no-print">
        <Excalidraw
          initialData={{
            elements: data.elements || [],
            appState: { 
              ...data.appState, 
              isLoading: false,
              viewBackgroundColor: "transparent",
              zoom: { value: 1 },
              scrollX: data.appState?.scrollX || 0,
              scrollY: data.appState?.scrollY || 0,
            },
            files: data.files || {},
          }}
          onChange={handleChange}
          theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
          UIOptions={{
            canvasActions: {
              toggleTheme: false,
              export: false,
              loadScene: false,
              saveToActiveFile: false,
            }
          }}
        />
      </div>

      {/* Static SVG for PDF export */}
      {svgUrl && (
        <div className="hidden print:block w-full">
          <img 
            src={svgUrl} 
            alt="Excalidraw Drawing" 
            className="w-full h-auto max-h-[none] object-contain"
          />
        </div>
      )}
    </div>
  );
}
