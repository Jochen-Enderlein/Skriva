'use server';

import { 
  saveNote as saveNoteToFs, 
  deleteFile as deleteFileFromFs, 
  deleteFolder as deleteFolderFromFs,
  moveItem as moveItemInFs,
  searchNotes,
  getStoredVaultPath,
  setStoredVaultPath,
  getNoteContent
} from '@/lib/notes';
import { revalidatePath } from 'next/cache';
import fs from 'fs/promises';
import path from 'path';

const NOTES_PATH = path.join(process.cwd(), 'assets/notes');

export async function getNoteContentAction(slug: string) {
  try {
    const content = await getNoteContent(slug);
    return { success: true, content };
  } catch (error) {
    console.error('Action error getting note content:', error);
    return { success: false, error: 'Failed to get note content' };
  }
}

export async function saveNoteAction(slug: string, content: string) {
  try {
    if (content === undefined || content === null) {
      console.error('saveNoteAction: content is undefined or null for slug:', slug);
      return { success: false, error: 'Content is required' };
    }
    await saveNoteToFs(slug, content);
    return { success: true };
  } catch (error) {
    console.error('Action error saving note:', error);
    return { success: false, error: 'Failed to save note' };
  }
}

export async function createNoteAction(title: string, folder: string = '') {
  try {
    const slug = path.join(folder, title);
    const isExcalidraw = title.toLowerCase().endsWith('.excalidraw');
    const content = isExcalidraw 
      ? JSON.stringify({
          type: "excalidraw",
          version: 2,
          source: "https://excalidraw.com",
          elements: [],
          appState: { viewBackgroundColor: "#121212" },
          files: {},
        })
      : `# ${title}\n\n`;
    await saveNoteToFs(slug, content);
    revalidatePath('/');
    return { success: true, slug };
  } catch (error) {
    console.error('Action error creating note:', error);
    return { success: false, error: 'Failed to create note' };
  }
}

export async function createFolderAction(folderName: string, parentFolder: string = '') {
  try {
    const { getStoredVaultPath } = await import('@/lib/notes');
    const vaultPath = getStoredVaultPath() || path.join(process.cwd(), 'assets/notes');
    const fullPath = path.join(vaultPath, parentFolder, folderName);
    await fs.mkdir(fullPath, { recursive: true });
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Action error creating folder:', error);
    return { success: false, error: 'Failed to create folder' };
  }
}

export async function deleteFileAction(slug: string) {
  try {
    await deleteFileFromFs(slug);
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to delete file' };
  }
}

export async function deleteFolderAction(folderPath: string) {
  try {
    await deleteFolderFromFs(folderPath);
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to delete folder' };
  }
}

export async function moveItemAction(oldSlug: string, newSlug: string) {
  try {
    await moveItemInFs(oldSlug, newSlug);
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to move item' };
  }
}

export async function searchNotesAction(query: string) {
  try {
    const results = await searchNotes(query);
    return { success: true, results };
  } catch (error) {
    console.error('Search action error:', error);
    return { success: false, error: 'Search failed' };
  }
}

export async function getVaultPathAction() {
  return getStoredVaultPath();
}

export async function setVaultPathAction(vaultPath: string) {
  setStoredVaultPath(vaultPath);
  revalidatePath('/');
  return { success: true };
}
