import { getNoteContent, getNotes, getBacklinks, getGraphData, getTags, getMentions, getProjects } from "@/lib/notes";
import { PreviewClient } from "@/components/preview-client";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function PreviewPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug: slugArray } = await params;
  const slug = slugArray.join('/');
  
  try {
    const [notes, content, graphData, tags, mentions, projects] = await Promise.all([
      getNotes('', true),
      getNoteContent(slug),
      getGraphData(),
      getTags(),
      getMentions(),
      getProjects()
    ]);

    const title = decodeURIComponent(slug).split('/').pop() || '';
    const backlinks = await getBacklinks(title);

    const data = {
      notes,
      content,
      graphData,
      backlinks,
      tags: tags.map(t => t.tag),
      mentions: mentions.map(m => m.mention),
      projects: projects.map(p => p.project)
    };

    return <PreviewClient data={data} slug={slug} />;
  } catch (error) {
    console.error(error);
    redirect('/');
  }
}
