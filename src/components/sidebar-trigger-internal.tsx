'use client';

import * as React from 'react';
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    electron?: {
      platform: string;
    };
  }
}

export function SidebarTriggerInternal() {
  const isMac = typeof window !== 'undefined' && window.electron?.platform === 'darwin';
  
  return (
    <div className={cn(
      "absolute top-3 z-50 flex items-center gap-2 no-print transition-all duration-300",
      isMac ? "left-3 peer-data-[state=collapsed]:left-16" : "left-3"
    )}>
      <SidebarTrigger className="h-8 w-8 opacity-30 hover:opacity-100 transition-all text-foreground hover:bg-accent rounded-xl" />
    </div>
  );
}
