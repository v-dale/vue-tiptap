import { mergeAttributes, Node } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

// This function creates an object mapping footnote reference numbers
// to their corresponding citation nodes/content/positions.
function buildCitationObjectFromDoc(doc) {
  const citationMap = {};

  // Find all registry/citation nodes
  doc.descendants((node, pos) => {
    if (node.type && node.type.name === "footnoteCitation") {
      const refNumber = node.attrs.number;
      citationMap[refNumber] = {
        citationNode: node,
        content: node.content,
        pos: pos,
      };
    }
  });

  return citationMap;
}

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
          const match = element.textContent.match(/\$(\d+)$/);
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
      {
        "class": "footnote-ref",
        "data-number": node.attrs.number,
        "href": `#fn${node.attrs.number}`, // Added for linking!
        "id": `bk${node.attrs.number}`, // Each <a> now has id="bkN"
      },
      `[${node.attrs.number}]`,
    ];
  },

  addStorage() {
    return {
      citationMap: {},
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
        console.log("getFootnoteRegistry was called");
        doc.descendants((node, pos) => {
          if (node.type.name === "footnoteRegistry") {
            registry = { node, pos };
            console.log(registry);
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
        console.log("createNewRegistry was called");
        refs.forEach((ref, index) => {
          const newNumber = index + 1;
          const oldCitation = oldCitations.find((c) =>
            c.node.attrs.number === ref.node.attrs.number
          );
          citations.push(
            schema.nodes.footnoteCitation.create(
              { number: newNumber },
              oldCitation
                ? oldCitation.node.content.content
                : [schema.text(`${newNumber}`)],
            ),
          );
        });
        return schema.nodes.footnoteRegistry.create(null, citations);
      },
      synchronizeFootnotes(editor) {
        console.log("sync function was called");
      },
    };
  },

  addOptions() {
    return {
      createFooterRefNode(schema, number) {
        return schema.nodes.footerRef.create({ number });
      },
      createFootnoteCitationNode(schema, number, noteText) {
        const backlink = schema.text(`[${number}]`, [
          schema.marks.link.create({
            href: `#bk${number}`,
            class: "footnote-backlink",
            "aria-label": `Jump to reference ${number}`,
          }),
        ]);
        return schema.nodes.footnoteCitation.create(
          { number },
          [backlink, schema.text(" "), schema.text(noteText)],
        );
      },
      createFootnoteRegistryNode(schema, citations) {
        return schema.nodes.footnoteRegistry.create(null, citations);
      },

      insertFooterRef(editor, number, content) {
        // build the reference node
        const refNode = editor.schema.nodes.footerRef.create({ number });
        // build the citation node
        const backlink = this.createBacklink(editor.schema, number);
        const citationNode = editor.schema.nodes.footnoteCitation.create(
          { number },
          [backlink, editor.schema.text(" "), editor.schema.text(content)],
        );
        // insert the nodes as needed (this is an example -- actual impl depends on your app)
        editor.commands.insertContent(refNode);
        // maybe insert the citation in the registry, as appropriate
        // ...
        return true;
      },

      createBacklink(schema, number) {
        return schema.text(`[${number}]`, [
          schema.marks.link.create({
            href: `#bk${number}`,
            class: "footnote-backlink",
            "aria-label": `jump to reference ${number}`,
          }),
        ]);
      },
    };
  },

  addExtensions() {
    const FootnoteRegistry = Node.create({
      name: "footnoteRegistry",
      group: "block",
      content: "block+",
      parseHTML() {
        return [
          {
            tag: "footer#footnotes",
          },
        ];
      },
      renderHTML({ HTMLAttributes }) {
        return [
          "footer",
          {
            ...HTMLAttributes,
            id: "footnotes",
            "aria-label": "Footnotes",
          },
          0,
        ];
      },
    });
    const FootnoteCitation = Node.create({
      name: "footnoteCitation",
      group: "block",
      content: "inline*",
      priority: 1000,
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
              "id": `fn${attributes.number}`,
              "class": "footnote-citation",
            }),
          },
        };
      },
      parseHTML() {
        return [
          { tag: "p.footnote-citation" },
          { tag: "p[data-number].footnote-citation" },
        ];
      },
      renderHTML({ node, HTMLAttributes }) {
        return [
          "p",
          {
            ...HTMLAttributes,
            "data-number": node.attrs.number,
            "id": `fn${node.attrs.number}`,
            "class": "footnote-citation",
          },
          0,
        ];
      },
    });
    return [FootnoteRegistry, FootnoteCitation];
  },

  addCommands() {
    return {
      insertFooterRef: () => ({ editor, chain, commands }) => {
        // Step 1: Prompt user for citation content
        const citationText = window.prompt(
          "Enter the citation (footnote) text:",
        );
        if (!citationText || citationText.trim() === "") return false;

        // Get current selection position in the document
        const currentPos = editor.state.selection.$head.pos;

        // Step 2: Find existing footerRef nodes to determine the insertion index based on position
        const existingRefs = [];
        editor.state.doc.descendants((node, pos) => {
          if (node.type.name === "footerRef") {
            existingRefs.push({ node, pos });
          }
        });

        // Sort existing refs by position in the document
        existingRefs.sort((a, b) => a.pos - b.pos);

        // Determine the insertion index for the new reference based on its position relative to existing ones
        // This index tells us where the new reference will appear in the final sorted list of references.
        let insertIndex = 0;
        for (let i = 0; i < existingRefs.length; i++) {
          if (existingRefs[i].pos < currentPos) {
            insertIndex++;
          } else {
            break; // Found the insertion point: the new ref will be at this index (0-based)
          }
        }

        // The initial number for the new nodes will be this index + 1.
        // This number will be corrected later in the renumbering step.
        const initialNewNumber = insertIndex + 1;

        // Step 3: Create the new reference and citation nodes with the initial number
        const referenceNode = this.options.createFooterRefNode(
          editor.schema,
          initialNewNumber,
        );
        const citationNode = this.options.createFootnoteCitationNode(
          editor.schema,
          initialNewNumber,
          citationText,
        );

        // Step 4: Find the footnote registry node and its content range in the current document state
        let registryNode = null;
        let registryPos = null;
        let registryContentStartPos = null;
        let registryContentEndPos = null;

        editor.state.doc.descendants((node, pos) => {
          if (node.type.name === "footnoteRegistry") {
            registryNode = node;
            registryPos = pos;
            registryContentStartPos = pos + 1; // Position immediately inside the node's opening tag
            registryContentEndPos = pos + node.nodeSize - 1; // Position immediately before the node's closing tag
            return false; // Stop searching once the registry is found
          }
        });

        // Step 5: Build the command chain for insertions
        let commandChain = chain();

        // Always insert the new reference node at the current selection position
        // Use insertContentAt with the current selection position.
        commandChain = commandChain.insertContentAt(currentPos, referenceNode);

        // Step 6: Handle registry existence and find the correct insertion position for the new citation
        if (registryNode) {
          // Registry exists: Find all existing citations to determine insertion point
          const existingCitations = [];
          editor.state.doc.nodesBetween(
            registryContentStartPos,
            registryContentEndPos,
            (node, pos) => {
              if (node.type.name === "footnoteCitation") {
                // Store global position of the citation node
                existingCitations.push({ node, pos: pos });
              }
            },
          );

          // Sort existing citations by their position within the registry
          existingCitations.sort((a, b) => a.pos - b.pos);

          // Determine the insertion position for the new citation WITHIN the registry.
          // We want to insert the new citation such that it ends up at the index corresponding
          // to the new reference's insertIndex after sorting.
          let citationInsertPos = registryContentEndPos; // Default insertion point: end of registry content

          if (insertIndex < existingCitations.length) {
            // If the insertIndex is within the bounds of existing citations,
            // the new citation should be inserted *before* the citation currently at that index.
            citationInsertPos = existingCitations[insertIndex].pos;
          }
          // If insertIndex is >= existingCitations.length, it means the new reference is
          // after all existing references, so the new citation should go at the end of the registry,
          // which is already covered by the default value of citationInsertPos.

          // Add command to insert the new citation node at the calculated position within the registry
          // Ensure citationInsertPos is valid before attempting insertion
          if (citationInsertPos !== null) {
            // Use insertContentAt with the determined global position.
            commandChain = commandChain.insertContentAt(
              citationInsertPos,
              citationNode,
            );
          } else {
            console.warn(
              "Could not determine citation insertion position in registry. Citation not inserted.",
            );
            // In this case, only the reference will be inserted.
          }

          // Step 7: Add a command to renumber all footnotes and references AFTER insertions
          // This command executes on the document state resulting from the previous steps in the chain.
          // It uses tr.setNodeAttribute to modify attributes directly within the transaction.
          commandChain = commandChain.command(({ tr }) => { // Destructure tr from the callback arguments
            const updatedDoc = tr.doc; // Get the document state after previous insertions

            // Renumber References in the main document
            const allRefs = [];
            updatedDoc.descendants((node, pos) => {
              if (node.type.name === "footerRef") {
                allRefs.push({ node, pos });
              }
            });

            // Sort by position to ensure correct numbering order
            allRefs.sort((a, b) => a.pos - b.pos);

            // Apply renumbering to each reference node using tr.setNodeAttribute
            allRefs.forEach((ref, index) => {
              const correctNumber = index + 1;
              // Only set the attribute if it needs changing to avoid unnecessary transactions steps
              if (ref.node.attrs.number !== correctNumber) {
                tr.setNodeAttribute(ref.pos, "number", correctNumber);
              }
            });

            // Renumber Citations within the Footnote Registry
            // Find the updated registry node in the transaction document state
            let updatedRegistryNode = null;
            let updatedRegistryPos = null;
            updatedDoc.descendants((node, pos) => { // Use updatedDoc (tr.doc)
              if (node.type.name === "footnoteRegistry") {
                updatedRegistryNode = node;
                updatedRegistryPos = pos;
                return false; // Stop searching
              }
            });

            if (updatedRegistryNode) { // Check if updatedRegistryNode was found
              const allCitations = [];
              // Iterate through the content of the updated registry node
              updatedDoc.nodesBetween(
                updatedRegistryPos + 1,
                updatedRegistryPos + updatedRegistryNode.nodeSize - 1,
                (node, pos) => {
                  if (node.type.name === "footnoteCitation") {
                    // Position relative to the start of the document
                    const globalPos = pos;
                    allCitations.push({ node, pos: globalPos });
                  }
                },
              );

              // Sort by position to ensure correct numbering order after insertion
              allCitations.sort((a, b) => a.pos - b.pos);

              // Apply renumbering
              allCitations.forEach((citation, index) => {
                const correctNumber = index + 1;
                // Only set the attribute if it needs changing
                if (citation.node.attrs.number !== correctNumber) {
                  tr.setNodeAttribute(citation.pos, "number", correctNumber);
                  // The renderHTML for footnoteCitation uses the 'number' attribute
                  // to generate the [number] link text and the id="fnN".
                  // Updating the attribute should trigger the view update for these.
                }
              });
            }

            // Return the transaction. Returning true applies the transaction steps added within this command.
            return true;
          });
        } else {
          // Registry does NOT exist: Create a new one with the current citation and insert at the end of the document
          console.log("Footnote registry not found. Creating a new one.");
          // Call the existing helper function to create the registry node with the citation inside
          const newRegistryNode = this.options.createFootnoteRegistryNode(
            editor.schema,
            [citationNode],
          );
          // Determine the position to insert the new registry node (e.g., at the very end of the document)
          const endOfDocPos = editor.state.doc.content.size;

          // Build the command chain for this case
          commandChain = chain(); // Re-initialize chain for this branch
          commandChain = commandChain.insertContentAt(
            currentPos,
            referenceNode,
          ); // Insert reference at current position
          commandChain = commandChain.insertContentAt(
            endOfDocPos,
            newRegistryNode,
          ); // Insert new registry with citation at the end of the document

          // If we just created the first footnote, no further renumbering is needed
          // in this transaction branch as there are no other footnotes to adjust.
        }

        // Step 8: Run the single command chain to apply all changes
        return commandChain.run();
      },
    };
  },

  // Integration with the onCreate event inside the FooterExtension.js
  // (Assume this is within the export const FooterRef = Node.create({...}) structure)
  onCreate({ editor }) {
    // Build initial citation map on document load/initialization
    const doc = editor.state.doc;
    // Store on the extension's storage or elsewhere as appropriate
    this.citationMap = buildCitationObjectFromDoc(doc);
    // Optionally, synchronize footnotes right after map building
    // this.storage.synchronizeFootnotes(editor);
  },

  onUpdate({ editor }) {
    let pendingUpdate = false;
    return ({ transaction }) => {
      if (transaction.getMeta("fromFootnotes")) return;
      if (!pendingUpdate) {
        pendingUpdate = true;
        requestIdleCallback(() => {
          try {
            this.storage.synchronizeFootnotes(editor);
          } finally {
            pendingUpdate = false;
          }
        });
      }
    };
  },
});
