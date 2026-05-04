import { getProjects, getNotes, getFolders } from "@/lib/notes";
import { LayoutWrapper } from "@/components/layout-wrapper";
import { Briefcase } from "lucide-react";
import { ContentCard } from "@/components/content-card";
import { SidebarTriggerInternal } from "@/components/sidebar-trigger-internal";

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const notes = await getNotes('', true);
  const folders = await getFolders();
  const projects = await getProjects();

  return (
    <LayoutWrapper notes={notes} folders={folders}>
      <ContentCard isHome={true}>
        <SidebarTriggerInternal />
        <div className="h-full flex flex-col max-w-4xl mx-auto py-12 px-6">
          <h2 className="text-3xl font-bold mb-8 flex items-center gap-2">
            <Briefcase className="h-8 w-8 text-muted-foreground" />
            Projects
          </h2>
          <div className="flex flex-wrap gap-4">
            {projects.map(({ project, count }) => (
              <div
                key={project}
                className="flex items-center gap-2 px-4 py-2 rounded-full border bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors border-emerald-500/30"
              >
                <span className="font-medium text-emerald-500">!{project}</span>
                <span className="text-sm text-muted-foreground bg-background px-2 py-0.5 rounded-full border">
                  {count}
                </span>
              </div>
            ))}
            {projects.length === 0 && (
              <p className="text-muted-foreground italic">No projects found in your notes.</p>
            )}
          </div>
        </div>
      </ContentCard>
    </LayoutWrapper>
  );
}
