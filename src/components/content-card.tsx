'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface ContentCardProps {
  children: React.ReactNode;
  className?: string;
  isHome?: boolean;
}

export function ContentCard({ children, className, isHome }: ContentCardProps) {
  return (
    <div className={cn(
      "w-full h-full bg-background rounded-b-2xl md:rounded-b-3xl rounded-t-xl md:rounded-t-xl overflow-hidden relative group/card transition-all duration-300",
      className
    )}>
      {children}
    </div>
  );
}
