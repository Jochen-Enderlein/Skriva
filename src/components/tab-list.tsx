'use client';

import React from 'react';
import Link from 'next/link';
import { X, FileText, Pencil, Home } from 'lucide-react';
import { useTabs } from './tabs-context';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/components/ui/sidebar';
import { usePathname } from 'next/navigation';

export function TabList() {
  const { tabs, activeTab, closeTab } = useTabs();
  const { state } = useSidebar();
  const pathname = usePathname();
  
  const isMac = React.useMemo(() => {
    return typeof window !== 'undefined' && window.electron?.platform === 'darwin';
  }, []);

  return (
    <div className={cn(
      "flex items-end gap-0 overflow-x-auto no-scrollbar h-full transition-all duration-300 w-full",
      isMac && state === "collapsed" ? "pl-20" : "pl-0"
    )}>
      <Link 
        href="/" 
        className={cn(
          "flex items-center justify-center h-9 w-10 transition-all duration-200 shrink-0 relative z-30 ml-2 border-t border-transparent",
          pathname === '/' 
            ? "text-primary mb-[-1px] rounded-t-xl" 
            : "text-muted-foreground hover:bg-accent/30 hover:text-foreground mb-[-1px] rounded-md"
        )}
        title="Home"
      >
        <Home className="h-4 w-4" />
        {pathname === '/' && (
          <>
            {/* Inverted Corners using Box Shadows */}
            <div className="absolute bottom-0 -left-[10px] w-[10px] h-[10px] pointer-events-none overflow-hidden z-30">
              <div className="w-full h-full rounded-br-[10px] border-r border-b border-border/40 shadow-[5px_5px_0_0_var(--background)]" />
            </div>
            <div className="absolute bottom-0 -right-[10px] w-[10px] h-[10px] pointer-events-none overflow-hidden z-30">
              <div className="w-full h-full rounded-bl-[10px] border-l border-b border-border/40 shadow-[-5px_5px_0_0_var(--background)]" />
            </div>
            {/* Mask to hide the border of the card below */}
            <div className="absolute -bottom-[2px] -left-[1px] -right-[1px] h-[3px] bg-background z-40" />
            </>
            )}
            </Link>

            <div className="w-2 shrink-0" />

            {tabs.map((tab) => {
              const isActive = activeTab === tab.slug;
              return (
                <div
                  key={tab.slug}
                  className={cn(
                    "group relative flex items-center h-9 px-4 gap-2 min-w-[120px] max-w-[200px] text-[12px] font-medium transition-all duration-200 select-none rounded-t-xl z-30 border-t",
                    isActive
                      ? "bg-background text-foreground border-l border-r border-border/40 shadow-[0_-1px_3px_rgba(0,0,0,0.05)] mb-[-1px] border-t-border/40"
                      : "text-muted-foreground hover:bg-accent/30 hover:text-foreground mb-[-1px] mx-0.5 border-t-transparent"
                  )}
                >
                  {isActive && (
                    <>
                      {/* Inverted Corners */}
                      <div className="absolute bottom-0 -left-[10px] w-[10px] h-[10px] pointer-events-none overflow-hidden z-30">
                        <div className="w-full h-full rounded-br-[10px] border-r border-b border-border/40 shadow-[5px_5px_0_0_var(--background)]" />
                      </div>
                      <div className="absolute bottom-0 -right-[10px] w-[10px] h-[10px] pointer-events-none overflow-hidden z-30">
                        <div className="w-full h-full rounded-bl-[10px] border-l border-b border-border/40 shadow-[-5px_5px_0_0_var(--background)]" />
                      </div>
                      {/* Mask to hide the border of the card below */}
                      <div className="absolute -bottom-[2px] -left-[1px] -right-[1px] h-[3px] bg-background z-40" />
                    </>
                  )}
                  <Link href={`/note/${tab.slug}`} className="flex-1 flex items-center gap-2 truncate pr-4 h-full">
                    {tab.slug.toLowerCase().endsWith('.excalidraw') ? (
                      <Pencil className="h-3.5 w-3.5 opacity-50" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 opacity-50" />
                    )}
                    <span className="truncate">{tab.title.replace(/\.(md|excalidraw)$/i, '')}</span>
                  </Link>            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                closeTab(tab.slug);
              }}
              className={cn(
                "absolute right-2 p-0.5 rounded-md hover:bg-accent transition-all duration-200",
                isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
