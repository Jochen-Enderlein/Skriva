import { getMentions, getNotes, getFolders } from "@/lib/notes";
import { LayoutWrapper } from "@/components/layout-wrapper";
import { AtSign } from "lucide-react";
import Link from "next/link";
import { ContentCard } from "@/components/content-card";
import { SidebarTriggerInternal } from "@/components/sidebar-trigger-internal";

export const dynamic = 'force-dynamic';

export default async function MentionsPage() {
  const notes = await getNotes('', true);
  const folders = await getFolders();
  const mentions = await getMentions();

  return (
    <LayoutWrapper notes={notes} folders={folders}>
      <ContentCard isHome={true}>
        <SidebarTriggerInternal />
        <div className="h-full flex flex-col max-w-4xl mx-auto py-12 px-6">
          <h2 className="text-3xl font-bold mb-8 flex items-center gap-2">
            <AtSign className="h-8 w-8 text-muted-foreground" />
            Mentions
          </h2>
          <div className="flex flex-wrap gap-4">
            {mentions.map(({ mention, count }) => (
              <div
                key={mention}
                className="flex items-center gap-2 px-4 py-2 rounded-full border bg-secondary/30 hover:bg-secondary transition-colors"
              >
                <span className="font-medium text-amber-500">@{mention}</span>
                <span className="text-sm text-muted-foreground bg-background px-2 py-0.5 rounded-full border">
                  {count}
                </span>
              </div>
            ))}
            {mentions.length === 0 && (
              <p className="text-muted-foreground italic">No mentions found in your notes.</p>
            )}
          </div>
        </div>
      </ContentCard>
    </LayoutWrapper>
  );
}
