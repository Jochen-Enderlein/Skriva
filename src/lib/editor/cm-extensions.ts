import { gutter, GutterMarker, Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { CompletionContext, CompletionResult, autocompletion } from "@codemirror/autocomplete";
import { RangeSetBuilder, StateField, StateEffect } from "@codemirror/state";
import { NoteMetadata } from "@/lib/notes";

// Callout Highlighting in Editor
const calloutDecoration = (type: string) => Decoration.line({
  attributes: { class: `cm-callout cm-callout-${type}` }
});

const calloutHeaderDecoration = Decoration.mark({
  class: "cm-callout-header"
});

export const calloutHighlightPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = this.computeDecorations(view);
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = this.computeDecorations(update.view);
    }
  }

  computeDecorations(view: EditorView) {
    let builder = new RangeSetBuilder<Decoration>();
    for (let { from, to } of view.visibleRanges) {
      for (let pos = from; pos <= to; ) {
        let line = view.state.doc.lineAt(pos);
        const match = line.text.match(/^\s*>\s*\[!(\w+)\]/);
        if (match) {
          const type = match[1].toLowerCase();
          builder.add(line.from, line.from, calloutDecoration(type));
          
          // Also highlight the [!type] part specifically
          const start = line.text.indexOf("[!");
          const end = line.text.indexOf("]") + 1;
          if (start !== -1 && end !== -1) {
            builder.add(line.from + start, line.from + end, calloutHeaderDecoration);
          }
        }
        pos = line.to + 1;
      }
    }
    return builder.finish();
  }
}, {
  decorations: v => v.decorations
});

