'use server';

import { 
  saveNote as saveNoteToFs, 
  deleteFile as deleteFileFromFs, 
  deleteFolder as deleteFolderFromFs,
  moveItem as moveItemInFs,
  moveFolder as moveFolderInFs,
  searchNotes,
  getStoredVaultPath,
  setStoredVaultPath,
  getNoteContent,
  getTemplates
} from '@/lib/notes';

export async function getTemplatesAction() {
  try {
    const templates = await getTemplates();
    return { success: true, templates };
  } catch (error) {
    return { success: false, error: 'Failed to load templates' };
  }
}
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

export async function createNoteAction(title: string, folder: string = '', templateSlug?: string) {
  try {
    const slug = path.join(folder, title);
    const isExcalidraw = title.toLowerCase().endsWith('.excalidraw');
    
    let content = '';
    
    if (templateSlug) {
      content = await getNoteContent(templateSlug);
    } else {
      content = isExcalidraw 
        ? JSON.stringify({
            type: "excalidraw",
            version: 2,
            source: "https://excalidraw.com",
            elements: [],
            appState: { viewBackgroundColor: "#121212" },
            files: {},
          })
        : `# ${title}\n\n`;
    }
    
    await saveNoteToFs(slug, content);
    revalidatePath('/');
    return { success: true, slug };
  } catch (error) {
    console.error('Action error creating note:', error);
    return { success: false, error: 'Failed to create note' };
  }
}

export async function createDailyNoteAction() {
  try {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const title = dateStr;
    const folder = 'Inbox';
    const slug = path.join(folder, title);
    
    // Check if it already exists
    const notesBase = getStoredVaultPath() || path.join(process.cwd(), 'assets/notes');
    const filePath = path.join(notesBase, `${slug}.md`);
    
    try {
      await fs.access(filePath);
      // Already exists, just return the slug
      return { success: true, slug, alreadyExists: true };
    } catch {
      // Doesn't exist, create it
      const content = `# ${title}\n\n`;
      await saveNoteToFs(slug, content);
      revalidatePath('/');
      return { success: true, slug, alreadyExists: false };
    }
  } catch (error) {
    console.error('Action error creating daily note:', error);
    return { success: false, error: 'Failed to create daily note' };
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

export async function moveFolderAction(oldPath: string, newPath: string) {
  try {
    await moveFolderInFs(oldPath, newPath);
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to move folder' };
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

export async function importItemsAction(paths: string[], targetFolder: string = '') {
  try {
    const { getStoredVaultPath } = await import('@/lib/notes');
    const vaultPath = getStoredVaultPath() || path.join(process.cwd(), 'assets/notes');
    const destBase = path.join(vaultPath, targetFolder);

    for (const sourcePath of paths) {
      const fileName = path.basename(sourcePath);
      const destPath = path.join(destBase, fileName);
      
      // Use fs.cp for recursive copy (Node.js 16.7.0+)
      // If it fails, it might be an older Node version, but usually in Electron it's fine.
      await fs.cp(sourcePath, destPath, { recursive: true });
    }

    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Action error importing items:', error);
    return { success: false, error: 'Failed to import items' };
  }
}

export async function getReadmeAction() {
  try {
    const readmePath = path.join(process.cwd(), 'README.md');
    const content = await fs.readFile(readmePath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    console.error('Action error getting README:', error);
    return { success: false, error: 'Failed to get README content' };
  }
}

export async function getRandomNoteAction() {
  try {
    const { getNotes } = await import('@/lib/notes');
    const notes = await getNotes();
    if (notes.length === 0) return { success: false, error: 'No notes found' };
    const randomIndex = Math.floor(Math.random() * notes.length);
    return { success: true, slug: notes[randomIndex].slug };
  } catch (error) {
    return { success: false, error: 'Failed to pick random note' };
  }
}
