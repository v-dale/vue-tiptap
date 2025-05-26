import { Fragment, mergeAttributes, Node } from "@tiptap/core";

// buildCitationObjectFromDoc, other helpers from previous version...

export const FooterRef = Node.create({
  name: "footerRef",
  group: "inline",
  inline: true,
  atom: true, // Important for it to be treated as a single unit

  addAttributes() {
    return {
      number: {
        default: 1,
        // This parseHTML is mainly for programmatic creation or other non-paste scenarios
        // if the main parseHTML rule below handles paste.
        parseHTML: (element) => {
          const dataNumber = element.getAttribute("data-number");
          if (dataNumber) return parseInt(dataNumber, 10);
          const textMatch = element.textContent.match(/$(\d+)$$/);
          return textMatch ? parseInt(textMatch[1], 10) : 1;
        },
        renderHTML: (attributes) => ({
          "data-number": attributes.number,
          "class": "footnote-ref", // class used for parsing
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "a.footnote-ref[data-number]", // More specific selector
        priority: 51, // Higher priority to ensure it runs before generic <a> rules
        getAttrs: (domNode) => {
          const numberStr = domNode.getAttribute("data-number");
          if (numberStr) {
            const number = parseInt(numberStr, 10);
            if (!isNaN(number)) {
              return { number: number };
            }
          }
          return false; // If no data-number or not a valid number, rule doesn't match
        },
      },
      // Fallback for content that might not have data-number but matches class and text
      {
        tag: "a.footnote-ref",
        priority: 50, // Lower priority than the one with data-number
        getAttrs: (domNode) => {
          const textMatch = domNode.textContent.match(/$(\d+)$$/);
          if (textMatch) {
            return { number: parseInt(textMatch[1], 10) };
          }
          return false;
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        "class": "footnote-ref", // Ensure this class is present
        "data-number": node.attrs.number,
        "href": `#fn${node.attrs.number}`,
        "id": `bk${node.attrs.number}`, // For jumping from citation back to ref
      }),
      `[${node.attrs.number}]`, // Visible text
    ];
  },

  // storage, options, commands, etc. (largely unchanged from your previous correct version)
  // ... (Make sure createFootnoteCitationNode in options correctly generates
  //      content that includes a Link mark for the backlink, as it did before)

  addStorage() {
    // ... (from previous version) ...
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
        const newCitations = [];
        refs.forEach((ref, index) => {
          const newNumber = index + 1;
          const oldCitation = oldCitations.find((c) =>
            c.node.attrs.number === ref.node.attrs.number
          );
          newCitations.push(
            this.options.createFootnoteCitationNode(
              schema,
              newNumber,
              oldCitation
                ? oldCitation.node.textContent.replace(/^$\d+$\s*/, "").trim()
                : `${newNumber}`, // Simplified text extraction
            ),
          );
        });
        return this.options.createFootnoteRegistryNode(schema, newCitations);
      },
      synchronizeFootnotes(editor) {
        console.log("sync function was called (placeholder)");
      },
    };
  },

  addOptions() {
    return {
      createFooterRefNode(schema, number) {
        return schema.nodes.footerRef.create({ number });
      },
      createBacklink(schema, number) {
        // This MUST create a text node with a 'link' mark.
        // Assumes 'link' mark is available in schema.
        if (!schema.marks.link) {
          console.warn(
            "Schema is missing 'link' mark. Footnote backlinks may not work correctly.",
          );
          return schema.text(`[${number}]`); // Fallback if no link mark
        }
        return schema.text(`[${number}]`, [
          schema.marks.link.create({
            href: `#bk${number}`,
            class: "footnote-backlink",
            // target: "_blank", // Usually not desired for internal anchor links
            "aria-label": `Jump to reference ${number}`,
          }),
        ]);
      },
      createFootnoteCitationNode(schema, number, noteText) {
        const backlink = this.createBacklink(schema, number);
        const actualNoteTextContent = (noteText && noteText.trim() !== "")
          ? noteText
          : `${number}`;
        const textNode = schema.text(" " + actualNoteTextContent); // Add leading space after backlink

        // Content for footnoteCitation (inline*): an array of inline nodes
        return schema.nodes.footnoteCitation.create(
          { number },
          [backlink, textNode], // Array of inline nodes
        );
      },
      createFootnoteRegistryNode(schema, citations = []) {
        return schema.nodes.footnoteRegistry.create(null, citations);
      },
      getFootnoteInputData(editor) {
        const citationText = window.prompt(
          "Enter the citation (footnote) text:",
        );
        if (!citationText || citationText.trim() === "") return null;
        if (!editor || !editor.state) return null;
        const currentPos = editor.state.selection.$head.pos;
        return { citationText, currentPos };
      },
      calculateNewRefInsertIndexAndNumber(doc, currentPos) {
        const existingRefs = [];
        doc.descendants((node, pos) => {
          if (node.type.name === "footerRef") existingRefs.push({ node, pos });
        });
        existingRefs.sort((a, b) => a.pos - b.pos);
        let insertIndex = 0;
        for (let i = 0; i < existingRefs.length; i++) {
          if (existingRefs[i].pos < currentPos) insertIndex++;
          else break;
        }
        const initialNewNumber = insertIndex + 1;
        return { insertIndex, initialNewNumber };
      },
      getRegistryInfo(doc) {
        let registryNode = null, registryPos = null;
        doc.descendants((node, pos) => {
          if (node.type.name === "footnoteRegistry") {
            registryNode = node;
            registryPos = pos;
            return false;
          }
        });
        if (registryNode) {
          return {
            node: registryNode,
            pos: registryPos,
            contentStartPos: registryPos + 1,
            contentEndPos: registryPos + registryNode.nodeSize - 1,
          };
        }
        return null;
      },
      performFootnoteInsertion(/* ... unchanged ... */) {/* ... */},
      renumberAllFootnotes(
        /* ... unchanged, but ensure it's robust if you re-enable it ... */
      ) {/* ... */},
    };
  },

  addExtensions() {
    const FootnoteRegistry = Node.create({
      name: "footnoteRegistry",
      group: "block",
      content: "footnoteCitation+",
      defining: true,
      isolating: true,
      parseHTML() {
        return [{ tag: "footer#footnotes" }]; // Matches <footer id="footnotes">
      },
      renderHTML({ HTMLAttributes }) {
        return [
          "footer",
          mergeAttributes(HTMLAttributes, {
            id: "footnotes",
            "aria-label": "Footnotes",
          }),
          0,
        ];
      },
    });

    const FootnoteCitation = Node.create({
      name: "footnoteCitation",
      group: "block",
      content: "inline*", // CRITICAL: Allows text, and crucially, MARKS like 'link'
      defining: true,
      // priority: 10, // Default priority is usually fine here
      addAttributes() {
        return {
          number: {
            default: 1,
            parseHTML: (element) =>
              element.getAttribute("data-number")
                ? parseInt(element.getAttribute("data-number"), 10)
                : 1,
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
          {
            tag: "p.footnote-citation",
            // For parsing content, Tiptap/ProseMirror will look at the children of this <p>
            // (e.g., <a class="footnote-backlink">...</a> and text nodes)
            // and try to match them against the `inline*` content definition.
            // THIS RELIES ON A LINK MARK EXTENSION BEING PRESENT IN THE EDITOR SCHEMA
            // to parse the <a> tag into a 'link' mark.
          },
          { tag: "p[data-number].footnote-citation" },
        ];
      },
      renderHTML({ node, HTMLAttributes }) {
        return [
          "p",
          mergeAttributes(HTMLAttributes, {
            "id": `fn${node.attrs.number}`,
            "class": "footnote-citation",
          }),
          0,
        ];
      },
    });
    return [FootnoteRegistry, FootnoteCitation];
  },

  addCommands() {/* ... unchanged ... */},
  onCreate({ editor }) {/* ... unchanged ... */},
  onTransaction({ transaction, editor }) {
    /* ... unchanged, keep your detailed logging ... */
  },
});
