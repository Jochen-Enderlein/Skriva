import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText } from 'lucide-react';
import { NoteMetadata } from '@/lib/notes';

export const WikiLinkList = forwardRef((props: any, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index] as NoteMetadata;
    if (item) {
      props.command({ id: item.slug, label: item.title });
    }
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
        return true;
      }

      if (event.key === 'ArrowDown') {
        setSelectedIndex((selectedIndex + 1) % props.items.length);
        return true;
      }

      if (event.key === 'Enter') {
        selectItem(selectedIndex);
        return true;
      }

      return false;
    },
  }));

  return (
    <div className="bg-[#0f0f0f] border border-white/10 rounded-lg shadow-2xl overflow-hidden min-w-[200px]">
      {props.items.length > 0 ? (
        <ScrollArea className="max-h-[300px]">
          <div className="p-1">
            {props.items.map((item: NoteMetadata, index: number) => (
              <button
                key={index}
                onClick={() => selectItem(index)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-md transition-all ${
                  index === selectedIndex
                    ? 'bg-white/10 text-white'
                    : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                }`}
              >
                <FileText className="h-4 w-4 opacity-50" />
                <div className="flex flex-col">
                  <span className="font-medium">{item.title}</span>
                  <span className="text-[10px] opacity-30 truncate max-w-[150px]">{item.slug}</span>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      ) : (
        <div className="p-3 text-sm text-white/30 italic">No notes found</div>
      )}
    </div>
  );
});

WikiLinkList.displayName = 'WikiLinkList';
