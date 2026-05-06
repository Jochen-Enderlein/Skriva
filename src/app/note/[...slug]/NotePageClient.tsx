'use client';

import { useEffect, useState } from 'react';
import { Editor } from "@/components/editor";
import { LayoutWrapper } from "@/components/layout-wrapper";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { 
  getNoteContentAction,
  getNotesAction,
  getFoldersAction,
  getGraphDataAction,
  getTagsAction,
  getMentionsAction,
  getProjectsAction,
  getBacklinksAction
} from "@/app/actions";
import { NoteMetadata } from "@/lib/types";

export default function NotePageClient() {
  const params = useParams();
  const searchParams = useSearchParams();
  const isPreview = searchParams.get('preview') === 'true';
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
    projects: string[];
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
          const [notes, folders, content, graphData, tags, mentions, projects, backlinks] = await Promise.all([
            electron.getNotes('', true),
            electron.getFolders(''),
            electron.getNoteContent(slug),
            electron.getGraphData(),
            electron.getTags(),
            electron.getMentions(),
            electron.getProjects(),
            electron.getBacklinks(decodeURIComponent(slug).split('/').pop() || '')
          ]);

          setData({
            notes,
            folders,
            content,
            graphData,
            tags: tags.map((t: any) => t.tag),
            mentions: mentions.map((m: any) => m.mention),
            projects: projects.map((p: any) => p.project),
            backlinks
          });
        } else {
          // Fallback to server actions for non-electron environments (e.g., mobile/web)
          const [contentRes, notesRes, foldersRes, graphRes, tagsRes, mentionsRes, projectsRes, backlinksRes] = await Promise.all([
            getNoteContentAction(slug),
            getNotesAction('', true),
            getFoldersAction(''),
            getGraphDataAction(),
            getTagsAction(),
            getMentionsAction(),
            getProjectsAction(),
            getBacklinksAction(decodeURIComponent(slug).split('/').pop() || '')
          ]);

          if (contentRes.success) {
            setData({
              notes: notesRes.success ? notesRes.notes as NoteMetadata[] : [],
              folders: foldersRes.success ? foldersRes.folders as string[] : [],
              content: contentRes.content || '',
              lastUpdated: contentRes.lastUpdated,
              graphData: graphRes.success ? graphRes.graphData : { nodes: [], links: [] },
              tags: tagsRes.success ? tagsRes.tags.map((t: any) => t.tag) : [],
              mentions: mentionsRes.success ? mentionsRes.mentions.map((m: any) => m.mention) : [],
              projects: projectsRes.success ? projectsRes.projects.map((p: any) => p.project) : [],
              backlinks: backlinksRes.success ? backlinksRes.backlinks : []
            });
          }
        }
      } catch (error) {
        console.error("Failed to load note:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-background text-muted-foreground">
        <div className="animate-pulse tracking-widest uppercase text-[10px] font-bold">Loading Note...</div>
      </div>
    );
  }

  if (!data) return null;

  if (isPreview) {
    return (
      <div className="h-screen bg-background overflow-hidden">
        <Editor 
          slug={slug} 
          initialContent={data.content} 
          lastUpdated={data.lastUpdated}
          allNotes={data.notes} 
          graphData={data.graphData} 
          backlinks={data.backlinks} 
          allTags={data.tags}
          allMentions={data.mentions}
          allProjects={data.projects}
          forceReadOnly={true}
        />
      </div>
    );
  }

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
        allProjects={data.projects}
      />
    </LayoutWrapper>
  );
}

