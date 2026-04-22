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
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

export function TabsProvider({ children }: { children: React.ReactNode }) {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const pathname = usePathname();
  const router = useRouter();

  const openTab = (tab: Tab) => {
    if (!tabs.find(t => t.slug === tab.slug)) {
      setTabs([...tabs, tab]);
    }
  };

  const closeTab = (slug: string) => {
    const newTabs = tabs.filter(t => t.slug !== slug);
    setTabs(newTabs);
    
    if (pathname === `/note/${slug}`) {
      if (newTabs.length > 0) {
        router.push(`/note/${newTabs[newTabs.length - 1].slug}`);
      } else {
        router.push('/');
      }
    }
  };

  const activeTab = pathname.startsWith('/note/') ? pathname.replace('/note/', '') : null;

  return (
    <TabsContext.Provider value={{ tabs, activeTab, openTab, closeTab }}>
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
