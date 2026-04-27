'use client';

import * as React from 'react';
import { Upload, FilePlus, FolderPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { importItemsAction } from '@/app/actions';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface DropZoneProps {
  children: React.ReactNode;
}

export function DropZone({ children }: DropZoneProps) {
  const router = useRouter();
  const [isDragging, setIsDragging] = React.useState(false);
  const dragCounter = React.useRef(0);

  const handleDragEnter = (e: React.DragEvent) => {
    // Ignore internal drags
    if (e.dataTransfer.types.includes('application/x-feli-item')) return;

    e.preventDefault();
    e.stopPropagation();
    
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-feli-item')) return;

    e.preventDefault();
    e.stopPropagation();
    
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-feli-item')) return;

    e.preventDefault();
    e.stopPropagation();
    // Required to allow drop
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-feli-item')) return;

    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const files = Array.from(e.dataTransfer.files) as (File & { path?: string })[];
    console.log('Dropped files:', files);

    if (files.length === 0) {
      toast.error("No files detected in drop event.");
      return;
    }

    // In Electron, File object has a 'path' property
    const paths = files.map(f => f.path).filter((p): p is string => !!p);
    console.log('File paths extracted:', paths);

    if (paths.length === 0) {
      toast.error("Could not determine file paths. If you are in a web browser, DND is not supported yet.");
      return;
    }

    const toastId = toast.loading(`Importing ${paths.length} item(s)...`);

    try {
      const res = await importItemsAction(paths);
      if (res.success) {
        toast.success(`Successfully imported ${paths.length} item(s)`, { id: toastId });
        router.refresh();
      } else {
        toast.error(res.error || "Failed to import items", { id: toastId });
      }
    } catch (error) {
      toast.error("An error occurred during import", { id: toastId });
    }
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="relative min-h-screen w-full"
    >
      {children}
      
      {isDragging && (
        <div className="absolute inset-0 z-[100] pointer-events-none flex items-center justify-center bg-background/40 backdrop-blur-[2px] transition-all animate-in fade-in duration-200">
          <div className="flex flex-col items-center gap-4 p-12 border-4 border-dashed border-primary/50 rounded-3xl bg-background/80 shadow-2xl">
            <div className="p-6 bg-primary/10 rounded-full animate-bounce">
              <Upload className="h-12 w-12 text-primary" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-bold tracking-tight">Drop to Import</h3>
              <p className="text-muted-foreground max-w-xs">
                Release to add files and folders to your library
              </p>
            </div>
            <div className="flex gap-4 mt-2">
               <div className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 bg-background border rounded-full">
                 <FilePlus className="h-3 w-3" />
                 Files
               </div>
               <div className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 bg-background border rounded-full">
                 <FolderPlus className="h-3 w-3" />
                 Folders
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
