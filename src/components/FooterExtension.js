import { mergeAttributes, Node } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

// Simple dialog HTML and setup
const dialogHTML = `
  <div class="footnote-dialog-overlay">
    <div class="footnote-dialog">
      <div class="footnote-dialog-header">Add Footnote</div>
      <textarea class="footnote-dialog-textarea" placeholder="Enter footnote content..."></textarea>
      <div class="footnote-dialog-buttons">
        <button class="footnote-dialog-button cancel">Cancel</button>
        <button class="footnote-dialog-button submit">Insert</button>
      </div>
    </div>
  </div>
`;

// Dialog styles
const dialogStyles = `
  .footnote-dialog-overlay {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1000;
    justify-content: center;
    align-items: center;
  }
  .footnote-dialog {
    background: white;
    border-radius: 8px;
    padding: 20px;
    width: 90%;
    max-width: 500px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  }
  .footnote-dialog-header {
    font-size: 1.2em;
    font-weight: bold;
    margin-bottom: 15px;
    color: #333;
  }
  .footnote-dialog-textarea {
    width: 100%;
    min-height: 100px;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    margin-bottom: 15px;
    font-family: inherit;
    font-size: 1em;
    resize: vertical;
  }
  .footnote-dialog-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }
  .footnote-dialog-button {
    padding: 8px 16px;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    font-size: 0.9em;
    transition: background-color 0.2s;
  }
  .footnote-dialog-button.cancel {
    background-color: #f0f0f0;
    color: #333;
  }
  .footnote-dialog-button.submit {
    background-color: #0066cc;
    color: white;
  }
`;

// Dialog Manager

class DialogManager {
  constructor() {
    this.init();
  }

  init() {
    // Add styles

    const style = document.createElement("style");

    style.textContent = dialogStyles;

    document.head.appendChild(style);

    // Add dialog

    const div = document.createElement("div");

    div.innerHTML = dialogHTML;

    this.dialog = div.firstElementChild;

    document.body.appendChild(this.dialog);

    // Cache elements

    this.textarea = this.dialog.querySelector("textarea");

    this.submitBtn = this.dialog.querySelector(".submit");

    this.cancelBtn = this.dialog.querySelector(".cancel");

    // Setup event listeners

    this.setupEvents();
  }

  setupEvents() {
    // Close on overlay click

    this.dialog.addEventListener("click", (e) => {
      if (e.target === this.dialog) this.hide();
    });

    // Close on cancel

    this.cancelBtn.addEventListener("click", () => this.hide());

    // Submit on button click

    this.submitBtn.addEventListener("click", () => this.submit());

    // Keyboard shortcuts

    this.dialog.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.hide();

      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) this.submit();
    });
  }

  show(callback) {
    this.callback = callback;

    this.dialog.style.display = "flex";

    this.textarea.value = "";

    this.textarea.focus();
  }

  hide() {
    this.dialog.style.display = "none";

    this.callback = null;
  }

  submit() {
    const content = this.textarea.value.trim();

    if (content && this.callback) {
      this.callback(content);
    }

    this.hide();
  }
}

// Create single dialog instance

const dialogManager = new DialogManager();

