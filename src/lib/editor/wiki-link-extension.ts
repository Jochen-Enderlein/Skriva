import Mention from '@tiptap/extension-mention';
import { wikiLinkSuggestion } from './wiki-link-suggestion';

export const WikiLink = Mention.extend({
  name: 'wikiLink',

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: element => element.getAttribute('data-id'),
        renderHTML: attributes => {
          if (!attributes.id) return {};
          return { 'data-id': attributes.id };
        },
      },
      label: {
        default: null,
        parseHTML: element => element.getAttribute('data-label'),
        renderHTML: attributes => {
          if (!attributes.label) return {};
          return { 'data-label': attributes.label };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-wiki-link]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'a',
      { 
        'data-wiki-link': '', 
        'href': `/note/${node.attrs.id}`,
        'class': 'text-blue-500 hover:underline cursor-pointer font-medium decoration-blue-500/30 underline-offset-4',
        ...HTMLAttributes 
      },
      `${node.attrs.label || node.attrs.id}`,
    ];
  },

  renderText({ node }) {
    return `[[${node.attrs.id}]]`;
  },
}).configure({
  HTMLAttributes: {
    class: 'wiki-link',
  },
  suggestion: {
    ...wikiLinkSuggestion,
  },
});
