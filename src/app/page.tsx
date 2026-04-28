import { getNotes, getFolders } from "@/lib/notes";
import { LayoutWrapper } from "@/components/layout-wrapper";
import { ContentCard } from "@/components/content-card";
import { SidebarTriggerInternal } from "@/components/sidebar-trigger-internal";
import { HomeTitle } from "@/components/home-title";

export const dynamic = 'force-dynamic';

export default async function Home() {
  const notes = await getNotes('', true);
  const folders = await getFolders();

  return (
    <LayoutWrapper notes={notes} folders={folders}>
      <ContentCard isHome={true}>
        <SidebarTriggerInternal />
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center">
          <div className="relative mb-6">
            <img 
              src="/feli.png" 
              alt="Feli" 
              className="w-48 h-48 rounded-full object-cover border-4 border-sidebar-border shadow-2xl"
            />
          </div>
          <div className="flex flex-col md:flex-row items-center md:items-baseline gap-3 mb-2">
            <HomeTitle />
            <p className="text-sm opacity-60 font-medium italic">
              Dedicated to Feli.
            </p>
          </div>
          <p className="max-w-md text-[12px] opacity-40">
            Select a note to start writing, or create a new one.
          </p>
        </div>
      </ContentCard>
    </LayoutWrapper>
  );
}
