import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Code, Table, Heading1, Heading2, List, ListOrdered, Quote, Image as ImageIcon } from 'lucide-react';

export const SlashCommandList = forwardRef((props: any, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      item.command({ editor: props.editor, range: props.range });
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
    <div className="bg-[#0f0f0f] border border-white/10 rounded-lg shadow-2xl overflow-hidden min-w-[180px]">
      <div className="p-1">
        {props.items.length > 0 ? (
          props.items.map((item: any, index: number) => (
            <button
              key={index}
              onClick={() => selectItem(index)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left rounded-md transition-all ${
                index === selectedIndex
                  ? 'bg-white/10 text-white'
                  : 'text-white/50 hover:bg-white/5 hover:text-white/80'
              }`}
            >
              <div className="bg-white/5 p-1.5 rounded-md">
                {item.icon}
              </div>
              <div className="flex flex-col">
                <span className="font-medium">{item.title}</span>
                <span className="text-[10px] opacity-50">{item.description}</span>
              </div>
            </button>
          ))
        ) : (
          <div className="p-2 text-sm text-white/30">No results</div>
        )}
      </div>
    </div>
  );
});

SlashCommandList.displayName = 'SlashCommandList';
