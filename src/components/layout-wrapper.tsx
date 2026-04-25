'use client';

import * as React from 'react';
import {
  Sidebar as SidebarUI,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarRail,
  SidebarMenuSub,
} from "@/components/ui/sidebar";
import { CommandPalette } from "./command-palette";
import { TabList } from "./tab-list";
import { NoteMetadata } from "@/lib/notes";
import { 
  FileText, 
  FolderPlus,
  Hash,
  AtSign,
  Plus,  Share2, 
  MoreHorizontal, 
  Trash2, 
  Pencil,
  ChevronDown,
  Folder,
  Search,
  Library,
  Info,
  Minus,
  Square,
  X as CloseIcon
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  createNoteAction, 
  createFolderAction, 
  deleteFileAction, 
  deleteFolderAction,
  moveItemAction,
  moveFolderAction,
  searchNotesAction,
  setVaultPathAction,
  getVaultPathAction,
  getTemplatesAction
} from "@/app/actions";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ThemeToggle } from "./theme-toggle";
import { useDebounce } from '@/hooks/use-debounce';
import { useTabs } from "./tabs-context";
import { cn } from "@/lib/utils";
import { DropZone } from "./drop-zone";
import { Layout } from "lucide-react";

interface LayoutWrapperProps {
  notes: NoteMetadata[];
  folders: string[];
  children: React.ReactNode;
}

type DialogState = {
  type: 'create-note' | 'create-excalidraw' | 'create-folder' | 'delete-file' | 'delete-folder' | 'rename' | 'move' | null;
  target?: string;
  parentFolder?: string;
  itemType?: 'note' | 'folder';
  templateSlug?: string;
};

type TreeNode = {
  name: string;
  path: string;
  notes: NoteMetadata[];
  children: Record<string, TreeNode>;
};

type SearchResult = {
  slug: string;
  title: string;
  snippet: string;
};

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
      platform: string;
    };
  }
}

