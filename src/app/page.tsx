import { getNotes, getFolders } from "@/lib/notes";
import { LayoutWrapper } from "@/components/layout-wrapper";

export const dynamic = 'force-dynamic';

export default async function Home() {
  const notes = await getNotes();
  const folders = await getFolders();

  return (
    <LayoutWrapper notes={notes} folders={folders}>
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center">
        <h2 className="text-2xl font-semibold mb-2 text-foreground">Welcome to Skriva</h2>
        <p className="max-w-md">
          Select a note from the sidebar to start writing, or create a new one.
          Use [[Wiki-Links]] to connect your thoughts.
        </p>
      </div>
    </LayoutWrapper>
  );
}
