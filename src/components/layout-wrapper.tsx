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
  Plus, 
  Share2, 
  MoreHorizontal, 
  Trash2, 
  Pencil,
  ChevronDown,
  Folder,
  Search,
  Settings,
  Library
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  createNoteAction, 
  createFolderAction, 
  deleteFileAction, 
  deleteFolderAction,
  moveItemAction,
  searchNotesAction,
  setVaultPathAction,
  getVaultPathAction
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
import { useDebounce } from '@/hooks/use-debounce';

interface LayoutWrapperProps {
  notes: NoteMetadata[];
  folders: string[];
  children: React.ReactNode;
}

type DialogState = {
  type: 'create-note' | 'create-excalidraw' | 'create-folder' | 'delete-file' | 'delete-folder' | 'rename' | null;
  target?: string;
  parentFolder?: string;
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
    };
  }
}

export function LayoutWrapper({ notes, folders, children }: LayoutWrapperProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [dialog, setDialog] = React.useState<DialogState>({ type: null });
  const [inputValue, setInputValue] = React.useState('');
  const [searchQuery, setSearchQuery] = React.useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [searchResults, setSearchResults] = React.useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);
  const [vaultPath, setVaultPath] = React.useState<string | null>(null);
  const [isVaultLoading, setIsVaultLoading] = React.useState(true);

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
    notes.forEach(note => {
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
          const noteRes = await createNoteAction(inputValue, dialog.parentFolder || '');
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
            const renameRes = await moveItemAction(dialog.target, inputValue);
            if (renameRes.success) {
              toast.success('Item moved/renamed');
              router.push(`/note/${encodeURIComponent(inputValue)}`);
              closeDialog();
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

  const renderTree = (node: TreeNode) => {
    const isRoot = node.name === 'Root';
    return (
      <React.Fragment key={node.path || 'root'}>
        {!isRoot && (
          <SidebarMenuItem>
            <Collapsible defaultOpen className="group/collapsible">
              <div>
                <div className="flex items-center group/item pr-2">
                  <CollapsibleTrigger>
                    <SidebarMenuButton className="flex-1">
                      <ChevronDown className="h-3 w-3 opacity-30 transition-transform group-data-[state=closed]/collapsible:-rotate-90" />
                      <Folder className="h-4 w-4 opacity-50" />
                      <span className="truncate font-medium text-[13px]">{node.name}</span>
                    </SidebarMenuButton>
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
                      <DropdownMenuTrigger
                        render={
                          <button className="hover:bg-white/10 p-1 rounded transition-colors">
                            <MoreHorizontal className="h-3 w-3 opacity-30" />
                          </button>
                        }
                      />
                    <DropdownMenuContent align="end" className="w-40 bg-[#0f0f0f] border-white/10 text-white">
                      <DropdownMenuItem onClick={() => setDialog({ type: 'create-note', parentFolder: node.path })}>
                        <Plus className="mr-2 h-4 w-4" /> New Note
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDialog({ type: 'create-excalidraw', parentFolder: node.path })}>
                        <Pencil className="mr-2 h-4 w-4" /> New Excalidraw
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDialog({ type: 'create-folder', parentFolder: node.path })}>
                        <FolderPlus className="mr-2 h-4 w-4" /> New Subfolder
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDialog({ type: 'delete-folder', target: node.path })} className="text-destructive focus:text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete Folder
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <CollapsibleContent>
                  <SidebarMenuSub className="ml-4 border-l border-white/5 pl-2 min-w-max">
                    {Object.values(node.children).map(child => renderTree(child))}
                    {node.notes.map(note => (
                      <SidebarMenuItem key={note.slug}>
                        <div className="flex items-center group/note pr-2">
                          <SidebarMenuButton render={<Link href={`/note/${note.slug}`} />} isActive={pathname === `/note/${note.slug}`} className="flex-1">
                            <FileText className="h-3.5 w-3.5 opacity-40" />
                            <span className="truncate">{note.title}</span>
                          </SidebarMenuButton>
                          <DropdownMenu>
                            <DropdownMenuTrigger render={<SidebarMenuAction showOnHover className="opacity-0 group-hover/note:opacity-100"><MoreHorizontal /></SidebarMenuAction>} />
                            <DropdownMenuContent side="right" align="start" className="bg-[#0f0f0f] border-white/10 text-white">
                              <DropdownMenuItem onClick={() => { setDialog({ type: 'rename', target: note.slug }); setInputValue(decodeURIComponent(note.slug)); }}>
                                <Pencil className="mr-2 h-4 w-4" /> Rename / Move
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
              <SidebarMenuItem key={note.slug}>
                 <div className="flex items-center group/note pr-2">
                  <SidebarMenuButton render={<Link href={`/note/${note.slug}`} />} isActive={pathname === `/note/${note.slug}`} className="flex-1">
                    <FileText className="h-3.5 w-3.5 opacity-40" />
                    <span className="truncate">{note.title}</span>
                  </SidebarMenuButton>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<SidebarMenuAction showOnHover className="opacity-0 group-hover/note:opacity-100"><MoreHorizontal /></SidebarMenuAction>} />
                    <DropdownMenuContent side="right" align="start" className="bg-[#0f0f0f] border-white/10 text-white">
                      <DropdownMenuItem onClick={() => { setDialog({ type: 'rename', target: note.slug }); setInputValue(decodeURIComponent(note.slug)); }}>
                        <Pencil className="mr-2 h-4 w-4" /> Rename / Move
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
    if (pathname.startsWith('/note/')) {
      const parts = pathname.split('/');
      return decodeURIComponent(parts[parts.length - 1]);
    }
    return 'Library';
  }, [pathname]);

  if (!vaultPath && !isVaultLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#050505] text-white p-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tighter">Welcome to Skriva</h1>
            <p className="text-white/40">Select a folder to use as your knowledge base.</p>
          </div>
          <Button onClick={handleSelectVault} size="lg" className="w-full h-12 bg-white text-black hover:bg-white/90">
            Open or Create Vault
          </Button>
          <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">Your files stay on your computer.</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <CommandPalette notes={notes} />
      <Dialog open={dialog.type !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-[425px] bg-[#0f0f0f] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>
              {dialog.type === 'create-note' && 'Create New Note'}
              {dialog.type === 'create-excalidraw' && 'Create New Excalidraw Drawing'}
              {dialog.type === 'create-folder' && 'Create New Folder'}
              {dialog.type === 'delete-file' && 'Delete Note'}
              {dialog.type === 'delete-folder' && 'Delete Folder'}
              {dialog.type === 'rename' && 'Rename / Move Item'}
            </DialogTitle>
            <DialogDescription className="text-white/50">
              {dialog.type === 'delete-file' && 'Are you sure you want to delete this note? This action cannot be undone.'}
              {dialog.type === 'delete-folder' && `Are you sure you want to delete "${dialog.target}" and all its contents?`}
            </DialogDescription>
          </DialogHeader>
          {(dialog.type === 'create-note' || dialog.type === 'create-excalidraw' || dialog.type === 'create-folder' || dialog.type === 'rename') && (
            <div className="py-4">
              <Input value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="Enter name..." className="bg-white/5 border-white/10 text-white" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleConfirm()} />
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog} className="text-white/50 hover:text-white hover:bg-white/5">Cancel</Button>
            <Button variant={dialog.type?.startsWith('delete') ? 'destructive' : 'default'} onClick={handleConfirm} disabled={isPending || ((dialog.type === 'create-note' || dialog.type === 'create-excalidraw' || dialog.type === 'create-folder' || dialog.type === 'rename') && !inputValue.trim())}>
              {isPending ? 'Processing...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex h-screen w-full overflow-hidden bg-[#050505] text-foreground font-sans">
        <SidebarUI collapsible="icon" className="border-r border-white/5 bg-[#080808]">
          <SidebarHeader className="border-b border-white/5 h-12 flex flex-row items-center px-4 justify-between">
            <div className="flex items-center gap-2 font-bold tracking-tight group-data-[collapsible=icon]:hidden">
              <span className="text-[10px] tracking-[0.3em] opacity-80 uppercase">Skriva</span>
            </div>
            <div className="flex items-center gap-0.5">
              <SidebarMenuButton size="sm" onClick={() => setDialog({ type: 'create-note', parentFolder: '' })} tooltip="New Note">
                <Plus className="h-4 w-4" />
              </SidebarMenuButton>
              <SidebarMenuButton size="sm" onClick={() => setDialog({ type: 'create-excalidraw', parentFolder: '' })} tooltip="New Excalidraw Drawing">
                <Pencil className="h-4 w-4" />
              </SidebarMenuButton>
              <SidebarMenuButton size="sm" onClick={() => setDialog({ type: 'create-folder', parentFolder: '' })} tooltip="New Folder">
                <FolderPlus className="h-4 w-4" />
              </SidebarMenuButton>
              <SidebarMenuButton size="sm" onClick={handleSelectVault} tooltip="Switch Vault">
                <Library className="h-4 w-4 opacity-50" />
              </SidebarMenuButton>
            </div>
          </SidebarHeader>
          <div className="px-3 py-2 group-data-[collapsible=icon]:hidden">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-white/30" />
              <Input placeholder="Search content..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-8 pl-8 bg-white/5 border-white/5 text-[12px] focus-visible:ring-white/10" />
            </div>
          </div>
          <SidebarContent className="no-scrollbar overflow-x-auto">
            <div className="min-w-max flex flex-col min-h-full">
              {!isSearching ? (
                <SidebarGroup className="flex-1">
                  <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-widest opacity-30 px-2 mb-1">Library</SidebarGroupLabel>
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
                            <span className="text-[11px] opacity-40 italic line-clamp-2 leading-tight">{result.snippet}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                      {searchResults.length === 0 && <div className="p-4 text-xs text-white/20 italic text-center">No matches found</div>}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              )}

              <SidebarGroup className="mt-auto border-t border-white/5">
                <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-widest opacity-30 px-2 mb-1">Explore</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton render={<Link href="/tags" />} isActive={pathname === '/tags'} tooltip="Tags" className="hover:bg-white/5 data-[active=true]:bg-white/10">
                        <Hash className="h-4 w-4 opacity-50" /><span className="font-medium text-[13px]">Tags</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton render={<Link href="/graph" />} isActive={pathname === '/graph'} tooltip="Graph View" className="hover:bg-white/5 data-[active=true]:bg-white/10">
                        <Share2 className="h-4 w-4 opacity-50" /><span className="font-medium text-[13px]">Graph View</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </div>
          </SidebarContent>
          <SidebarRail />
        </SidebarUI>

        <div className="flex flex-1 flex-col overflow-hidden bg-[#050505]">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b border-white/5 px-4 bg-[#050505]/50 backdrop-blur-md sticky top-0 z-20">
            <SidebarTrigger className="-ml-1 opacity-50 hover:opacity-100 transition-opacity" />
            <div className="flex items-center gap-2 px-2">
              <span className="text-[13px] font-semibold tracking-tight text-white/80 truncate max-w-[200px]">
                {currentTitle}
              </span>
            </div>
            <div className="h-4 w-px bg-white/10 mx-1" />
            <div className="flex items-center gap-0.5">
              <Link href="/tags">
                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-50 hover:opacity-100 transition-opacity">
                  <Hash className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/graph">
                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-50 hover:opacity-100 transition-opacity">
                  <Share2 className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="h-4 w-px bg-white/10 mx-2" />
            <TabList />
          </header>
          <main className="flex-1 overflow-hidden">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
