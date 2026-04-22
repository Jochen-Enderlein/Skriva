'use client';

import React from 'react';
import Link from 'next/link';
import { X, FileText } from 'lucide-react';
import { useTabs } from './tabs-context';
import { cn } from '@/lib/utils';

export function TabList() {
  const { tabs, activeTab, closeTab } = useTabs();

  if (tabs.length === 0) return null;

  return (
    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar h-full px-2">
      {tabs.map((tab) => (
        <div
          key={tab.slug}
          className={cn(
            "group relative flex items-center h-8 px-3 gap-2 min-w-[100px] max-w-[180px] text-[12px] font-medium rounded-md transition-all duration-200 select-none",
            activeTab === tab.slug
              ? "bg-white/10 text-white shadow-sm"
              : "text-white/40 hover:bg-white/5 hover:text-white/60"
          )}
        >
          <Link href={`/note/${tab.slug}`} className="flex-1 flex items-center gap-2 truncate pr-4">
            <span className="truncate">{tab.title}</span>
          </Link>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              closeTab(tab.slug);
            }}
            className="absolute right-1.5 opacity-0 group-hover:opacity-100 p-0.5 rounded-md hover:bg-white/10 transition-all duration-200"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