// Gutter for icons
const createIconSpan = (svgContent: string) => {
  if (typeof document === 'undefined') return null;
  const span = document.createElement("span");
  span.innerHTML = svgContent;
  span.style.color = "#666";
  span.style.display = "flex";
  span.style.alignItems = "center";
  span.style.justifyContent = "center";
  span.style.height = "1.5em"; // Fixed height matching line-height
  span.style.width = "100%";
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
const mathSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20h10"/><path d="M6 4h11"/><path d="M17 4l-9 16"/><path d="M7 4l9 16"/></svg>'; // Simple X-like shape for Sigma/Math
const calloutSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>';

const codeMarkerObj = new IconMarker(createIconSpan(codeSvg));
const headerMarkerObj = new IconMarker(createIconSpan(headingSvg));
const listMarkerObj = new IconMarker(createIconSpan(listSvg));
const mathMarkerObj = new IconMarker(createIconSpan(mathSvg));
const calloutMarkerObj = new IconMarker(createIconSpan(calloutSvg));

export const blockIconGutter = gutter({
  class: "cm-block-icons",
  lineMarker(view, line) {
    let match = null;
    const tree = syntaxTree(view.state);
    
    // Check line text first for fast detection
    const lineText = view.state.doc.lineAt(line.from).text.trim();
    if (lineText.startsWith('$$') || lineText.startsWith('$')) {
      return mathMarkerObj;
    }
    if (lineText.startsWith('> [!')) {
      return calloutMarkerObj;
    }

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
  { label: "/table", displayLabel: "Table", type: "keyword", apply: "\n| Header | Header |\n|--------|--------|\n| Cell   | Cell   |\n", detail: "Markdown table" },
  { label: "/math", displayLabel: "LaTeX Block", type: "keyword", apply: "$$\n\n$$", detail: "Math formula" },
  { label: "/info", displayLabel: "Info Callout", type: "keyword", apply: "> [!info] Info\n> ", detail: "Blue callout" },
  { label: "/warn", displayLabel: "Warning Callout", type: "keyword", apply: "> [!warning] Warning\n> ", detail: "Amber callout" },
  { label: "/danger", displayLabel: "Danger Callout", type: "keyword", apply: "> [!danger] Danger\n> ", detail: "Red callout" },
  { label: "/success", displayLabel: "Success Callout", type: "keyword", apply: "> [!success] Success\n> ", detail: "Green callout" },
  { label: "/tip", displayLabel: "Tip Callout", type: "keyword", apply: "> [!tip] Tip\n> ", detail: "Purple callout" }
];

const mathSnippets = [
  { label: "\\frac", displayLabel: "Fraction", type: "keyword", apply: "\\frac{${1}}{${2}}", detail: "\\frac{}{}" },
  { label: "\\sqrt", displayLabel: "Square Root", type: "keyword", apply: "\\sqrt{${1}}", detail: "\\sqrt{}" },
  { label: "\\sum", displayLabel: "Sum", type: "keyword", apply: "\\sum_{${1}}^{${2}} ", detail: "Summation" },
  { label: "\\int", displayLabel: "Integral", type: "keyword", apply: "\\int_{${1}}^{${2}} ", detail: "Integral" },
  { label: "\\lim", displayLabel: "Limit", type: "keyword", apply: "\\lim_{${1} \\to ${2}} ", detail: "Limit" },
  { label: "\\lr", displayLabel: "Left-Right Brackets", type: "keyword", apply: "\\left( ${1} \\right)", detail: "\\left( \\right)" },
  { label: "\\matrix", displayLabel: "Matrix", type: "keyword", apply: "\\begin{matrix} ${1} & ${2} \\\\ ${3} & ${4} \\end{matrix}", detail: "Matrix block" },
  { label: "\\sin", displayLabel: "Sine", type: "keyword", apply: "\\sin(${1})", detail: "sin" },
  { label: "\\cos", displayLabel: "Cosine", type: "keyword", apply: "\\cos(${1})", detail: "cos" },
  { label: "\\tan", displayLabel: "Tangent", type: "keyword", apply: "\\tan(${1})", detail: "tan" },
  { label: "\\log", displayLabel: "Logarithm", type: "keyword", apply: "\\log_{${1}}(${2})", detail: "log" },
  { label: "\\ln", displayLabel: "Natural Log", type: "keyword", apply: "\\ln(${1})", detail: "ln" },
  { label: "\\alpha", displayLabel: "Alpha", type: "keyword", apply: "\\alpha", detail: "α" },
  { label: "\\beta", displayLabel: "Beta", type: "keyword", apply: "\\beta", detail: "β" },
  { label: "\\gamma", displayLabel: "Gamma", type: "keyword", apply: "\\gamma", detail: "γ" },
  { label: "\\delta", displayLabel: "Delta", type: "keyword", apply: "\\delta", detail: "δ" },
  { label: "\\epsilon", displayLabel: "Epsilon", type: "keyword", apply: "\\epsilon", detail: "ε" },
  { label: "\\theta", displayLabel: "Theta", type: "keyword", apply: "\\theta", detail: "θ" },
  { label: "\\lambda", displayLabel: "Lambda", type: "keyword", apply: "\\lambda", detail: "λ" },
  { label: "\\pi", displayLabel: "Pi", type: "keyword", apply: "\\pi", detail: "π" },
  { label: "\\sigma", displayLabel: "Sigma", type: "keyword", apply: "\\sigma", detail: "σ" },
  { label: "\\omega", displayLabel: "Omega", type: "keyword", apply: "\\omega", detail: "ω" },
  { label: "\\infty", displayLabel: "Infinity", type: "keyword", apply: "\\infty", detail: "∞" },
  { label: "\\partial", displayLabel: "Partial", type: "keyword", apply: "\\partial", detail: "∂" },
  { label: "\\nabla", displayLabel: "Nabla", type: "keyword", apply: "\\nabla", detail: "∇" },
  { label: "\\cdot", displayLabel: "Center Dot", type: "keyword", apply: "\\cdot", detail: "·" },
  { label: "\\times", displayLabel: "Times", type: "keyword", apply: "\\times", detail: "×" },
  { label: "\\pm", displayLabel: "Plus-Minus", type: "keyword", apply: "\\pm", detail: "±" },
  { label: "\\forall", displayLabel: "For All", type: "keyword", apply: "\\forall", detail: "∀" },
  { label: "\\exists", displayLabel: "Exists", type: "keyword", apply: "\\exists", detail: "∃" },
  { label: "\\in", displayLabel: "Element Of", type: "keyword", apply: "\\in", detail: "∈" },
  { label: "\\subset", displayLabel: "Subset", type: "keyword", apply: "\\subset", detail: "⊂" },
  { label: "\\cup", displayLabel: "Union", type: "keyword", apply: "\\cup", detail: "∪" },
  { label: "\\cap", displayLabel: "Intersection", type: "keyword", apply: "\\cap", detail: "∩" },
  { label: "\\rightarrow", displayLabel: "Arrow", type: "keyword", apply: "\\rightarrow", detail: "→" },
  { label: "\\Rightarrow", displayLabel: "Double Arrow", type: "keyword", apply: "\\Rightarrow", detail: "⇒" },
  { label: "\\approx", displayLabel: "Approx", type: "keyword", apply: "\\approx", detail: "≈" },
  { label: "\\neq", displayLabel: "Not Equal", type: "keyword", apply: "\\neq", detail: "≠" },
  { label: "\\le", displayLabel: "Less/Equal", type: "keyword", apply: "\\le", detail: "≤" },
  { label: "\\ge", displayLabel: "Greater/Equal", type: "keyword", apply: "\\ge", detail: "≥" },
];

const calloutTypes = [
  { label: "[!info]", displayLabel: "Info", type: "keyword", apply: "[!info] ", detail: "Blue" },
  { label: "[!note]", displayLabel: "Note", type: "keyword", apply: "[!note] ", detail: "Blue" },
  { label: "[!warning]", displayLabel: "Warning", type: "keyword", apply: "[!warning] ", detail: "Amber" },
  { label: "[!danger]", displayLabel: "Danger", type: "keyword", apply: "[!danger] ", detail: "Red" },
  { label: "[!error]", displayLabel: "Error", type: "keyword", apply: "[!error] ", detail: "Red" },
  { label: "[!success]", displayLabel: "Success", type: "keyword", apply: "[!success] ", detail: "Green" },
  { label: "[!tip]", displayLabel: "Tip", type: "keyword", apply: "[!tip] ", detail: "Purple" },
  { label: "[!todo]", displayLabel: "Todo", type: "keyword", apply: "[!todo] ", detail: "Cyan" }
];

export const autocompleteExtensions = (allTags: string[], allMentions: string[], allNotes: NoteMetadata[]) => {
  return autocompletion({
    activateOnTyping: true,
    override: [
      (context: CompletionContext): CompletionResult | null => {
        let word = context.matchBefore(/\[!\w*/);
        if (!word) return null;
        return {
          from: word.from,
          options: calloutTypes,
        };
      },
      (context: CompletionContext): CompletionResult | null => {
        let word = context.matchBefore(/::[a-zA-Z0-9_]*/);
        if (!word) return null;
        if (word.from === word.to && !context.explicit) return null;

        return {
          from: word.from,
          options: allNotes
            .filter(n => n.relativeDir === '.templates')
            .map(tpl => ({
              label: `::${tpl.title}`,
              displayLabel: tpl.title,
              type: "keyword",
              detail: "template",
              apply: async (view: EditorView, completion: any, from: number, to: number) => {
                const { getNoteContentAction } = await import('@/app/actions');
                const res = await getNoteContentAction(tpl.slug);
                if (res.success && res.content) {
                  view.dispatch({
                    changes: { from, to, insert: res.content },
                    selection: { anchor: from + res.content.length }
                  });
                }
              }
            }))
        };
      },
      (context: CompletionContext): CompletionResult | null => {
        let word = context.matchBefore(/\/[a-zA-Z]*/);
        if (!word) return null;
        if (word.from === word.to && !context.explicit) return null;

        return {
          from: word.from,
          options: slashCommands,
        };
      },
      (context: CompletionContext): CompletionResult | null => {
        let word = context.matchBefore(/\\[a-zA-Z]*/);
        if (!word) return null;
        if (word.from === word.to && !context.explicit) return null;

        return {
          from: word.from,
          options: mathSnippets,
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
        let word = context.matchBefore(/@[a-zA-Z0-9_]*/);
        if (!word) return null;
        if (word.from === word.to && !context.explicit) return null;

        if (word.from === 0 || context.state.sliceDoc(word.from - 1, word.from).match(/\s/)) {
          return {
            from: word.from,
            options: Array.from(new Set(allMentions)).map(mention => ({
              label: `@${mention}`,
              type: "keyword",
              apply: `@${mention} `,
              detail: "person"
            }))
          };
        }
        return null;
      },
      (context: CompletionContext): Promise<CompletionResult | null> | CompletionResult | null => {
        let word = context.matchBefore(/\[\[[^\]]*/);
        if (!word) return null;

        const text = word.text.substring(2);
        const hashIndex = text.indexOf('#');
        
        if (hashIndex !== -1) {
          const noteTitle = text.substring(0, hashIndex);
          const note = allNotes.find(n => n.title === noteTitle);
          if (note) {
            return (async () => {
              const { getNoteContentAction } = await import('@/app/actions');
              const res = await getNoteContentAction(note.slug);
              if (res.success && res.content) {
                const headings: string[] = [];
                const lines = res.content.split('\n');
                for (const line of lines) {
                  const match = line.match(/^(#{1,6})\s+(.+)$/);
                  if (match) {
                    headings.push(match[2].trim());
                  }
                }
                return {
                  from: word.from + 2 + hashIndex + 1,
                  options: headings.map(h => ({
                    label: h,
                    type: "text",
                    apply: `${h}]]`
                  }))
                };
              }
              return null;
            })();
          }
        }
        
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
