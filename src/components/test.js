import { mergeAttributes, Node } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

// This function creates an object mapping footnote reference numbers
// to their corresponding citation nodes/content/positions.
function buildCitationObjectFromDoc(doc) {
  const citationMap = {};
  // Find all registry/citation nodes
  doc.descendants((node, pos) => {
    console.log(node.type);
    if (node.type && node.type.name === "footnoteCitation") {
      const refNumber = node.attrs.number;
      citationMap[refNumber] = {
        citationNode: node,
        content: node.content,
        pos: pos,
      };
    }
  });
  console.log(citationMap);
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
        "id": `bk${node.attrs.number}`, // Each &lt;a&gt; now has id="bkN"
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
        return schema.nodes.footnoteCitation.create({ number }, [
          backlink,
          schema.text(" "),
          schema.text(noteText),
        ]);
      },
      // This function already exists and can be used to create the registry node
      createFootnoteRegistryNode(schema, citations) {
        // Ensure citations is an array, default to empty if not provided
        const citationNodes = Array.isArray(citations) ? citations : [];
        return schema.nodes.footnoteRegistry.create(null, citationNodes);
      },
      insertFooterRef(editor, number, content) {
        // build the reference node
        const refNode = editor.schema.nodes.footerRef.create({ number });
        // build the citation node
        const backlink = this.createBacklink(editor.schema, number);
        const citationNode = this.options.createFootnoteCitationNode(
          { number },
          [
            backlink,
            editor.schema.text(" "),
            editor.schema.text(content),
          ],
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
        return [{
          tag: "footer#footnotes",
        }];
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
              console.log("FootnoteCitation ParseHTML");
              const dataNumber = element.getAttribute("data-number");
              console.log(`number have found ${dataNumber}`);
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
        return [{
          tag: "p.footnote-citation",
        }, {
          tag: "p[data-number].footnote-citation",
        }];
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
      insertFooterRef: () =>
      ({
        editor,
        chain,
      }) => {
        // Step 1: Prompt user for citation content
        const citationText = window.prompt(
          "Enter the citation (footnote) text:",
        );
        if (!citationText || citationText.trim() === "") return false;

        // Step 2: Find next available footnote number
        let nextNumber = 1;
        editor.state.doc.descendants((node) => {
          if (
            node.type.name === "footerRef" &&
            typeof node.attrs.number === "number"
          ) {
            if (node.attrs.number >= nextNumber) {
              nextNumber = node.attrs.number + 1;
            }
          }
        });

        // Step 3: Create nodes using helpers from addOptions
        const referenceNode = this.options.createFooterRefNode(
          editor.schema,
          nextNumber,
        );
        const citationNode = this.options.createFootnoteCitationNode(
          editor.schema,
          nextNumber,
          citationText,
        );

        // Step 4: Find the footnote registry node and its end position
        let registryNode = null;
        let registryEndPos = null;
        editor.state.doc.descendants((node, pos) => {
          if (node.type.name === "footnoteRegistry") {
            registryNode = node;
            // Calculate the position right before the closing tag of the registry
            // This is where new content should be appended.
            registryEndPos = pos + node.nodeSize - 1;
            return false; // stop searching once found
          }
        });

        // Step 5: Build the command chain
        let commandChain = chain();

        // Always insert the reference node at the current selection
        commandChain = commandChain.insertContent(referenceNode);

        // Step 6: Check if registry exists and insert citation or create registry
        if (registryNode && registryEndPos !== null) {
          // Registry exists: Insert the citation at the end of the registry
          commandChain = commandChain.insertContentAt(
            registryEndPos,
            citationNode,
          );
        } else {
          // Registry does NOT exist: Create it with the current citation and insert at the end of the document
          console.log("Footnote registry not found. Creating a new one.");
          // Call the existing helper function to create the registry node with the citation inside
          const newRegistryNode = this.options.createFootnoteRegistryNode(
            editor.schema,
            [citationNode],
          );
          // Insert the new registry node at the very end of the document
          const endOfDocPos = editor.state.doc.content.size;
          commandChain = commandChain.insertContentAt(
            endOfDocPos,
            newRegistryNode,
          );
        }

        // Step 7: Run the single chain
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