export const FooterRef = Node.create({
  name: "footerRef",

  group: "inline",

  inline: true,

  atom: true,

  addAttributes() {
    return {
      number: {
        default: 1,

        parseHTML: (element) => {
          const dataNumber = element.getAttribute("data-number");

          if (dataNumber) return parseInt(dataNumber);

          const match = element.textContent.match(/$(\d+)$/);

          return match ? parseInt(match[1]) : 1;
        },

        renderHTML: (attributes) => ({
          "data-number": attributes.number,

          "class": "footnote-ref",
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "a.footnote-ref" }];
  },

  renderHTML({ node }) {
    return [
      "a",

      mergeAttributes(
        { "class": "footnote-ref" },
        { "data-number": node.attrs.number },
      ),

      `[${node.attrs.number}]`,
    ];
  },

  addStorage() {
    return {
      counter: 0,

      getFootnoteRefs(doc) {
        const refs = [];

        doc.descendants((node, pos) => {
          if (node.type.name === "footerRef") {
            refs.push({ node, pos });
          }
        });

        return refs.sort((a, b) => a.pos - b.pos);
      },

      getFootnoteRegistry(doc) {
        let registry = null;

        let citations = [];

        doc.descendants((node, pos) => {
          if (node.type.name === "footnoteRegistry") {
            registry = { node, pos };
          }

          if (node.type.name === "footnoteCitation") {
            citations.push({ node, pos });
          }
        });

        return { registry, citations };
      },

      createNewRegistry(editor, refs, oldCitations = []) {
        const schema = editor.schema;

        const citations = [];

        refs.forEach((ref, index) => {
          const newNumber = index + 1;

          const oldCitation = oldCitations.find((c) =>
            c.node.attrs.number === ref.node.attrs.number
          );

          citations.push(
            schema.nodes.footnoteCitation.create(
              { number: newNumber },
              oldCitation ? oldCitation.node.content.content : [
                schema.text(`[${newNumber}] `),
              ],
            ),
          );
        });

        return schema.nodes.footnoteRegistry.create(null, citations);
      },

      synchronizeFootnotes(editor) {
        const tr = editor.state.tr;

        const refs = this.getFootnoteRefs(tr.doc);

        const { registry, citations } = this.getFootnoteRegistry(tr.doc);

        refs.forEach((ref, index) => {
          const newNumber = index + 1;

          if (ref.node.attrs.number !== newNumber) {
            tr.setNodeMarkup(ref.pos, null, {
              ...ref.node.attrs,

              number: newNumber,
            });
          }
        });

        if (registry) {
          const newRegistry = this.createNewRegistry(editor, refs, citations);

          tr.replaceWith(
            registry.pos,
            registry.pos + registry.node.nodeSize,
            newRegistry,
          );
        }

        this.counter = refs.length;

        if (tr.steps.length > 0) {
          editor.view.dispatch(tr);
        }
      },
    };
  },

  addExtensions() {
    const FootnoteRegistry = Node.create({
      name: "footnoteRegistry",

      group: "block",

      content: "block+",

      parseHTML() {
        return [{ tag: "div[id=footnote-registry]" }];
      },

      renderHTML({ HTMLAttributes }) {
        return [
          "div",

          mergeAttributes(HTMLAttributes, { id: "footnote-registry" }),

          0,
        ];
      },
    });

    const FootnoteCitation = Node.create({
      name: "footnoteCitation",

      group: "block",

      content: "inline*",

      addAttributes() {
        return {
          number: {
            default: 1,

            parseHTML: (element) => {
              const dataNumber = element.getAttribute("data-number");

              return dataNumber ? parseInt(dataNumber) : 1;
            },

            renderHTML: (attributes) => ({
              "data-number": attributes.number,

              "class": "footnote-citation",
            }),
          },
        };
      },

      parseHTML() {
        return [
          { tag: "div[id=footnote-registry] p" },

          { tag: "p.footnote-citation" },
        ];
      },

      renderHTML({ node, HTMLAttributes }) {
        return [
          "p",

          mergeAttributes(HTMLAttributes, {
            "class": "footnote-citation",

            "data-number": node.attrs.number,
          }),

          0,
        ];
      },
    });

    return [FootnoteRegistry, FootnoteCitation];
  },

  addCommands() {
    return {
      insertFooterRef: () => ({ tr, editor, dispatch }) => {
        if (!dispatch) return true;

        dialogManager.show((content) => {
          const refs = this.storage.getFootnoteRefs(editor.state.doc);

          const nextNumber = refs.length + 1;

          // Create and insert reference

          const referenceNode = editor.schema.nodes.footerRef.create({
            number: nextNumber,
          });

          editor.commands.insertContent(referenceNode);

          // Find or create registry

          let registryNode = null;

          editor.state.doc.descendants((node, pos) => {
            if (node.type.name === "footnoteRegistry") {
              registryNode = { node, pos };

              return false;
            }
          });

          // Create citation with content

          const citationNode = editor.schema.nodes.footnoteCitation.create(
            { number: nextNumber },
            [
              editor.schema.text(`[${nextNumber}] `),

              editor.schema.text(content),
            ],
          );

          if (!registryNode) {
            const newRegistryNode = editor.schema.nodes.footnoteRegistry.create(
              null,
              [citationNode],
            );

            editor.commands.insertContent(newRegistryNode);
          } else {
            editor.commands.insertContentAt(
              registryNode.pos + registryNode.node.nodeSize - 2,
              citationNode,
            );
          }
        });

        return true;
      },
    };
  },

  onUpdate({ editor }) {
    setTimeout(() => {
      this.storage.synchronizeFootnotes(editor);
    }, 0);
  },
});
