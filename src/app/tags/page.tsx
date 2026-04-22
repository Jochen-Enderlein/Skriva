import { getTags, getNotes, getFolders } from "@/lib/notes";
import { LayoutWrapper } from "@/components/layout-wrapper";
import { Hash } from "lucide-react";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default async function TagsPage() {
  const notes = await getNotes();
  const folders = await getFolders();
  const tags = await getTags();

  return (
    <LayoutWrapper notes={notes} folders={folders}>
      <div className="h-full flex flex-col max-w-4xl mx-auto py-12 px-6">
        <h2 className="text-3xl font-bold mb-8 flex items-center gap-2">
          <Hash className="h-8 w-8 text-muted-foreground" />
          Tags
        </h2>
        <div className="flex flex-wrap gap-4">
          {tags.map(({ tag, count }) => (
            <div
              key={tag}
              className="flex items-center gap-2 px-4 py-2 rounded-full border bg-secondary/30 hover:bg-secondary transition-colors"
            >
              <span className="font-medium text-blue-500">#{tag}</span>
              <span className="text-sm text-muted-foreground bg-background px-2 py-0.5 rounded-full border">
                {count}
              </span>
            </div>
          ))}
          {tags.length === 0 && (
            <p className="text-muted-foreground italic">No tags found in your notes.</p>
          )}
        </div>
      </div>
    </LayoutWrapper>
  );
}
