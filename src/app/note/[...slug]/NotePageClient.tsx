'use client';

import { useEffect, useState } from 'react';
import { Editor } from "@/components/editor";
import { LayoutWrapper } from "@/components/layout-wrapper";
import { useRouter, useParams } from "next/navigation";
import { 
  getNoteContentAction
} from "@/app/actions";
import { NoteMetadata } from "@/lib/types";

export default function NotePageClient() {
  const params = useParams();
  const slugArray = params.slug as string[];
  const slug = slugArray ? slugArray.join('/') : '';
  
  const [data, setData] = useState<{
    notes: NoteMetadata[];
    folders: string[];
    content: string;
    lastUpdated?: string;
    backlinks: any[];
    graphData: any;
    tags: string[];
    mentions: string[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!slug) return;
    
    async function loadData() {
      setLoading(true);
      try {
        const electron = window.electron;
        if (electron) {
          const [notes, folders, content, graphData, tags, mentions, backlinks] = await Promise.all([
            electron.getNotes('', true),
            electron.getFolders(''),
            electron.getNoteContent(slug),
            electron.getGraphData(),
            electron.getTags(),
            electron.getMentions(),
            electron.getBacklinks(decodeURIComponent(slug).split('/').pop() || '')
          ]);

          setData({
            notes,
            folders,
            content,
            graphData,
            tags: tags.map((t: any) => t.tag),
            mentions: mentions.map((m: any) => m.mention),
            backlinks
          });
          } else {
          const contentRes = await getNoteContentAction(slug);
          if (contentRes.success) {
            setData({
              notes: [],
              folders: [],
              content: contentRes.content || '',
              lastUpdated: contentRes.lastUpdated,
              graphData: { nodes: [], links: [] },
              tags: [],
              mentions: [],
              backlinks: []
            });          }
        }
      } catch (error) {
        console.error("Failed to load note:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [slug, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-background text-muted-foreground">
        <div className="animate-pulse tracking-widest uppercase text-[10px] font-bold">Loading Note...</div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <LayoutWrapper notes={data.notes} folders={data.folders}>
      <Editor 
        slug={slug} 
        initialContent={data.content} 
        lastUpdated={data.lastUpdated}
        allNotes={data.notes} 
        graphData={data.graphData} 
        backlinks={data.backlinks} 
        allTags={data.tags}
        allMentions={data.mentions}
      />
    </LayoutWrapper>
  );
}
