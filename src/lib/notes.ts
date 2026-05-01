import fs from 'fs/promises';
import fssync from 'fs';
import path from 'path';
import os from 'os';
import Fuse from 'fuse.js';
import matter from 'gray-matter';

// Path to store the global configuration
const GLOBAL_CONFIG_PATH = path.join(os.homedir(), '.skriva-config.json');

export interface AppConfig {
  vaultPath?: string;
  aiProvider?: string;
  aiApiKey?: string;
  aiBaseUrl?: string;
  aiModel?: string;
}

export function getConfig(): AppConfig {
  try {
    if (fssync.existsSync(GLOBAL_CONFIG_PATH)) {
      return JSON.parse(fssync.readFileSync(GLOBAL_CONFIG_PATH, 'utf-8'));
    }
  } catch (error) {
    console.error('Error reading global config:', error);
  }
  return {};
}

export function updateConfig(newConfig: Partial<AppConfig>) {
  const config = getConfig();
  const updated = { ...config, ...newConfig };
  fssync.writeFileSync(GLOBAL_CONFIG_PATH, JSON.stringify(updated, null, 2));
}

export function getStoredVaultPath(): string | null {
  return getConfig().vaultPath || null;
}

export function setStoredVaultPath(vaultPath: string) {
  updateConfig({ vaultPath });
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
  lastUpdated?: string;
}

export interface Task {
  text: string;
  checked: boolean;
  noteSlug: string;
  noteTitle: string;
  line: number;
}

export async function getTasksFromFolder(dir: string = ''): Promise<Task[]> {
  const notes = await getNotes(dir);
  const allTasks: Task[] = [];

  for (const note of notes) {
    if (!note.slug.endsWith('.md') && !fssync.existsSync(getFilePathFromSlug(getNotesPath(), note.slug))) {
       // getNotes already filters, but let's be safe
    }
    
    try {
      const content = await getNoteContent(note.slug);
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        const taskMatch = line.match(/^(\s*[-*+]\s+\[)([ xX])(\].*)$/);
        if (taskMatch) {
          allTasks.push({
            text: taskMatch[3].substring(1).trim(),
            checked: taskMatch[2].toLowerCase() === 'x',
            noteSlug: note.slug,
            noteTitle: note.title,
            line: index + 1
          });
        }
      });
    } catch (e) {
      console.error(`Error reading tasks from ${note.slug}:`, e);
    }
  }

  // Sort: unchecked (false) first, then checked (true)
  return allTasks.sort((a, b) => {
    if (a.checked === b.checked) return 0;
    return a.checked ? 1 : -1;
  });
}

export async function toggleTask(noteSlug: string, line: number, checked: boolean): Promise<void> {
  const content = await getNoteContent(noteSlug);
  const lines = content.split('\n');
  
  if (line > 0 && line <= lines.length) {
    const lineIndex = line - 1;
    const taskMatch = lines[lineIndex].match(/^(\s*[-*+]\s+\[)([ xX])(\].*)$/);
    
    if (taskMatch) {
      lines[lineIndex] = taskMatch[1] + (checked ? 'x' : ' ') + taskMatch[3];
      await saveNote(noteSlug, lines.join('\n'));
    }
  }
}

