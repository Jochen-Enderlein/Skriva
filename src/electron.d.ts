import { NoteMetadata } from "./lib/types";

declare global {
  interface Window {
    electron?: {
      selectFolder: () => Promise<string | null>;
      getVaultPath: () => Promise<string | null>;
      setVaultPath: (path: string) => Promise<boolean>;
      saveNoteAsPdf: (title: string) => Promise<boolean>;
      minimizeWindow: () => Promise<void>;
      maximizeWindow: () => Promise<void>;
      closeWindow: () => Promise<void>;
      
      // Filesystem operations
      getNotes: (dir?: string, includeTemplates?: boolean) => Promise<NoteMetadata[]>;
      getNoteContent: (slug: string) => Promise<string>;
      saveNote: (slug: string, content: string) => Promise<boolean>;
      deleteFile: (slug: string) => Promise<boolean>;
      deleteFolder: (folderPath: string) => Promise<boolean>;
      moveItem: (oldSlug: string, newSlug: string) => Promise<boolean>;
      getFolders: (dir: string) => Promise<string[]>;
      getGraphData: () => Promise<any>;
      getTags: () => Promise<any[]>;
      getMentions: () => Promise<any[]>;
      getTemplates: () => Promise<NoteMetadata[]>;
      getBacklinks: (title: string) => Promise<any[]>;
      searchNotes: (query: string) => Promise<any[]>;
      createFolder: (folderName: string, parentFolder: string) => Promise<boolean>;
      
      platform: string;
    };
  }
}

export {};
