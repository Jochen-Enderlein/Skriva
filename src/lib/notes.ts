import fs from 'fs/promises';
import fssync from 'fs';
import path from 'path';
import os from 'os';

// Path to store the global configuration
const GLOBAL_CONFIG_PATH = path.join(os.homedir(), '.skriva-config.json');

export function getStoredVaultPath(): string | null {
  try {
    if (fssync.existsSync(GLOBAL_CONFIG_PATH)) {
      const config = JSON.parse(fssync.readFileSync(GLOBAL_CONFIG_PATH, 'utf-8'));
      return config.vaultPath;
    }
  } catch (error) {
    console.error('Error reading global config:', error);
  }
  return null;
}

export function setStoredVaultPath(vaultPath: string) {
  fssync.writeFileSync(GLOBAL_CONFIG_PATH, JSON.stringify({ vaultPath }, null, 2));
}

function getNotesPath(): string {
  const vaultPath = getStoredVaultPath();
  if (!vaultPath) {
    // Fallback to internal assets if no vault is set yet
    return path.join(process.cwd(), 'assets/notes');
  }
  return vaultPath;
}

export interface NoteMetadata {
  title: string;
  slug: string;
  path: string;
  relativeDir: string;
}

export async function getNotes(dir: string = ''): Promise<NoteMetadata[]> {
  const notesBase = getNotesPath();
  const fullPath = path.join(notesBase, dir);
  
  if (!fssync.existsSync(fullPath)) return [];

  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    let notes: NoteMetadata[] = [];

    for (const entry of entries) {
      const relativePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const subNotes = await getNotes(relativePath);
        notes = [...notes, ...subNotes];
      } else if (entry.name.endsWith('.md') || entry.name.endsWith('.excalidraw')) {
        const isExcalidraw = entry.name.endsWith('.excalidraw');
        const title = isExcalidraw ? entry.name : entry.name.replace(/\.md$/, '');
        const slug = path.join(dir, isExcalidraw ? entry.name : title);
        notes.push({
          title,
          slug,
          path: entry.name,
          relativeDir: dir,
        });
      }
    }
    return notes;
  } catch (error) {
    console.error('Error reading notes:', error);
    return [];
  }
}

export async function getFolders(dir: string = ''): Promise<string[]> {
  const notesBase = getNotesPath();
  const fullPath = path.join(notesBase, dir);
  
  if (!fssync.existsSync(fullPath)) return [];

  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    let folders: string[] = dir ? [dir] : [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subFolders = await getFolders(path.join(dir, entry.name));
        folders = [...folders, ...subFolders];
      }
    }
    return folders;
  } catch (error) {
    return [];
  }
}

function getFilePathFromSlug(notesBase: string, slug: string): string {
  const decodedSlug = decodeURIComponent(slug);
  if (decodedSlug.endsWith('.md') || decodedSlug.endsWith('.excalidraw')) {
    return path.join(notesBase, decodedSlug);
  }
  return path.join(notesBase, `${decodedSlug}.md`);
}

export async function getNoteContent(slug: string): Promise<string> {
  try {
    const notesBase = getNotesPath();
    const filePath = getFilePathFromSlug(notesBase, slug);
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    console.error('Error reading note content:', error);
    throw new Error('Note not found');
  }
}

export async function saveNote(slug: string, content: string): Promise<void> {
  try {
    const notesBase = getNotesPath();
    const filePath = getFilePathFromSlug(notesBase, slug);
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  } catch (error) {
    console.error('Error saving note:', error);
    throw new Error('Failed to save note');
  }
}

export async function deleteFile(slug: string): Promise<void> {
  const notesBase = getNotesPath();
  const filePath = getFilePathFromSlug(notesBase, slug);
  await fs.unlink(filePath);
}

export async function deleteFolder(folderPath: string): Promise<void> {
  const notesBase = getNotesPath();
  const fullPath = path.join(notesBase, folderPath);
  await fs.rm(fullPath, { recursive: true, force: true });
}

export async function moveItem(oldSlug: string, newSlug: string): Promise<void> {
  const notesBase = getNotesPath();
  const oldPath = getFilePathFromSlug(notesBase, oldSlug);
  const newPath = getFilePathFromSlug(notesBase, newSlug);
  await fs.mkdir(path.dirname(newPath), { recursive: true });
  await fs.rename(oldPath, newPath);
}

