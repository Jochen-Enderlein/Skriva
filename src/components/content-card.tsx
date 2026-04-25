'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface ContentCardProps {
  children: React.ReactNode;
  className?: string;
}

export function ContentCard({ children, className }: ContentCardProps) {
  return (
    <div className={cn(
      "w-full h-full bg-background rounded-2xl md:rounded-3xl border border-border/40 overflow-hidden relative group/card",
      className
    )}>
      {children}
    </div>
  );
}