export async function getNotes(dir: string = '', includeTemplates: boolean = false): Promise<NoteMetadata[]> {
  const notesBase = getNotesPath();
  const fullPath = path.join(notesBase, dir);
  
  // Ignore .templates folder in normal note listing unless explicitly requested
  if (!includeTemplates && (dir === '.templates' || dir.startsWith('.templates/'))) return [];
  if (!fssync.existsSync(fullPath)) return [];

  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    let notes: NoteMetadata[] = [];

    for (const entry of entries) {
      if (!includeTemplates && entry.name === '.templates' && dir === '') continue;
      
      const relativePath = path.join(dir, entry.name);
      const fullEntryPath = path.join(fullPath, entry.name);

      if (entry.isDirectory()) {
        const subNotes = await getNotes(relativePath, includeTemplates);
        notes = [...notes, ...subNotes];
      } else if (entry.name.endsWith('.md') || entry.name.endsWith('.excalidraw')) {
        const isExcalidraw = entry.name.endsWith('.excalidraw');
        const title = isExcalidraw ? entry.name : entry.name.replace(/\.md$/, '');
        const slug = path.join(dir, isExcalidraw ? entry.name : title);
        
        let lastUpdated;
        try {
          const stats = fssync.statSync(fullEntryPath);
          lastUpdated = stats.mtime.toISOString();
        } catch (e) {
          // ignore
        }

        notes.push({
          title,
          slug,
          path: entry.name,
          relativeDir: dir,
          lastUpdated,
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
  
  // Ignore .templates folder
  if (dir === '.templates' || dir.startsWith('.templates/')) return [];
  if (!fssync.existsSync(fullPath)) return [];

  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    let folders: string[] = dir ? [dir] : [];

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== '.templates') {
        const subFolders = await getFolders(path.join(dir, entry.name));
        folders = [...folders, ...subFolders];
      }
    }
    return folders;
  } catch (error) {
    return [];
  }
}

export async function getTemplates(): Promise<NoteMetadata[]> {
  const notesBase = getNotesPath();
  const templatesPath = path.join(notesBase, '.templates');
  
  try {
    if (!fssync.existsSync(templatesPath)) {
      await fs.mkdir(templatesPath, { recursive: true });
    }
    
    const entries = await fs.readdir(templatesPath, { withFileTypes: true });
    return entries
      .filter(e => e.isFile() && e.name.endsWith('.md'))
      .map(e => ({
        title: e.name.replace(/\.md$/, ''),
        slug: `.templates/${e.name.replace(/\.md$/, '')}`,
        path: e.name,
        relativeDir: '.templates',
      }));
  } catch (e) {
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

/**
 * Returns content and filesystem modification time
 */
export async function getNoteWithStats(slug: string): Promise<{ content: string, lastUpdated: string }> {
  const notesBase = getNotesPath();
  const filePath = getFilePathFromSlug(notesBase, slug);
  const [content, stats] = await Promise.all([
    fs.readFile(filePath, 'utf-8'),
    fs.stat(filePath)
  ]);
  return { content, lastUpdated: stats.mtime.toISOString() };
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

export async function saveNoteWithProperties(slug: string, content: string, data: Record<string, any>): Promise<void> {
  try {
    const notesBase = getNotesPath();
    const filePath = getFilePathFromSlug(notesBase, slug);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    
    // Ensure content doesn't have duplicate frontmatter
    const cleanContent = content.replace(/^\s*---[\s\S]*?---\s*/, '');
    
    const fileContent = matter.stringify(cleanContent, data);
    await fs.writeFile(filePath, fileContent, 'utf-8');
  } catch (error) {
    console.error('Error saving note with properties:', error);
    throw new Error('Failed to save note with properties');
  }
}

export function getDefaultProperties(title: string): Record<string, any> {
  const now = new Date().toISOString();
  let author = 'User';
  try {
    author = os.userInfo().username || 'User';
  } catch (e) {
    // ignore
  }
  
  return {
    title: title.replace(/\.(md|excalidraw)$/i, ''),
    created: now,
    last_updated: now,
    author: author
  };
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
  const searchData: { slug: string; title: string; content: string }[] = [];

  for (const note of notes) {
    try {
      const content = await getNoteContent(note.slug);
      const plainText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      searchData.push({
        slug: note.slug,
        title: note.title,
        content: plainText
      });
    } catch (e) {
      // Skip notes that can't be read
    }
  }

  const fuse = new Fuse(searchData, {
    keys: ['title', 'content'],
    threshold: 0.4,
    includeMatches: true,
    minMatchCharLength: 2,
  });

  const fuseResults = fuse.search(query);
  
  return fuseResults.map(result => {
    const { item, matches } = result;
    let snippet = '';
    
    // Find a snippet from content if possible
    const contentMatch = matches?.find(m => m.key === 'content');
    if (contentMatch && contentMatch.indices.length > 0) {
      const [start, end] = contentMatch.indices[0];
      const snippetStart = Math.max(0, start - 40);
      const snippetEnd = Math.min(item.content.length, end + 40);
      snippet = `...${item.content.substring(snippetStart, snippetEnd).trim()}...`;
    } else {
      snippet = item.content.substring(0, 80).trim() + '...';
    }

    return {
      slug: item.slug,
      title: item.title,
      snippet
    };
  });
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

export async function getGraphData(): Promise<{ nodes: { id: string; title: string; type: 'note' | 'tag' | 'mention' }[]; links: { source: string; target: string }[] }> {
  const notes = await getNotes();
  const nodes: { id: string; title: string; type: 'note' | 'tag' | 'mention' }[] = notes.map(n => ({ id: n.slug, title: n.title, type: 'note' }));
  const links: { source: string; target: string }[] = [];
  const tagsFound = new Set<string>();
  const mentionsFound = new Set<string>();

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

    const mentionRegex = /@(\w+)/g;
    let mentionMatch;
    while ((mentionMatch = mentionRegex.exec(content)) !== null) {
      const mentionName = mentionMatch[1];
      const mentionId = `mention:${mentionName}`;
      mentionsFound.add(mentionName);
      links.push({ source: note.slug, target: mentionId });
    }
  }

  tagsFound.forEach(tag => {
    nodes.push({ id: `tag:${tag}`, title: `#${tag}`, type: 'tag' });
  });

  mentionsFound.forEach(mention => {
    nodes.push({ id: `mention:${mention}`, title: `@${mention}`, type: 'mention' });
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

export async function getMentions(): Promise<{ mention: string; count: number }[]> {
  const notes = await getNotes();
  const mentionCounts: Record<string, number> = {};

  for (const note of notes) {
    const content = await getNoteContent(note.slug);
    const mentionRegex = /@(\w+)/g;
    let match;
    
    while ((match = mentionRegex.exec(content)) !== null) {
      const mention = match[1];
      mentionCounts[mention] = (mentionCounts[mention] || 0) + 1;
    }
  }

  return Object.entries(mentionCounts)
    .map(([mention, count]) => ({ mention, count }))
    .sort((a, b) => b.count - a.count);
}