export async function moveFolder(oldPath: string, newPath: string): Promise<void> {
  const notesBase = getNotesPath();
  const fullOldPath = path.join(notesBase, oldPath);
  const fullNewPath = path.join(notesBase, newPath);
  await fs.mkdir(path.dirname(fullNewPath), { recursive: true });
  await fs.rename(fullOldPath, fullNewPath);
}

export async function searchNotes(query: string): Promise<{ slug: string; title: string; snippet: string }[]> {
  const notes = await getNotes();
  const results: { slug: string; title: string; snippet: string }[] = [];
  const lowerQuery = query.toLowerCase();

  for (const note of notes) {
    const content = await getNoteContent(note.slug);
    const plainText = content.replace(/<[^>]*>/g, ' ');
    const lowerContent = plainText.toLowerCase();
    
    if (note.title.toLowerCase().includes(lowerQuery) || lowerContent.includes(lowerQuery)) {
      let snippet = '';
      const index = lowerContent.indexOf(lowerQuery);
      
      if (index !== -1) {
        const start = Math.max(0, index - 40);
        const end = Math.min(plainText.length, index + query.length + 40);
        snippet = `...${plainText.substring(start, end).replace(/\s+/g, ' ').trim()}...`;
      } else {
        snippet = plainText.substring(0, 80).replace(/\s+/g, ' ').trim() + '...';
      }

      results.push({
        slug: note.slug,
        title: note.title,
        snippet
      });
    }
  }

  return results;
}

export async function getBacklinks(targetTitle: string): Promise<{ title: string; slug: string; snippet: string }[]> {
  const notes = await getNotes();
  const backlinks: { title: string; slug: string; snippet: string }[] = [];

  for (const note of notes) {
    if (note.title === targetTitle) continue;

    const content = await getNoteContent(note.slug);
    const wikiLinkRegex = new RegExp(`\\[\\[${targetTitle}\\]\\]`, 'g');
    
    if (wikiLinkRegex.test(content)) {
      const index = content.indexOf(`[[${targetTitle}]]`);
      const start = Math.max(0, index - 50);
      const end = Math.min(content.length, index + targetTitle.length + 54);
      const snippet = content.substring(start, end).replace(/\n/g, ' ');

      backlinks.push({
        title: note.title,
        slug: note.slug,
        snippet: `...${snippet}...`,
      });
    }
  }

  return backlinks;
}

export async function getGraphData(): Promise<{ nodes: { id: string; title: string; type: 'note' | 'tag' }[]; links: { source: string; target: string }[] }> {
  const notes = await getNotes();
  const nodes: { id: string; title: string; type: 'note' | 'tag' }[] = notes.map(n => ({ id: n.slug, title: n.title, type: 'note' }));
  const links: { source: string; target: string }[] = [];
  const tagsFound = new Set<string>();

  for (const note of notes) {
    const content = await getNoteContent(note.slug);
    
    const wikiLinkRegex = /\[\[(.*?)(?:\|.*?)?\]\]/g;
    let match;
    while ((match = wikiLinkRegex.exec(content)) !== null) {
      const linkTarget = match[1];
      const targetNode = nodes.find(n => n.id === linkTarget || n.title === linkTarget);
      
      if (targetNode && targetNode.id !== note.slug) {
        links.push({ source: note.slug, target: targetNode.id });
      }
    }

    const tagRegex = /#(\w+)/g;
    let tagMatch;
    while ((tagMatch = tagRegex.exec(content)) !== null) {
      const tagName = tagMatch[1];
      const tagId = `tag:${tagName}`;
      tagsFound.add(tagName);
      links.push({ source: note.slug, target: tagId });
    }
  }

  tagsFound.forEach(tag => {
    nodes.push({ id: `tag:${tag}`, title: `#${tag}`, type: 'tag' });
  });

  return { nodes, links };
}

export async function getTags(): Promise<{ tag: string; count: number }[]> {
  const notes = await getNotes();
  const tagCounts: Record<string, number> = {};

  for (const note of notes) {
    const content = await getNoteContent(note.slug);
    const tagRegex = /#(\w+)/g;
    let match;
    
    while ((match = tagRegex.exec(content)) !== null) {
      const tag = match[1];
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  return Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}