export function LayoutWrapper({ notes, folders, children }: LayoutWrapperProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isGraphOpen, setIsGraphOpen } = useTabs();
  const [dialog, setDialog] = React.useState<DialogState>({ type: null });
  const [inputValue, setInputValue] = React.useState('');
  const [searchQuery, setSearchQuery] = React.useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [searchResults, setSearchResults] = React.useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);
  const [vaultPath, setVaultPath] = React.useState<string | null>(null);
  const [isVaultLoading, setIsVaultLoading] = React.useState(true);
  const [dragOverFolder, setDragOverFolder] = React.useState<string | null>(null);
  const [helpOpen, setHelpOpen] = React.useState(false);

  React.useEffect(() => {
    const loadVault = async () => {
      const path = await getVaultPathAction();
      setVaultPath(path);
      setIsVaultLoading(false);
    };
    loadVault();
  }, []);

  const handleSelectVault = async () => {
    if (window.electron) {
      const path = await window.electron.selectFolder();
      if (path) {
        await setVaultPathAction(path);
        setVaultPath(path);
        router.refresh();
      }
    } else {
      toast.error("Electron not detected");
    }
  };

  const fullTree = React.useMemo(() => {
    const root: TreeNode = { name: 'Root', path: '', notes: [], children: {} };
    folders.forEach(f => {
      if (!f) return;
      const parts = f.split('/');
      let current = root;
      let currentPath = '';
      parts.forEach(part => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        if (!current.children[part]) {
          current.children[part] = { name: part, path: currentPath, notes: [], children: {} };
        }
        current = current.children[part];
      });
    });
    notes
      .filter(note => !note.relativeDir.startsWith('.templates'))
      .forEach(note => {
      if (!note.relativeDir) {
        root.notes.push(note);
      } else {
        const parts = note.relativeDir.split('/');
        let current = root;
        parts.forEach(part => {
          if (!current.children[part]) {
            const parentPath = current.path ? `${current.path}/${part}` : part;
            current.children[part] = { name: part, path: parentPath, notes: [], children: {} };
          }
          current = current.children[part];
        });
        current.notes.push(note);
      }
    });
    return root;
  }, [notes, folders]);

  const templateList = React.useMemo(() => {
    return notes.filter(note => note.relativeDir.startsWith('.templates'));
  }, [notes]);

  React.useEffect(() => {
    const performSearch = async () => {
      if (debouncedSearch.length < 2) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }
      setIsSearching(true);
      const res = await searchNotesAction(debouncedSearch);
      if (res.success && res.results) {
        setSearchResults(res.results);
      }
    };
    performSearch();
  }, [debouncedSearch]);

  const closeDialog = () => {
    setDialog({ type: null });
    setInputValue('');
    setIsPending(false);
  };

  const handleConfirm = async () => {
    if (isPending) return;
    setIsPending(true);
    try {
      switch (dialog.type) {
        case 'create-note':
          const noteRes = await createNoteAction(inputValue, dialog.parentFolder || '', dialog.templateSlug);
          if (noteRes.success) {
            toast.success(`Note "${inputValue}" created`);
            router.push(`/note/${noteRes.slug}`);
            closeDialog();
          }
          break;
        case 'create-excalidraw':
          const excalidrawTitle = inputValue.toLowerCase().endsWith('.excalidraw') ? inputValue : `${inputValue}.excalidraw`;
          const excalidrawRes = await createNoteAction(excalidrawTitle, dialog.parentFolder || '');
          if (excalidrawRes.success) {
            toast.success(`Excalidraw drawing "${excalidrawTitle}" created`);
            router.push(`/note/${excalidrawRes.slug}`);
            closeDialog();
          }
          break;
        case 'create-folder':
          const folderRes = await createFolderAction(inputValue, dialog.parentFolder || '');
          if (folderRes.success) {
            toast.success(`Folder "${inputValue}" created`);
            closeDialog();
          }
          break;
        case 'delete-file':
          if (dialog.target) {
            const delFileRes = await deleteFileAction(dialog.target);
            if (delFileRes.success) {
              toast.success('Note deleted');
              if (pathname === `/note/${dialog.target}`) router.push('/');
              closeDialog();
            }
          }
          break;
        case 'delete-folder':
          if (dialog.target) {
            const delFolderRes = await deleteFolderAction(dialog.target);
            if (delFolderRes.success) {
              toast.success('Folder deleted');
              closeDialog();
            }
          }
          break;
        case 'rename':
          if (dialog.target) {
            const parts = dialog.target.split('/');
            parts.pop();
            const parentPath = parts.join('/');
            
            // For files, we might need to ensure the extension is preserved if it was present,
            // but the title we set in inputValue already strips the .md extension. 
            // The moveItemAction backend automatically appends .md if not present.
            // For .excalidraw files, we need to make sure the extension is kept if it was an excalidraw file.
            let newName = inputValue;
            if (dialog.itemType !== 'folder' && dialog.target.endsWith('.excalidraw') && !newName.endsWith('.excalidraw')) {
              newName = `${newName}.excalidraw`;
            }
            
            const newPath = parentPath ? `${parentPath}/${newName}` : newName;

            const renameRes = dialog.itemType === 'folder' 
              ? await moveFolderAction(dialog.target, newPath) 
              : await moveItemAction(dialog.target, newPath);
              
            if (renameRes.success) {
              toast.success('Item renamed');
              if (dialog.itemType !== 'folder') {
                 router.push(`/note/${encodeURIComponent(newPath)}`);
              }
              closeDialog();
            }
          }
          break;
        case 'move':
          if (dialog.target) {
            const targetFolder = inputValue;
            const sourceName = dialog.target.split('/').pop() || '';
            const newPath = targetFolder ? `${targetFolder}/${sourceName}` : sourceName;

            if (dialog.target === newPath || dialog.target === targetFolder) {
              closeDialog();
              return;
            }

            if (dialog.itemType === 'folder' && targetFolder.startsWith(`${dialog.target}/`)) {
              toast.error("Cannot move a folder into its own subfolder");
              setIsPending(false);
              return;
            }

            const moveRes = dialog.itemType === 'folder'
              ? await moveFolderAction(dialog.target, newPath)
              : await moveItemAction(dialog.target, newPath);

            if (moveRes.success) {
              toast.success('Item moved');
              router.refresh();
              closeDialog();
            } else {
              toast.error('Failed to move item');
            }
          }
          break;
      }
    } catch (error) {
      toast.error('Action failed');
    } finally {
      setIsPending(false);
    }
  };

  const handleFolderDrop = async (e: React.DragEvent, targetFolder: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolder(null);
    
    // Check for internal move first
    const internalMoveData = e.dataTransfer.getData('application/x-skriva-item');
    if (internalMoveData) {
      const { path: sourcePath, type } = JSON.parse(internalMoveData);
      
      // Prevent dropping onto itself or its own parent
      const sourceName = sourcePath.split('/').pop();
      const newPath = targetFolder ? `${targetFolder}/${sourceName}` : sourceName;
      
      if (sourcePath === newPath || sourcePath === targetFolder) return;
      
      // Prevent moving a folder into its own subfolder
      if (type === 'folder' && targetFolder.startsWith(`${sourcePath}/`)) {
        toast.error("Cannot move a folder into its own subfolder");
        return;
      }

      const toastId = toast.loading(`Moving ${sourceName}...`);
      try {
        const res = type === 'folder' 
          ? await moveFolderAction(sourcePath, newPath)
          : await moveItemAction(sourcePath, newPath);
          
        if (res.success) {
          toast.success(`Moved to ${targetFolder || 'Root'}`, { id: toastId });
          router.refresh();
        } else {
          toast.error(res.error || "Move failed", { id: toastId });
        }
      } catch (error) {
        toast.error("Move error", { id: toastId });
      }
      return;
    }

    // Fallback to external file import
    const files = Array.from(e.dataTransfer.files) as (File & { path?: string })[];
    if (files.length === 0) return;

    const paths = files.map(f => f.path).filter((p): p is string => !!p);
    if (paths.length === 0) {
      toast.error("Could not determine file paths.");
      return;
    }

    const toastId = toast.loading(`Importing to ${targetFolder || 'Root'}...`);
    try {
      const res = await importItemsAction(paths, targetFolder);
      if (res.success) {
        toast.success(`Imported to ${targetFolder || 'Root'}`, { id: toastId });
        router.refresh();
      } else {
        toast.error(res.error || "Import failed", { id: toastId });
      }
    } catch (error) {
      toast.error("Import error", { id: toastId });
    }
  };

  const renderTree = (node: TreeNode) => {
    const isRoot = node.name === 'Root';
    return (
      <React.Fragment key={node.path || 'root'}>
        {!isRoot && (
          <SidebarMenuItem 
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              e.dataTransfer.setData('application/x-skriva-item', JSON.stringify({ path: node.path, type: 'folder' }));
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverFolder(node.path); }}
            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverFolder(null); }}
            onDrop={(e) => handleFolderDrop(e, node.path)}
            className={cn(
              "transition-colors rounded-md cursor-grab active:cursor-grabbing",
              dragOverFolder === node.path && "bg-primary/20 ring-1 ring-primary"
            )}
          >
            <Collapsible defaultOpen className="group/collapsible">
              <div>
                <div className="flex items-center group/item pr-2">
                  <CollapsibleTrigger render={<SidebarMenuButton render={<div />} className="flex-1 cursor-pointer" />}>
                    <ChevronDown className="h-3 w-3 opacity-30 transition-transform group-data-[state=closed]/collapsible:-rotate-90" />
                    <Folder className="h-4 w-4 opacity-50" />
                    <span className="truncate font-medium text-[13px]">{node.name}</span>
                  </CollapsibleTrigger>
                  
                  <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                    <button 
                      onClick={() => setDialog({ type: 'create-note', parentFolder: node.path })}
                      className="hover:bg-white/10 p-1 rounded transition-colors"
                      title="New Note"
                    >
                      <Plus className="h-3 w-3 opacity-50 hover:opacity-100" />
                    </button>
                    <button 
                      onClick={() => setDialog({ type: 'create-excalidraw', parentFolder: node.path })}
                      className="hover:bg-white/10 p-1 rounded transition-colors"
                      title="New Excalidraw"
                    >
                      <Pencil className="h-3 w-3 opacity-50 hover:opacity-100" />
                    </button>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger className="hover:bg-white/10 p-1 rounded transition-colors">
                        <MoreHorizontal className="h-3 w-3 opacity-30" />
                      </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40 bg-popover border-border text-popover-foreground">
                      <DropdownMenuItem onClick={() => setDialog({ type: 'create-note', parentFolder: node.path })}>
                        <Plus className="mr-2 h-4 w-4" /> New Note
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDialog({ type: 'create-excalidraw', parentFolder: node.path })}>
                        <Pencil className="mr-2 h-4 w-4" /> New Excalidraw
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDialog({ type: 'create-folder', parentFolder: node.path })}>
                        <FolderPlus className="mr-2 h-4 w-4" /> New Subfolder
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setDialog({ type: 'rename', target: node.path, itemType: 'folder' }); setInputValue(node.name); }}>
                        <Pencil className="mr-2 h-4 w-4" /> Rename Folder
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setDialog({ type: 'move', target: node.path, itemType: 'folder' }); setInputValue(''); }}>
                        <Folder className="mr-2 h-4 w-4" /> Move Folder
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDialog({ type: 'delete-folder', target: node.path })} className="text-destructive focus:text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete Folder
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <CollapsibleContent>
                  <SidebarMenuSub className="ml-4 border-l border-border pl-2 min-w-max">
                    {Object.values(node.children).map(child => renderTree(child))}
                    {node.notes.map(note => (
                      <SidebarMenuItem 
                        key={note.slug}
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          e.dataTransfer.setData('application/x-skriva-item', JSON.stringify({ path: note.slug, type: 'note' }));
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        className="cursor-grab active:cursor-grabbing"
                      >
                        <div className="flex items-center group/note pr-2">
                          <SidebarMenuButton render={<Link href={`/note/${note.slug}`} />} isActive={pathname === `/note/${note.slug}`} className="flex-1">
                            <FileText className="h-3.5 w-3.5 opacity-40" />
                            <span className="truncate">{note.title}</span>
                          </SidebarMenuButton>
                          <DropdownMenu>
                            <DropdownMenuTrigger nativeButton={false} render={<SidebarMenuAction render={<div />} showOnHover className="opacity-0 group-hover/note:opacity-100"><MoreHorizontal /></SidebarMenuAction>} />
                            <DropdownMenuContent side="right" align="start" className="bg-popover border-border text-popover-foreground">
                              <DropdownMenuItem onClick={() => { setDialog({ type: 'rename', target: note.slug, itemType: 'note' }); setInputValue(note.title); }}>
                                <Pencil className="mr-2 h-4 w-4" /> Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setDialog({ type: 'move', target: note.slug, itemType: 'note' }); setInputValue(''); }}>
                                <Folder className="mr-2 h-4 w-4" /> Move
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setDialog({ type: 'delete-file', target: note.slug })} className="text-destructive focus:text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </div>
            </Collapsible>
          </SidebarMenuItem>
        )}
        {isRoot && (
          <>
            {Object.values(node.children).map(child => renderTree(child))}
            {node.notes.map(note => (
              <SidebarMenuItem 
                key={note.slug}
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  e.dataTransfer.setData('application/x-skriva-item', JSON.stringify({ path: note.slug, type: 'note' }));
                  e.dataTransfer.effectAllowed = 'move';
                }}
                className="cursor-grab active:cursor-grabbing"
              >
                 <div className="flex items-center group/note pr-2">
                  <SidebarMenuButton render={<Link href={`/note/${note.slug}`} />} isActive={pathname === `/note/${note.slug}`} className="flex-1">
                    <FileText className="h-3.5 w-3.5 opacity-40" />
                    <span className="truncate">{note.title}</span>
                  </SidebarMenuButton>
                  <DropdownMenu>
                    <DropdownMenuTrigger nativeButton={false} render={<SidebarMenuAction render={<div />} showOnHover className="opacity-0 group-hover/note:opacity-100"><MoreHorizontal /></SidebarMenuAction>} />
                    <DropdownMenuContent side="right" align="start" className="bg-popover border-border text-popover-foreground">
                      <DropdownMenuItem onClick={() => { setDialog({ type: 'rename', target: note.slug, itemType: 'note' }); setInputValue(note.title); }}>
                        <Pencil className="mr-2 h-4 w-4" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setDialog({ type: 'move', target: note.slug, itemType: 'note' }); setInputValue(''); }}>
                        <Folder className="mr-2 h-4 w-4" /> Move
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDialog({ type: 'delete-file', target: note.slug })} className="text-destructive focus:text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </SidebarMenuItem>
            ))}
          </>
        )}
      </React.Fragment>
    );
  };

  // Current Title logic
  const currentTitle = React.useMemo(() => {
    if (pathname === '/graph') return 'Graph View';
    if (pathname === '/tags') return 'Tags';
    if (pathname === '/mentions') return 'Mentions';
    if (pathname.startsWith('/note/')) {
      const parts = pathname.split('/');
      return decodeURIComponent(parts[parts.length - 1]);
    }
    return 'Library';
  }, [pathname]);

  const isMac = React.useMemo(() => {
    return typeof window !== 'undefined' && window.electron?.platform === 'darwin';
  }, []);

  const WindowControls = () => {
    if (typeof window === 'undefined' || !window.electron || isMac) return null;

    return (
      <div className="flex items-center no-drag ml-2 border-l border-border pl-2">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 hover:bg-white/5 no-drag" 
          onClick={() => {
            console.log('Minimize clicked');
            window.electron?.minimizeWindow();
          }}
        >
          <Minus className="h-3 w-3 opacity-50" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 hover:bg-white/5 no-drag" 
          onClick={() => {
            console.log('Maximize clicked');
            window.electron?.maximizeWindow();
          }}
        >
          <Square className="h-3 w-3 opacity-50" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 hover:bg-red-500/20 hover:text-red-500 no-drag" 
          onClick={() => {
            console.log('Close clicked');
            window.electron?.closeWindow();
          }}
        >
          <CloseIcon className="h-3 w-3 opacity-50 hover:opacity-100" />
        </Button>
      </div>
    );
  };

  if (!vaultPath && !isVaultLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background text-foreground p-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tighter">Welcome to Skriva</h1>
            <p className="text-muted-foreground">Select a folder to use as your knowledge base.</p>
          </div>
          <Button onClick={handleSelectVault} size="lg" className="w-full h-12">
            Open or Create Vault
          </Button>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Your files stay on your computer.</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <DropZone>
        <CommandPalette notes={notes} />
      <Dialog open={dialog.type !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-[425px] bg-popover border-border text-popover-foreground">
          <DialogHeader>
            <DialogTitle>
              {dialog.type === 'create-note' && 'Create New Note'}
              {dialog.type === 'create-excalidraw' && 'Create New Excalidraw Drawing'}
              {dialog.type === 'create-folder' && 'Create New Folder'}
              {dialog.type === 'delete-file' && 'Delete Note'}
              {dialog.type === 'delete-folder' && 'Delete Folder'}
              {dialog.type === 'rename' && 'Rename Item'}
              {dialog.type === 'move' && 'Move Item'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {dialog.type === 'delete-file' && 'Are you sure you want to delete this note? This action cannot be undone.'}
              {dialog.type === 'delete-folder' && `Are you sure you want to delete "${dialog.target}" and all its contents?`}
              {dialog.type === 'move' && `Select a destination for "${dialog.target?.split('/').pop()}"`}
            </DialogDescription>
          </DialogHeader>
          {(dialog.type === 'create-note' || dialog.type === 'create-excalidraw' || dialog.type === 'create-folder' || dialog.type === 'rename') && (
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Name</label>
                <Input value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="Enter name..." className="bg-background border-border" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleConfirm()} />
              </div>
              
              {dialog.type === 'create-note' && templateList.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Template (Optional)</label>
                  <select
                    value={dialog.templateSlug || ''}
                    onChange={(e) => setDialog(prev => ({ ...prev, templateSlug: e.target.value }))}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <option value="">Blank Note</option>
                    {templateList.map(t => (
                      <option key={t.slug} value={t.slug}>{t.title}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
          {dialog.type === 'move' && (
             <div className="py-4">
              <select
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
              >
                <option value="">Root (Library)</option>
                {folders.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog} className="text-muted-foreground hover:text-foreground">Cancel</Button>
            <Button variant={dialog.type?.startsWith('delete') ? 'destructive' : 'default'} onClick={handleConfirm} disabled={isPending || ((dialog.type === 'create-note' || dialog.type === 'create-excalidraw' || dialog.type === 'create-folder' || dialog.type === 'rename') && !inputValue.trim())}>
              {isPending ? 'Processing...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex h-screen w-full overflow-hidden bg-sidebar text-foreground font-sans">
        <SidebarUI collapsible="offcanvas" className={cn("bg-sidebar border-none! shadow-none! [&>div]:border-none!", isMac && "pt-4")}>
          {/* Header Spacer to align with main content card */}
          <div className="h-12 shrink-0" />
          
          <div className="px-3 py-4 group-data-[state=collapsed]:hidden">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search content..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-8 pl-8 bg-background border-border text-[12px] focus-visible:ring-ring" />
            </div>
          </div>
          <SidebarContent className="no-scrollbar overflow-x-auto">
            <div className="min-w-max flex flex-col min-h-full">
              {!isSearching ? (
                <SidebarGroup className="flex-1">
                  <SidebarGroupLabel 
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverFolder('root'); }}
                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverFolder(null); }}
                    onDrop={(e) => handleFolderDrop(e, '')}
                    className={cn(
                      "flex items-center justify-between text-[10px] font-bold uppercase tracking-widest px-2 mb-1 transition-all rounded py-1 group/label hover:bg-accent/50 cursor-default",
                      dragOverFolder === 'root' ? "bg-primary/20 text-primary ring-1 ring-primary" : ""
                    )}
                  >
                    <button 
                      onClick={handleSelectVault}
                      className="flex items-center gap-1.5 truncate max-w-[130px] text-left cursor-pointer group"
                      title="Switch Vault"
                    >
                      <span className="truncate opacity-50 group-hover:opacity-100 transition-opacity">{vaultPath ? vaultPath.split(/[/\\]/).pop() : 'Select Vault'}</span>
                      <ChevronDown className="h-3 w-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                    </button>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setDialog({ type: 'create-note', parentFolder: '' })} className="hover:bg-white/10 p-1 rounded transition-colors text-sidebar-foreground opacity-50 hover:opacity-100" title="New Note">
                        <Plus className="h-3 w-3" />
                      </button>
                      <button onClick={() => setDialog({ type: 'create-excalidraw', parentFolder: '' })} className="hover:bg-white/10 p-1 rounded transition-colors text-sidebar-foreground opacity-50 hover:opacity-100" title="New Excalidraw">
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button onClick={() => setDialog({ type: 'create-folder', parentFolder: '' })} className="hover:bg-white/10 p-1 rounded transition-colors text-sidebar-foreground opacity-50 hover:opacity-100" title="New Folder">
                        <FolderPlus className="h-3 w-3" />
                      </button>
                    </div>
                  </SidebarGroupLabel>
                  <SidebarGroupContent><SidebarMenu>{renderTree(fullTree)}</SidebarMenu></SidebarGroupContent>
                </SidebarGroup>
              ) : (
                <SidebarGroup className="flex-1">
                  <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-widest opacity-30 px-2 mb-1">Results</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {searchResults.map(result => (
                        <SidebarMenuItem key={result.slug}>
                          <SidebarMenuButton render={<Link href={`/note/${result.slug}`} />} isActive={pathname === `/note/${result.slug}`} className="h-auto py-2 items-start flex-col gap-1">
                            <span className="font-medium text-[13px]">{result.title}</span>
                            <span className="text-[11px] opacity-40 italic line-clamp-2 leading-tight text-muted-foreground">{result.snippet}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                      {searchResults.length === 0 && <div className="p-4 text-xs text-muted-foreground italic text-center">No matches found</div>}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              )}

              <Collapsible defaultOpen className="group/templates">
                <SidebarGroup className="mt-auto">
                  <SidebarGroupLabel render={
                    <CollapsibleTrigger 
                      render={<div />} 
                      nativeButton={false}
                      className="flex w-full items-center justify-between text-[10px] font-bold uppercase tracking-widest px-2 mb-1 group/tpl-label cursor-pointer hover:bg-accent/50 rounded transition-colors py-1"
                    />
                  }>
                      <div className="flex items-center gap-1.5">
                        <span className="opacity-50 group-hover/tpl-label:opacity-100 transition-opacity">Templates</span>
                        <ChevronDown className="h-3 w-3 opacity-50 transition-transform group-data-[state=closed]/templates:-rotate-90 group-hover/tpl-label:opacity-100 transition-opacity" />
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setDialog({ type: 'create-note', parentFolder: '.templates' });
                        }}
                        className="opacity-50 hover:opacity-100 transition-opacity hover:bg-white/10 p-1 rounded"
                        title="New Template"
                      >
                        <Plus className="h-3 w-3 text-sidebar-foreground" />
                      </button>
                  </SidebarGroupLabel>
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu className="max-h-[160px] overflow-y-auto no-scrollbar">
                        {templateList.map(tpl => (
                          <SidebarMenuItem key={tpl.slug}>
                            <div className="flex items-center group/tpl pr-2">
                              <SidebarMenuButton render={<Link href={`/note/${tpl.slug}`} />} isActive={pathname === `/note/${tpl.slug}`} className="flex-1">
                                <Layout className="h-3.5 w-3.5 opacity-40" />
                                <span className="truncate">{tpl.title}</span>
                              </SidebarMenuButton>
                              <DropdownMenu>
                                <DropdownMenuTrigger nativeButton={false} render={<SidebarMenuAction render={<div />} showOnHover className="opacity-0 group-hover/tpl:opacity-100"><MoreHorizontal /></SidebarMenuAction>} />
                                <DropdownMenuContent side="right" align="start" className="bg-popover border-border text-popover-foreground">
                                  <DropdownMenuItem onClick={() => { setDialog({ type: 'rename', target: tpl.slug, itemType: 'note' }); setInputValue(tpl.title); }}>
                                    <Pencil className="mr-2 h-4 w-4" /> Rename
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setDialog({ type: 'delete-file', target: tpl.slug })} className="text-destructive focus:text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </SidebarMenuItem>
                        ))}
                        {templateList.length === 0 && (
                          <div className="px-4 py-2 text-[10px] text-muted-foreground italic">No templates yet</div>
                        )}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>

              <Collapsible defaultOpen className="group/explore">
                <SidebarGroup>
                  <SidebarGroupLabel render={
                    <CollapsibleTrigger 
                      render={<div />} 
                      nativeButton={false}
                      className="flex w-full items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2 mb-1 group/exp-label cursor-pointer hover:bg-accent/50 rounded transition-colors py-1"
                    />
                  }>
                      <span className="opacity-50 group-hover/exp-label:opacity-100 transition-opacity">Explore</span>
                      <ChevronDown className="h-3 w-3 opacity-50 transition-transform group-data-[state=closed]/explore:-rotate-90 group-hover/exp-label:opacity-100 transition-opacity" />
                  </SidebarGroupLabel>
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        <SidebarMenuItem>
                          <SidebarMenuButton render={<Link href="/tags" />} isActive={pathname === '/tags'} tooltip="Tags" className="hover:bg-accent data-[active=true]:bg-accent">
                            <Hash className="h-4 w-4 opacity-50" /><span className="font-medium text-[13px]">Tags</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                          <SidebarMenuButton render={<Link href="/mentions" />} isActive={pathname === '/mentions'} tooltip="Mentions" className="hover:bg-accent data-[active=true]:bg-accent">
                            <AtSign className="h-4 w-4 opacity-50" /><span className="font-medium text-[13px]">Mentions</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                          <SidebarMenuButton render={<Link href="/graph" />} isActive={pathname === '/graph'} tooltip="Graph View" className="hover:bg-accent data-[active=true]:bg-accent">
                            <Share2 className="h-4 w-4 opacity-50" /><span className="font-medium text-[13px]">Graph View</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            </div>
          </SidebarContent>
        </SidebarUI>

        <div className="flex flex-1 flex-col overflow-hidden bg-sidebar">
          <header className="flex h-12 shrink-0 items-center gap-2 px-4 bg-transparent sticky top-0 z-20 no-print">
            <div className={cn(
              "flex-1 flex items-center min-w-0 transition-all duration-300",
              isMac && "peer-data-[state=collapsed]:pl-16"
            )}>
              <TabList />
            </div>
            
            <div className="ml-auto flex items-center pl-2 gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setHelpOpen(true)}
                className="h-8 w-8 opacity-50 hover:opacity-100 transition-opacity"
                title="Editor Shortcuts"
              >
                <Info className="h-4 w-4" />
              </Button>
              <ThemeToggle />
              <WindowControls />
            </div>
          </header>

          <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
            <DialogContent className="sm:max-w-[425px] bg-popover border-border text-popover-foreground">
              <DialogHeader>
                <DialogTitle>Editor Shortcuts</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Use these shortcuts to write and organize your notes faster.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4 text-sm">
                <div className="grid grid-cols-[80px_1fr] gap-2 items-center border-b border-border pb-3">
                  <kbd className="px-2 py-1 bg-muted rounded border border-border text-center font-mono font-bold text-primary">[[</kbd>
                  <span>Wiki-Links: Connect to another note</span>
                </div>
                <div className="grid grid-cols-[80px_1fr] gap-2 items-center border-b border-border pb-3">
                  <kbd className="px-2 py-1 bg-muted rounded border border-border text-center font-mono font-bold text-primary">#</kbd>
                  <span>Tags: Categorize your notes</span>
                </div>
                <div className="grid grid-cols-[80px_1fr] gap-2 items-center border-b border-border pb-3">
                  <kbd className="px-2 py-1 bg-muted rounded border border-border text-center font-mono font-bold text-primary">@</kbd>
                  <span>Mentions: Reference people</span>
                </div>
                <div className="grid grid-cols-[80px_1fr] gap-2 items-center border-b border-border pb-3">
                  <kbd className="px-2 py-1 bg-muted rounded border border-border text-center font-mono font-bold text-primary">/</kbd>
                  <span>Slash Commands: Quick formatting & blocks</span>
                </div>
                <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                  <kbd className="px-2 py-1 bg-muted rounded border border-border text-center font-mono font-bold text-primary">::</kbd>
                  <span>Templates: Insert reusable snippets</span>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => setHelpOpen(false)}>Got it</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <main className="flex-1 overflow-hidden p-2 md:p-4 md:pt-0 relative">
            {children}
          </main>
        </div>
      </div>
      </DropZone>
    </SidebarProvider>
  );
}
