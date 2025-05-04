// FooterExtension.js
import { mergeAttributes, Node } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

export const FooterRef = Node.create({
  // Basic node configuration
  name: "footerRef", // Unique name for the node
  group: "inline", // This node can be used inline with text
  inline: true, // Confirms this is an inline node
  atom: true, // Node is a single unit, not splittable

  // Define attributes that can be stored with the node
  addAttributes() {
    return {
      number: {
        default: 1, // Default value if no number is provided
        // Convert HTML attribute to node attribute during parsing
        parseHTML: (element) => {
          // First try to get number from data-attribute
          const dataNumber = element.getAttribute("data-number");
          if (dataNumber) return parseInt(dataNumber);

          // Fallback: try to extract number from content [1], [2], etc.
          const match = element.textContent.match(/$(\d+)$/);
          return match ? parseInt(match[1]) : 1;
        },
        // Convert node attribute to HTML attributes during rendering
        renderHTML: (attributes) => ({
          "data-number": attributes.number,
          "class": "footnote-ref",
        }),
      },
    };
  },

  // Define how to parse HTML into this node type
  parseHTML() {
    return [{
      tag: "a.footnote-ref", // Match <a> tags with class 'footnote-ref'
    }];
  },

  // Define how to render this node type to HTML
  renderHTML({ node }) {
    return [
      "a", // Create an <a> element
      mergeAttributes(
        { "class": "footnote-ref" },
        { "data-number": node.attrs.number },
      ),
      `[${node.attrs.number}]`, // The text content
    ];
  },

  // Define additional extensions required by this node
  addExtensions() {
    // Registry node - container for all footnote citations
    const FootnoteRegistry = Node.create({
      name: "footnoteRegistry",
      group: "block",
      content: "block+", // Can contain one or more blocks

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

    // Citation node - appears in the registry for each reference
    const FootnoteCitation = Node.create({
      name: "footnoteCitation",
      group: "block",
      content: "inline*", // Can contain zero or more inline nodes

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
          // Match paragraphs in registry with higher priority
          {
            tag: "div[id=footnote-registry] p",
            priority: 100,
          },
          // Match citation paragraphs anywhere else
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

  // Define persistent storage for the extension
  addStorage() {
    return {
      counter: 0, // Keeps track of footnote numbers
      // Helper function to update counter based on existing footnotes
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

  // Hook that runs when editor content updates
  onUpdate({ editor }) {
    this.storage.updateCounter(editor.state.doc);
  },

  // Define commands that can be called from the editor
  addCommands() {
    return {
      insertFooterRef: () => ({ tr, editor, dispatch }) => {
        if (!dispatch) return true;

        // Update and increment counter
        this.storage.updateCounter(tr.doc);
        this.storage.counter++;
        const currentNumber = this.storage.counter;

        // Store current cursor position
        const currentPos = tr.selection.from;

        // Create and insert the reference node
        const referenceNode = editor.schema.nodes.footerRef.create({
          number: currentNumber,
        });
        tr.replaceSelectionWith(referenceNode);

        // Find or create the registry
        let registryNode = null;
        tr.doc.descendants((node, pos) => {
          if (node.type.name === "footnoteRegistry") {
            registryNode = { node, pos };
            return false;
          }
        });

        // Create the citation node
        const citationNode = editor.schema.nodes.footnoteCitation.create(
          { number: currentNumber },
          editor.schema.text(`[${currentNumber}] `),
        );

        // Insert citation in registry
        if (!registryNode) {
          // Create new registry if none exists
          const newRegistryNode = editor.schema.nodes.footnoteRegistry.create(
            null,
            [citationNode],
          );
          tr.insert(tr.doc.content.size, newRegistryNode);
        } else {
          // Add to existing registry
          const registryEndPos = registryNode.pos + registryNode.node.nodeSize -
            2;
          tr.insert(registryEndPos, citationNode);
        }

        // Restore cursor position
        tr.setSelection(TextSelection.create(tr.doc, currentPos + 1));

        return true;
      },
    };
  },
});
