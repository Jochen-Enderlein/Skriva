import { ReactRenderer } from '@tiptap/react';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { WikiLinkList } from './wiki-link-list';
import { SuggestionOptions } from '@tiptap/suggestion';

export const wikiLinkSuggestion: Omit<SuggestionOptions, 'editor'> = {
  char: '[[',
  allowSpaces: true,
  startOfLine: false,
  
  render: () => {
    let component: ReactRenderer | null = null;
    let popup: TippyInstance[] | null = null;

    return {
      onStart: (props) => {
        component = new ReactRenderer(WikiLinkList, {
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
          theme: 'wiki-link',
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
