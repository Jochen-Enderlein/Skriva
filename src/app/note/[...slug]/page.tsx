import { getNoteContent, getNotes, getBacklinks, getFolders, getGraphData, getTags, getMentions, getProjects } from "@/lib/notes";
import { Editor } from "@/components/editor";
import { LayoutWrapper } from "@/components/layout-wrapper";
import { redirect } from "next/navigation";

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
    const notes = await getNotes('', true);
    const folders = await getFolders();
    const content = await getNoteContent(slug);
    const title = decodeURIComponent(slug).split('/').pop() || '';
    const backlinks = await getBacklinks(title);
    const graphData = await getGraphData();
    const tags = await getTags();
    const mentions = await getMentions();
    const projects = await getProjects();

    return (
      <LayoutWrapper notes={notes} folders={folders}>
        <Editor
          slug={slug}
          initialContent={content}
          allNotes={notes}
          graphData={graphData}
          backlinks={backlinks}
          allTags={tags.map(t => t.tag)}
          allMentions={mentions.map(m => m.mention)}
          allProjects={projects.map(p => p.project)}
        />
      </LayoutWrapper>
    );
  } catch (error) {
    console.error(error);
    redirect('/');
  }
}
