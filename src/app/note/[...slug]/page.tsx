import { getNoteContent, getNotes, getBacklinks, getFolders } from "@/lib/notes";
import { Editor } from "@/components/editor";
import { LayoutWrapper } from "@/components/layout-wrapper";
import { Backlinks } from "@/components/backlinks";
import { notFound } from "next/navigation";

export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  const notes = await getNotes();
  return notes.map((note) => ({
    slug: note.slug.split('/'),
  }));
}

export default async function NotePage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug: slugArray } = await params;
  const slug = slugArray.join('/');
  
  try {
    const notes = await getNotes();
    const folders = await getFolders();
    const content = await getNoteContent(slug);
    const title = decodeURIComponent(slug).split('/').pop() || '';
    const backlinks = await getBacklinks(title);
    
    return (
      <LayoutWrapper notes={notes} folders={folders}>
        <div className="max-w-4xl mx-auto py-12 px-6">
          <Editor slug={slug} initialContent={content} allNotes={notes} />
          <Backlinks backlinks={backlinks} />
        </div>
      </LayoutWrapper>
    );
  } catch (error) {
    console.error(error);
    notFound();
  }
}
