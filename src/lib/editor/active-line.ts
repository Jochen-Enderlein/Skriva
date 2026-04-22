import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const ActiveLine = Extension.create({
  name: 'activeLine',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('activeLine'),
        props: {
          decorations: (state) => {
            const { selection } = state;
            const { from } = selection;
            const decorations: Decoration[] = [];

            state.doc.nodesBetween(from, from, (node, pos) => {
              if (node.isBlock) {
                decorations.push(
                  Decoration.node(pos, pos + node.nodeSize, {
                    class: 'is-active-line',
                  })
                );
              }
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
