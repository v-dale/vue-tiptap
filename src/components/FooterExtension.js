// FooterExtension.js
import { mergeAttributes, Node } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

// Move counter into the extension itself to avoid global state
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
              if (dataNumber) return parseInt(dataNumber);
              const match = element.textContent.match(/$(\d+)$/);
              return match ? parseInt(match[1]) : 1;
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
          {
            tag: "div[id=footnote-registry] p",
            priority: 100,
          },
          {
            tag: "p.footnote-citation",
            priority: 50,
          },
        ];
      },

      renderHTML({ node, HTMLAttributes }) {
        const number = node.attrs.number;
        return [
          "p",
          mergeAttributes(
            HTMLAttributes,
            {
              "class": "footnote-citation",
              "data-number": number,
            },
          ),
          `[${number}] `,
        ];
      },
    });

    return [FootnoteRegistry, FootnoteCitation];
  },

  addStorage() {
    return {
      counter: 0,
      updateCounter(doc) {
        let maxNumber = 0;
        if (doc) {
          doc.descendants((node) => {
            if (
              node.type.name === "footnoteCitation" ||
              node.type.name === "footerRef"
            ) {
              const num = parseInt(node.attrs.number) || 0;
              maxNumber = Math.max(maxNumber, num);
            }
          });
        }
        this.counter = maxNumber;
      },
    };
  },

  onUpdate({ editor }) {
    this.storage.updateCounter(editor.state.doc);
  },

  addCommands() {
    return {
      insertFooterRef: () => ({ tr, editor, dispatch }) => {
        if (!dispatch) return true;

        // Update counter using storage
        this.storage.updateCounter(tr.doc);
        this.storage.counter++;
        const currentNumber = this.storage.counter;

        const currentPos = tr.selection.from;

        const referenceNode = editor.schema.nodes.footerRef.create({
          number: currentNumber,
        });
        tr.replaceSelectionWith(referenceNode);

        let registryNode = null;
        tr.doc.descendants((node, pos) => {
          if (node.type.name === "footnoteRegistry") {
            registryNode = { node, pos };
            return false;
          }
        });

        const citationNode = editor.schema.nodes.footnoteCitation.create(
          { number: currentNumber },
          editor.schema.text(`[${currentNumber}] `),
        );

        if (!registryNode) {
          const newRegistryNode = editor.schema.nodes.footnoteRegistry.create(
            null,
            [citationNode],
          );
          tr.insert(tr.doc.content.size, newRegistryNode);
        } else {
          const registryEndPos = registryNode.pos + registryNode.node.nodeSize -
            2;
          tr.insert(registryEndPos, citationNode);
        }

        tr.setSelection(TextSelection.create(tr.doc, currentPos + 1));

        return true;
      },
    };
  },
});
