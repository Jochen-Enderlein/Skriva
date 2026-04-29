import { 
  Decoration, 
  DecorationSet, 
  EditorView, 
  ViewPlugin, 
  ViewUpdate,
  WidgetType
} from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { Range } from "@codemirror/state";

const hideDecoration = Decoration.replace({});

const headerDecorations = {
  1: Decoration.line({ class: "cm-h1" }),
  2: Decoration.line({ class: "cm-h2" }),
  3: Decoration.line({ class: "cm-h3" }),
};

const blockquoteDecoration = Decoration.line({ class: "cm-blockquote" });
const boldDecoration = Decoration.mark({ class: "cm-bold" });
const italicDecoration = Decoration.mark({ class: "cm-italic" });
const inlineCodeDecoration = Decoration.mark({ class: "cm-inline-code" });
const linkDecoration = Decoration.mark({ class: "cm-link" });

const codeBlockDecoration = Decoration.line({ class: "cm-code-block" });
const codeBlockTopDecoration = Decoration.line({ class: "cm-code-block cm-code-block-top" });
const codeBlockBottomDecoration = Decoration.line({ class: "cm-code-block cm-code-block-bottom" });
const codeBlockSingleDecoration = Decoration.line({ class: "cm-code-block cm-code-block-top cm-code-block-bottom" });

export const livePreviewExtension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.getDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = this.getDecorations(update.view);
      }
    }

    getDecorations(view: EditorView): DecorationSet {
      const widgets: Range<Decoration>[] = [];
      const selection = view.state.selection.main;
      
      const startLine = view.state.doc.lineAt(selection.from).number;
      const endLine = view.state.doc.lineAt(selection.to).number;

      for (const { from, to } of view.visibleRanges) {
        syntaxTree(view.state).iterate({
          from,
          to,
          enter: (node) => {
            const nodeLine = view.state.doc.lineAt(node.from);
            const isCursorOnLine = nodeLine.number >= startLine && nodeLine.number <= endLine;

            // User requested to revert to normal editor mode when cursor is inside the structure
            if (!isCursorOnLine) {
              if (node.name === "ATXHeading1") {
                widgets.push(headerDecorations[1].range(nodeLine.from, nodeLine.from));
              } else if (node.name === "ATXHeading2") {
                widgets.push(headerDecorations[2].range(nodeLine.from, nodeLine.from));
              } else if (node.name === "ATXHeading3") {
                widgets.push(headerDecorations[3].range(nodeLine.from, nodeLine.from));
              } else if (node.name === "Blockquote") {
                widgets.push(blockquoteDecoration.range(nodeLine.from, nodeLine.from));
              }
            }

            if (node.name === "FencedCode" || node.name === "CodeBlock") {
              const startL = view.state.doc.lineAt(node.from).number;
              const endL = view.state.doc.lineAt(node.to).number;
              const isCursorInCodeBlock = startLine <= endL && endLine >= startL;
              
              if (!isCursorInCodeBlock) {
                for (let i = startL; i <= endL; i++) {
                  const l = view.state.doc.line(i);
                  if (startL === endL) {
                    widgets.push(codeBlockSingleDecoration.range(l.from, l.from));
                  } else if (i === startL) {
                    widgets.push(codeBlockTopDecoration.range(l.from, l.from));
                  } else if (i === endL) {
                    widgets.push(codeBlockBottomDecoration.range(l.from, l.from));
                  } else {
                    widgets.push(codeBlockDecoration.range(l.from, l.from));
                  }
                }
              }
            }

            if (!isCursorOnLine) {
              if (node.name === "HeaderMark" || node.name === "QuoteMark" || node.name === "ListMark") {
                const end = Math.min(node.to + 1, nodeLine.to);
                if (node.from < end) {
                  widgets.push(hideDecoration.range(node.from, end));
                }
              }
              if (node.name === "EmphasisMark" || node.name === "CodeMark") {
                widgets.push(hideDecoration.range(node.from, node.to));
              }
              const text = view.state.sliceDoc(node.from, node.to);
              if (text === "[[" || text === "]]") {
                widgets.push(hideDecoration.range(node.from, node.to));
              }
            }

            // Inline styles always applied
            if (node.name === "Emphasis" || node.name === "StrongEmphasis") {
              const isBold = node.name === "StrongEmphasis" || view.state.sliceDoc(node.from, node.from + 2) === "**";
              widgets.push((isBold ? boldDecoration : italicDecoration).range(node.from, node.to));
            }
            if (node.name === "InlineCode") {
              widgets.push(inlineCodeDecoration.range(node.from, node.to));
            }
            if (node.name === "Link" || node.name === "LinkText") {
              widgets.push(linkDecoration.range(node.from, node.to));
            }
          },
        });
      }

      return Decoration.set(widgets, true);
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

export const livePreviewTheme = EditorView.baseTheme({
  ".cm-h1": { 
    fontSize: "2.14em", 
    fontWeight: "800", 
    color: "var(--foreground)", 
    letterSpacing: "-0.025em",
    lineHeight: "1.1",
    paddingTop: "0.5em",
    paddingBottom: "0.2em"
  },
  ".cm-h2": { 
    fontSize: "1.42em", 
    fontWeight: "700", 
    color: "var(--foreground)", 
    letterSpacing: "-0.025em",
    lineHeight: "1.4",
    paddingTop: "0.8em",
    paddingBottom: "0.2em"
  },
  ".cm-h3": { 
    fontSize: "1.28em", 
    fontWeight: "600", 
    color: "var(--foreground)",
    lineHeight: "1.5",
    paddingTop: "0.6em",
    paddingBottom: "0.1em"
  },
  ".cm-blockquote": {
    fontWeight: "500",
    fontStyle: "italic",
    borderLeft: "0.25rem solid var(--border)",
    paddingLeft: "1em",
    color: "var(--muted-foreground)"
  },
  ".cm-code-block": {
    backgroundColor: "rgba(128, 128, 128, 0.08)",
    fontFamily: "var(--font-mono)",
    color: "var(--foreground)"
  },
  ".cm-code-block-top": {
    borderTopLeftRadius: "6px",
    borderTopRightRadius: "6px",
    paddingTop: "0.4em"
  },
  ".cm-code-block-bottom": {
    borderBottomLeftRadius: "6px",
    borderBottomRightRadius: "6px",
    paddingBottom: "0.4em"
  },
  ".cm-bold": { fontWeight: "bold", color: "var(--foreground)" },
  ".cm-italic": { fontStyle: "italic" },
  ".cm-inline-code": { 
    backgroundColor: "rgba(128, 128, 128, 0.1)", 
    color: "var(--primary)",
    padding: "2px 4px", 
    borderRadius: "4px",
    fontFamily: "var(--font-mono)",
    fontSize: "0.9em",
    border: "1px solid var(--border)"
  },
  ".cm-link": { 
    color: "#60a5fa", 
    textDecoration: "underline", 
    textUnderlineOffset: "4px",
    textDecorationColor: "rgba(96, 165, 250, 0.3)"
  },
  ".cm-content": { 
    padding: "40px 0 30vh 0 !important", 
    fontSize: "14px", 
    lineHeight: "1.7",
    fontFamily: "var(--font-sans)",
    color: "var(--foreground)"
  },
  ".cm-line": { 
    padding: "0 2px" 
  }
});
