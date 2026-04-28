import { getGraphData, getNotes, getFolders } from "@/lib/notes";
import { GraphView } from "@/components/graph-view";
import { LayoutWrapper } from "@/components/layout-wrapper";
import { ContentCard } from "@/components/content-card";
import { SidebarTriggerInternal } from "@/components/sidebar-trigger-internal";

export const dynamic = 'force-dynamic';

export default async function GraphPage() {
  const notes = await getNotes('', true);
  const folders = await getFolders();
  const graphData = await getGraphData();

  return (
    <LayoutWrapper notes={notes} folders={folders}>
      <ContentCard isHome={true}>
        <SidebarTriggerInternal />
        <div className="h-full flex flex-col">
          <div className="p-4 flex justify-between items-center bg-transparent">
          </div>
          <div className="flex-1 p-4 pt-0">
            <GraphView data={graphData} />
          </div>
        </div>
      </ContentCard>
    </LayoutWrapper>
  );
}
