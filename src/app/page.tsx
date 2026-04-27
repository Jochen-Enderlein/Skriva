import { getNotes, getFolders } from "@/lib/notes";
import { LayoutWrapper } from "@/components/layout-wrapper";
import { ContentCard } from "@/components/content-card";
import { SidebarTriggerInternal } from "@/components/sidebar-trigger-internal";

export const dynamic = 'force-dynamic';

export default async function Home() {
  const notes = await getNotes('', true);
  const folders = await getFolders();

  return (
    <LayoutWrapper notes={notes} folders={folders}>
      <ContentCard>
        <SidebarTriggerInternal />
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center">
          <div className="relative mb-6">
            <img 
              src="/feli.png" 
              alt="Feli" 
              className="w-48 h-48 rounded-full object-cover border-4 border-sidebar-border shadow-2xl"
            />
          </div>
          <h2 className="text-3xl font-bold mb-2 text-foreground tracking-tight">Feli.md</h2>
          <p className="max-w-md text-sm opacity-80">
            Dedicated to Feli. <br />
            Select a note to start writing, or create a new one.
          </p>
        </div>
      </ContentCard>
    </LayoutWrapper>
  );
}
