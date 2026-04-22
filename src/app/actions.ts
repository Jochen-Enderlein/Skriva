'use server';

import { 
  saveNote as saveNoteToFs, 
  deleteFile as deleteFileFromFs, 
  deleteFolder as deleteFolderFromFs,
  moveItem as moveItemInFs,
  searchNotes
} from '@/lib/notes';
import { revalidatePath } from 'next/cache';
import fs from 'fs/promises';
import path from 'path';

const NOTES_PATH = path.join(process.cwd(), 'assets/notes');

export async function saveNoteAction(slug: string, content: string) {
  try {
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
    await saveNoteToFs(slug, `# ${title}\n\n`);
    revalidatePath('/');
    return { success: true, slug };
  } catch (error) {
    console.error('Action error creating note:', error);
    return { success: false, error: 'Failed to create note' };
  }
}

export async function createFolderAction(folderName: string, parentFolder: string = '') {
  try {
    const fullPath = path.join(NOTES_PATH, parentFolder, folderName);
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
