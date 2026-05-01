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
  getTemplates,
  getTasksFromFolder,
  toggleTask,
  saveNoteWithProperties,
  getDefaultProperties
} from '@/lib/notes';

export async function saveNoteWithPropertiesAction(slug: string, content: string, data: Record<string, any>) {
  try {
    await saveNoteWithProperties(slug, content, data);
    return { success: true };
  } catch (error) {
    console.error('Action error saving note with properties:', error);
    return { success: false, error: 'Failed to save note properties' };
  }
}

export async function toggleTaskAction(noteSlug: string, line: number, checked: boolean) {
  try {
    await toggleTask(noteSlug, line, checked);
    return { success: true };
  } catch (error) {
    console.error('Action error toggling task:', error);
    return { success: false, error: 'Failed to toggle task' };
  }
}

export async function getTasksFromFolderAction(folderPath: string) {
  try {
    const tasks = await getTasksFromFolder(folderPath);
    return { success: true, tasks };
  } catch (error) {
    console.error('Action error getting tasks:', error);
    return { success: false, error: 'Failed to get tasks' };
  }
}

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

    if (templateSlug) {
      const templateContent = await getNoteContent(templateSlug);
      if (!isExcalidraw) {
        const parsed = matter(templateContent);
        const defaultProps = getDefaultProperties(title);
        const updatedData = { ...defaultProps, ...parsed.data };
        await saveNoteWithProperties(slug, parsed.content, updatedData);
      } else {
        await saveNoteToFs(slug, templateContent);
      }
    } else {
      if (isExcalidraw) {
        const content = JSON.stringify({
          type: "excalidraw",
          version: 2,
          source: "https://excalidraw.com",
          elements: [],
          appState: { viewBackgroundColor: "#121212" },
          files: {},
        });
        await saveNoteToFs(slug, content);
      } else {
        const content = `# ${title}\n\n`;
        const defaultProps = getDefaultProperties(title);
        await saveNoteWithProperties(slug, content, defaultProps);
      }
    }

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
      const defaultProps = getDefaultProperties(title);
      await saveNoteWithProperties(slug, content, defaultProps);
      revalidatePath('/');
      return { success: true, slug };
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

export async function getConfigAction() {
  const { getConfig } = await import('@/lib/notes');
  return { success: true, config: getConfig() };
}

export async function updateConfigAction(newConfig: any) {
  const { updateConfig } = await import('@/lib/notes');
  try {
    updateConfig(newConfig);
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to update config' };
  }
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

export async function summarizeNoteAction(content: string) {
  try {
    const { getConfig } = await import('@/lib/notes');
    const config = getConfig();
    const provider = config.aiProvider || 'openai';
    const apiKey = config.aiApiKey || '';
    const baseUrl = config.aiBaseUrl || '';
    const model = config.aiModel || '';

    if (!apiKey && provider !== 'ollama' && provider !== 'custom') {
      return { success: false, error: 'API Key missing for ' + provider };
    }

    const prompt = `Please summarize the following note content concisely in its original language:\n\n${content}`;
    let summary = '';

    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: model || 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }]
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      summary = data.choices[0].message.content;
    } else if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: model || 'claude-3-5-sonnet-20240620',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      summary = data.content[0].text;
    } else if (provider === 'google') {
      const gModel = model || 'gemini-1.5-flash';
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${gModel}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      summary = data.candidates[0].content.parts[0].text;
    } else if (provider === 'ollama') {
      const oBase = baseUrl || 'http://localhost:11434';
      const res = await fetch(`${oBase.replace(/\/$/, '')}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model || 'llama3',
          prompt: prompt,
          stream: false
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      summary = data.response;
    } else if (provider === 'custom') {
      const cBase = baseUrl || 'http://localhost:8080/v1';
      const res = await fetch(`${cBase.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: model || 'default',
          messages: [{ role: 'user', content: prompt }]
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      summary = data.choices[0].message.content;
    } else {
      return { success: false, error: 'Unknown provider' };
    }

    return { success: true, summary };
  } catch (error: any) {
    console.error('AI Summary error:', error);
    return { success: false, error: error.message || 'Failed to generate summary' };
  }
}
