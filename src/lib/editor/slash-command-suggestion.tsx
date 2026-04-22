import { ReactRenderer } from '@tiptap/react';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { SlashCommandList } from './slash-command-list';
import { SuggestionOptions } from '@tiptap/suggestion';
import { Heading1, Heading2, List, ListOrdered, Quote, Code, Table as TableIcon } from 'lucide-react';
import React from 'react';

export const slashCommandSuggestion: Omit<SuggestionOptions, 'editor'> = {
  char: '/',
  startOfLine: true,
  items: ({ query }) => {
    return [
      {
        title: 'Heading 1',
        description: 'Big section heading',
        icon: <Heading1 className="h-4 w-4" />,
        command: ({ editor, range }: any) => {
          editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
        },
      },
      {
        title: 'Heading 2',
        description: 'Medium section heading',
        icon: <Heading2 className="h-4 w-4" />,
        command: ({ editor, range }: any) => {
          editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
        },
      },
      {
        title: 'Bullet List',
        description: 'Create a simple bullet list',
        icon: <List className="h-4 w-4" />,
        command: ({ editor, range }: any) => {
          editor.chain().focus().deleteRange(range).toggleBulletList().run();
        },
      },
      {
        title: 'Numbered List',
        description: 'Create a list with numbering',
        icon: <ListOrdered className="h-4 w-4" />,
        command: ({ editor, range }: any) => {
          editor.chain().focus().deleteRange(range).toggleOrderedList().run();
        },
      },
      {
        title: 'Quote',
        description: 'Capture a quotation',
        icon: <Quote className="h-4 w-4" />,
        command: ({ editor, range }: any) => {
          editor.chain().focus().deleteRange(range).toggleBlockquote().run();
        },
      },
      {
        title: 'Code Block',
        description: 'Code snippet with highlight',
        icon: <Code className="h-4 w-4" />,
        command: ({ editor, range }: any) => {
          editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
        },
      },
      {
        title: 'Table',
        description: 'Insert a 3x3 table',
        icon: <TableIcon className="h-4 w-4" />,
        command: ({ editor, range }: any) => {
          editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        },
      },
    ].filter(item => item.title.toLowerCase().includes(query.toLowerCase()));
  },

  render: () => {
    let component: ReactRenderer | null = null;
    let popup: TippyInstance[] | null = null;

    return {
      onStart: (props) => {
        component = new ReactRenderer(SlashCommandList, {
          props,
          editor: props.editor,
        });

        if (!props.clientRect) {
          return;
        }

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect as any,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        });
      },

      onUpdate(props) {
        component?.updateProps(props);

        if (!props.clientRect) {
          return;
        }

        popup?.[0].setProps({
          getReferenceClientRect: props.clientRect as any,
        });
      },

      onKeyDown(props) {
        if (props.event.key === 'Escape') {
          popup?.[0].hide();
          return true;
        }

        return (component?.ref as any)?.onKeyDown(props);
      },

      onExit() {
        popup?.[0].destroy();
        component?.destroy();
      },
    };
  },
};
