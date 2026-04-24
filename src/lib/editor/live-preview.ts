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

class HideMarkerWidget extends WidgetType {
  toDOM() {
    const span = document.createElement("span");
    span.style.display = "none";
    return span;
  }
}

const hideDecoration = Decoration.replace({
  widget: new HideMarkerWidget(),
});

const headerDecorations = {
  1: Decoration.line({ class: "cm-h1" }),
  2: Decoration.line({ class: "cm-h2" }),
  3: Decoration.line({ class: "cm-h3" }),
};

const boldDecoration = Decoration.mark({ class: "cm-bold" });
const italicDecoration = Decoration.mark({ class: "cm-italic" });
const inlineCodeDecoration = Decoration.mark({ class: "cm-inline-code" });
const linkDecoration = Decoration.mark({ class: "cm-link" });

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
      
      // Get the line numbers for the selection range
      const startLine = view.state.doc.lineAt(selection.from).number;
      const endLine = view.state.doc.lineAt(selection.to).number;

      for (const { from, to } of view.visibleRanges) {
        syntaxTree(view.state).iterate({
          from,
          to,
          enter: (node) => {
            const nodeLine = view.state.doc.lineAt(node.from);
            const isCursorOnLine = nodeLine.number >= startLine && nodeLine.number <= endLine;

            // Header Line Styling (Always applied)
            if (node.name === "ATXHeading1") {
              widgets.push(headerDecorations[1].range(node.from, node.from));
            } else if (node.name === "ATXHeading2") {
              widgets.push(headerDecorations[2].range(node.from, node.from));
            } else if (node.name === "ATXHeading3") {
              widgets.push(headerDecorations[3].range(node.from, node.from));
            }

            // Marker Hiding (Only if NOT on active line)
            if (!isCursorOnLine) {
              if (node.name === "HeaderMark") {
                // Ensure we don't cross line boundaries
                const end = Math.min(node.to + 1, nodeLine.to);
                if (node.from < end) {
                  widgets.push(hideDecoration.range(node.from, end));
                }
              }
              if (node.name === "EmphasisMark") {
                widgets.push(hideDecoration.range(node.from, node.to));
              }
              if (node.name === "CodeMark") {
                widgets.push(hideDecoration.range(node.from, node.to));
              }
              if (node.name === "QuoteMark") {
                const end = Math.min(node.to + 1, nodeLine.to);
                if (node.from < end) {
                  widgets.push(hideDecoration.range(node.from, end));
                }
              }
              
              // Wikilinks
              const text = view.state.sliceDoc(node.from, node.to);
              if (text === "[[" || text === "]]") {
                widgets.push(hideDecoration.range(node.from, node.to));
              }
            }

            // Content Styling (Always applied)
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
    display: "block",
    fontSize: "2.25rem", 
    fontWeight: "800", 
    color: "var(--foreground)", 
    letterSpacing: "-0.025em", 
    marginTop: "1.5rem",
    marginBottom: "0.5rem" 
  },
  ".cm-h2": { 
    display: "block",
    fontSize: "1.75rem", 
    fontWeight: "700", 
    color: "var(--foreground)", 
    letterSpacing: "-0.025em", 
    marginTop: "1.25rem",
    marginBottom: "0.4rem" 
  },
  ".cm-h3": { 
    display: "block",
    fontSize: "1.25rem", 
    fontWeight: "600", 
    color: "var(--foreground)", 
    marginTop: "1rem",
    marginBottom: "0.3rem" 
  },
  ".cm-bold": { fontWeight: "bold", color: "var(--foreground)" },
  ".cm-italic": { fontStyle: "italic" },
  ".cm-inline-code": { 
    backgroundColor: "rgba(255,255,255,0.06)", 
    color: "#e2e8f0",
    padding: "2px 4px", 
    borderRadius: "4px",
    fontFamily: "var(--font-mono)",
    fontSize: "0.9em",
    border: "1px solid rgba(255,255,255,0.1)"
  },
  ".cm-link": { 
    color: "#60a5fa", 
    textDecoration: "underline", 
    textUnderlineOffset: "4px",
    textDecorationColor: "rgba(96, 165, 250, 0.3)"
  },
  ".cm-content": { 
    padding: "40px 0 30vh 0 !important", 
    fontSize: "16px", 
    lineHeight: "1.6",
    fontFamily: "var(--font-sans)",
    color: "var(--foreground)"
  },
  ".cm-line": { 
    padding: "0 2px" 
  },
  ".cm-activeLine": {
    backgroundColor: "transparent !important"
  }
});
