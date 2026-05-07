'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface Tab {
  slug: string;
  title: string;
}

interface TabsContextType {
  tabs: Tab[];
  activeTab: string | null;
  openTab: (tab: Tab) => void;
  closeTab: (slug: string) => void;
  isGraphOpen: boolean;
  setIsGraphOpen: (open: boolean) => void;
  isReadmeOpen: boolean;
  setIsReadmeOpen: (open: boolean) => void;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

export function TabsProvider({ children }: { children: React.ReactNode }) {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [isGraphOpen, setIsGraphOpen] = useState(false);
  const [isReadmeOpen, setIsReadmeOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const openTab = (tab: Tab) => {
    if (!tabs.find(t => t.slug === tab.slug)) {
      setTabs([...tabs, tab]);
    }
  };

  const closeTab = (slug: string) => {
    const tabIndex = tabs.findIndex(t => t.slug === slug);
    const newTabs = tabs.filter(t => t.slug !== slug);
    setTabs(newTabs);
    
    // Normalize path for comparison (decode %20 etc)
    const currentSlug = decodeURIComponent(pathname.replace('/note/', ''));
    const closingSlug = decodeURIComponent(slug);

    if (pathname.startsWith('/note/') && currentSlug === closingSlug) {
      if (newTabs.length > 0) {
        const nextTab = newTabs[tabIndex] || newTabs[newTabs.length - 1];
        router.push(`/note/${nextTab.slug}`);
      } else {
        router.push('/');
      }
    }
  };

  const activeTab = pathname.startsWith('/note/') 
    ? decodeURIComponent(pathname.replace('/note/', '')).replace(/\/$/, '') 
    : null;

  return (
    <TabsContext.Provider value={{ tabs, activeTab, openTab, closeTab, isGraphOpen, setIsGraphOpen, isReadmeOpen, setIsReadmeOpen }}>
      {children}
    </TabsContext.Provider>
  );
}

export function useTabs() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('useTabs must be used within a TabsProvider');
  }
  return context;
}
