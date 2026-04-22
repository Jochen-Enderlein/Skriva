'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus, Search, Settings } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { NoteMetadata } from '@/lib/notes';

import { createNoteAction } from '@/app/actions';

interface CommandPaletteProps {
  notes: NoteMetadata[];
}

export function CommandPalette({ notes }: CommandPaletteProps) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  const handleCreateNote = async () => {
    const title = prompt('Enter note title:');
    if (title) {
      const result = await createNoteAction(title);
      if (result.success) {
        router.push(`/note/${result.slug}`);
      }
    }
  };

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Notes">
          {notes.map((note) => (
            <CommandItem
              key={note.slug}
              value={note.title}
              onSelect={() => {
                runCommand(() => router.push(`/note/${note.slug}`));
              }}
            >
              <FileText className="mr-2 h-4 w-4" />
              <span>{note.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => {
              runCommand(handleCreateNote);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            <span>Create New Note</span>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              runCommand(() => router.push('/settings'));
            }}
          >
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
