'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { saveNoteAction } from '@/app/actions';
import { toast } from 'sonner';
import { useDebounce, useDebouncedCallback } from '@/hooks/use-debounce';

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

  useEffect(() => {
    try {
      if (!initialContent || initialContent.trim() === '') {
        setData({
          elements: [],
          appState: { viewBackgroundColor: "#121212" },
          files: {},
        });
      } else {
        const parsed = JSON.parse(initialContent);
        setData(parsed);
      }
      setIsLoaded(true);
    } catch (e) {
      console.error('Failed to parse excalidraw data', e);
      // Fallback to empty if parse fails
      setData({
        elements: [],
        appState: { viewBackgroundColor: "#121212" },
        files: {},
      });
      setIsLoaded(true);
    }
  }, [initialContent]);

  const saveData = useDebouncedCallback(async (newData: any) => {
    if (!newData) return;
    const content = JSON.stringify(newData);
    const result = await saveNoteAction(slug, content);
    if (!result.success) {
      toast.error('Failed to auto-save drawing');
    }
  }, 1000);

  const handleChange = (elements: any, appState: any, files: any) => {
    // Only save if we have elements or something changed
    const newData = {
      type: "excalidraw",
      version: 2,
      source: "https://excalidraw.com",
      elements,
      appState: {
        ...appState,
        collaborators: [] // Don't save collaborators
      },
      files,
    };
    
    saveData(newData);
  };

  if (!isLoaded || !data) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#050505]">
        <span className="text-xs text-muted-foreground uppercase tracking-widest animate-pulse">Loading Drawing...</span>
      </div>
    );
  }

  return (
    <div className="w-full h-[calc(100vh-140px)] mt-2 border border-white/10 rounded-xl overflow-hidden bg-[#121212] shadow-2xl relative">
      <Excalidraw
        initialData={{
          elements: data.elements || [],
          appState: { 
            ...data.appState,
            isLoading: false,
            viewBackgroundColor: data.appState?.viewBackgroundColor || "#121212",
            // Force 100% zoom on fresh load if it's missing or weird
            zoom: { value: 1 },
            scrollX: data.appState?.scrollX || 0,
            scrollY: data.appState?.scrollY || 0,
          },
          files: data.files || {},
        }}
        onChange={handleChange}
        theme="dark"
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
  );
}
