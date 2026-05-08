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
        <div className="h-full w-full">
          <GraphView data={graphData} />
        </div>
      </ContentCard>
    </LayoutWrapper>
  );
}
