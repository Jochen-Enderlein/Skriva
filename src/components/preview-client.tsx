'use client';

import React, { useState, useEffect } from 'react';
import { Editor } from "@/components/editor";
import { Button } from "@/components/ui/button";
import { Minus, Square, X as CloseIcon } from "lucide-react";

export function PreviewClient({ data: initialData, slug: initialSlug }: any) {
  const [mounted, setMounted] = React.useState(false);
  const [slug, setSlug] = useState(initialSlug);
  const [content, setContent] = useState(initialData?.content || '');
  const [properties, setProperties] = useState(initialData?.properties || {});
  
  React.useEffect(() => {
    setMounted(true);
    
    // In static export, we might need to get the slug from URL query params
    if (!initialSlug && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlSlug = params.get('slug');
      if (urlSlug) {
        setSlug(urlSlug);
        // We'd need to load the content via Electron IPC here since it's static HTML
        if (window.electron) {
          window.electron.getNoteContent(urlSlug).then(setContent);
        }
      }
    }
  }, [initialSlug]);

  // Listen for broadcasts from the main editor window
  useEffect(() => {
    const channel = new BroadcastChannel(`note-update-${slug}`);
    
    channel.onmessage = (event) => {
      const { content: newContent, properties: newProperties } = event.data;
      if (newContent !== undefined) setContent(newContent);
      if (newProperties !== undefined) setProperties(newProperties);
    };

    return () => channel.close();
  }, [slug]);

  const isMac = React.useMemo(() => {
    return mounted && typeof window !== 'undefined' && window.electron?.platform === 'darwin';
  }, [mounted]);

  const WindowControls = () => {
    if (!mounted || typeof window === 'undefined' || !window.electron || isMac) return null;

    return (
      <div className="flex items-center no-drag ml-auto pr-2 h-full">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 hover:bg-white/5 no-drag" 
          onClick={() => window.electron?.minimizeWindow()}
        >
          <Minus className="h-3 w-3 opacity-50" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 hover:bg-white/5 no-drag" 
          onClick={() => window.electron?.maximizeWindow()}
        >
          <Square className="h-3 w-3 opacity-50" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 hover:bg-red-500/20 hover:text-red-500 no-drag" 
          onClick={() => window.electron?.closeWindow()}
        >
          <CloseIcon className="h-3 w-3 opacity-50 hover:opacity-100" />
        </Button>
      </div>
    );
  };

  return (
    <div className="h-screen w-full bg-background flex flex-col overflow-hidden">
      <div 
        className="h-10 w-full flex items-center shrink-0 z-50 no-print"
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        <WindowControls />
      </div>
      <div className="flex-1 overflow-hidden">
        <Editor
          slug={slug}
          initialContent={content}
          allNotes={initialData.notes}
          graphData={initialData.graphData}
          backlinks={initialData.backlinks}
          allTags={initialData.tags}
          allMentions={initialData.mentions}
          allProjects={initialData.projects}
          forceReadOnly={true}
        />
      </div>
    </div>
  );
}
