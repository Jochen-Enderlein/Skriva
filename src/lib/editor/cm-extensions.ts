import { gutter, GutterMarker } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { CompletionContext, CompletionResult, autocompletion } from "@codemirror/autocomplete";
import { NoteMetadata } from "@/lib/notes";

// Gutter for icons
const createIconSpan = (svgContent: string) => {
  if (typeof document === 'undefined') return null;
  const span = document.createElement("span");
  span.innerHTML = svgContent;
  span.style.color = "#666";
  span.style.display = "flex";
  span.style.alignItems = "center";
  span.style.justifyContent = "center";
  span.style.height = "100%";
  return span;
};

class IconMarker extends GutterMarker {
  constructor(private iconEl: HTMLElement | null) {
    super();
  }
  toDOM() { 
    return this.iconEl ? (this.iconEl.cloneNode(true) as HTMLElement) : document.createElement('span'); 
  }
}

const codeSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>';
const headingSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12h12"/><path d="M6 20V4"/><path d="M18 20V4"/></svg>';
const listSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>';

const codeMarkerObj = new IconMarker(createIconSpan(codeSvg));
const headerMarkerObj = new IconMarker(createIconSpan(headingSvg));
const listMarkerObj = new IconMarker(createIconSpan(listSvg));

export const blockIconGutter = gutter({
  class: "cm-block-icons",
  lineMarker(view, line) {
    let match = null;
    const tree = syntaxTree(view.state);
    
    // Very naive but fast check: only look at the start of the line
    tree.iterate({
      from: line.from,
      to: line.to,
      enter(n) {
        if (n.from === line.from) {
          if (n.name.includes("FencedCode") || n.name.includes("CodeBlock")) {
            match = codeMarkerObj;
            return false;
          }
          if (n.name.includes("ATXHeading")) {
            match = headerMarkerObj;
            return false;
          }
          if (n.name.includes("BulletList") || n.name.includes("OrderedList") || n.name.includes("ListItem")) {
            match = listMarkerObj;
            return false;
          }
        }
      }
    });

    return match;
  },
  initialSpacer: () => codeMarkerObj
});

// Autocompletion
const slashCommands = [
  { label: "/h1", displayLabel: "Heading 1", type: "keyword", apply: "# ", detail: "Big heading" },
  { label: "/h2", displayLabel: "Heading 2", type: "keyword", apply: "## ", detail: "Medium heading" },
  { label: "/h3", displayLabel: "Heading 3", type: "keyword", apply: "### ", detail: "Small heading" },
  { label: "/ul", displayLabel: "Bullet List", type: "keyword", apply: "- ", detail: "Unordered list" },
  { label: "/ol", displayLabel: "Numbered List", type: "keyword", apply: "1. ", detail: "Ordered list" },
  { label: "/quote", displayLabel: "Quote", type: "keyword", apply: "> ", detail: "Blockquote" },
  { label: "/code", displayLabel: "Code Block", type: "keyword", apply: "```\n\n```", detail: "Fenced code" },
  { label: "/mermaid", displayLabel: "Mermaid Diagram", type: "keyword", apply: "```mermaid\ngraph TD\n  A --> B\n```", detail: "Mermaid chart" },
  { label: "/table", displayLabel: "Table", type: "keyword", apply: "\n| Header | Header |\n|--------|--------|\n| Cell   | Cell   |\n", detail: "Markdown table" }
];

export const autocompleteExtensions = (allTags: string[], allNotes: NoteMetadata[]) => {
  return autocompletion({
    override: [
      (context: CompletionContext): CompletionResult | null => {
        let word = context.matchBefore(/\/[a-zA-Z0-9-]*/);
        if (!word) return null;
        if (word.from === word.to && !context.explicit) return null;

        return {
          from: word.from,
          options: slashCommands
        };
      },
      (context: CompletionContext): CompletionResult | null => {
        let word = context.matchBefore(/#[a-zA-Z0-9_]*/);
        if (!word) return null;
        if (word.from === word.to && !context.explicit) return null;
        
        // Ensure it's typed as a tag, not a heading (heading has space after #)
        const charAfter = context.state.sliceDoc(word.to, word.to + 1);
        if (charAfter === " ") return null;

        if (word.from === 0 || context.state.sliceDoc(word.from - 1, word.from).match(/\s/)) {
          return {
            from: word.from,
            options: Array.from(new Set(allTags)).map(tag => ({
              label: `#${tag}`,
              type: "keyword",
              apply: `#${tag} `,
              detail: "tag"
            }))
          };
        }
        return null;
      },
      (context: CompletionContext): CompletionResult | null => {
        let word = context.matchBefore(/\[\[[^\]]*/);
        if (!word) return null;
        
        return {
          from: word.from + 2,
          options: allNotes.map(note => ({
            label: note.title,
            type: "text",
            apply: `${note.title}]]`
          }))
        };
      }
    ]
  });
};
