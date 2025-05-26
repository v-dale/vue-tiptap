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
      createBacklink(schema, number) {
        return schema.text(`[${number}]`, [
          schema.marks.link.create({
            href: `#bk${number}`,
            class: "footnote-backlink",
            "aria-label": `Jump to reference ${number}`,
          }),
        ]);
      },
      createFootnoteCitationNode(schema, number, noteText) {
        const backlink = this.createBacklink(schema, number);
        const actualNoteText = noteText && noteText.trim() !== ""
          ? noteText
          : `${number}`;
        return schema.nodes.footnoteCitation.create(
          { number },
          [backlink, schema.text(" "), schema.text(actualNoteText)],
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
        // Ensure editor and editor.state are valid before accessing selection
        if (!editor || !editor.state) {
          console.error(
            "Editor or editor.state is not available in getFootnoteInputData",
          );
          return null;
        }
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
      performFootnoteInsertion(
        editor,
        commandChain,
        { currentPos, initialNewNumber, citationText, refInsertIndex },
      ) {
        // commandChain here is the *actual* ChainedCommands instance
        console.log(
          "[performFootnoteInsertion] Received commandChain:",
          commandChain,
        );
        if (
          !commandChain || typeof commandChain.insertContentAt !== "function"
        ) {
          console.error(
            "[performFootnoteInsertion] Invalid commandChain received!",
            commandChain,
          );
          return false;
        }

        const { schema } = editor;
        const referenceNode = this.createFooterRefNode(
          schema,
          initialNewNumber,
        );
        const citationNodeForRegistry = this.createFootnoteCitationNode(
          schema,
          initialNewNumber,
          citationText,
        );

        let currentActiveChain = commandChain.insertContentAt(
          currentPos,
          referenceNode,
        );

        const registryInfo = this.getRegistryInfo(editor.state.doc);

        if (registryInfo) {
          const citationsInRegistry = [];
          editor.state.doc.nodesBetween(
            registryInfo.contentStartPos,
            registryInfo.contentEndPos,
            (node, pos) => {
              if (node.type.name === "footnoteCitation") {
                citationsInRegistry.push({ node, pos });
              }
            },
          );
          citationsInRegistry.sort((a, b) => a.pos - b.pos);
          let citationInsertPosInRegistry = registryInfo.contentStartPos +
            registryInfo.node.content.size;
          if (refInsertIndex < citationsInRegistry.length) {
            citationInsertPosInRegistry =
              citationsInRegistry[refInsertIndex].pos;
          } else if (
            citationsInRegistry.length > 0 &&
            refInsertIndex >= citationsInRegistry.length
          ) {
            citationInsertPosInRegistry =
              citationsInRegistry[citationsInRegistry.length - 1].pos +
              citationsInRegistry[citationsInRegistry.length - 1].node.nodeSize;
          }
          currentActiveChain = currentActiveChain.insertContentAt(
            citationInsertPosInRegistry,
            citationNodeForRegistry,
          );
        } else {
          const newRegistryNode = this.createFootnoteRegistryNode(schema, [
            citationNodeForRegistry,
          ]);
          const endOfDocPos = editor.state.doc.content.size;
          currentActiveChain = currentActiveChain.insertContentAt(
            endOfDocPos,
            newRegistryNode,
          );
        }

        currentActiveChain = currentActiveChain.command(({ tr }) => {
          //this.renumberAllFootnotes(tr, editor.schema);
          return true;
        });

        return currentActiveChain.run();
      },
      renumberAllFootnotes(tr, schema) {
        // ... (renumberAllFootnotes logic remains the same)
        console.log("Renumbering all footnotes...");
        const allRefsInTransaction = [];
        tr.doc.descendants((node, pos) => {
          if (node.type.name === "footerRef") {
            allRefsInTransaction.push({ node, pos });
          }
        });
        allRefsInTransaction.sort((a, b) => a.pos - b.pos);

        allRefsInTransaction.forEach((ref, index) => {
          const correctNumber = index + 1;
          if (ref.node.attrs.number !== correctNumber) {
            tr.setNodeAttribute(ref.pos, "number", correctNumber);
          }
        });

        let updatedRegistryNodeInTransaction = null;
        let updatedRegistryPosInTransaction = null;
        tr.doc.descendants((node, pos) => {
          if (node.type.name === "footnoteRegistry") {
            updatedRegistryNodeInTransaction = node;
            updatedRegistryPosInTransaction = pos;
            return false;
          }
        });

        if (updatedRegistryNodeInTransaction) {
          const allCitationsInTransaction = [];
          tr.doc.nodesBetween(
            updatedRegistryPosInTransaction + 1,
            updatedRegistryPosInTransaction +
              updatedRegistryNodeInTransaction.nodeSize - 1,
            (node, pos) => {
              if (node.type.name === "footnoteCitation") {
                allCitationsInTransaction.push({ node, pos });
              }
            },
          );
          allCitationsInTransaction.sort((a, b) => a.pos - b.pos);

          allCitationsInTransaction.forEach((citationInfo, index) => {
            const correctNumber = index + 1;
            const oldNode = citationInfo.node;
            const oldPos = citationInfo.pos;
            let userProvidedNoteText = "";
            if (oldNode.content && oldNode.content.childCount === 2) {
              const backlinkNode = oldNode.content.child(0);
              const combinedTextNode = oldNode.content.child(1);
              if (
                backlinkNode.isText && backlinkNode.marks.some((m) =>
                  m.type.name === "link"
                ) && combinedTextNode.isText
              ) {
                const fullTextFromNode = combinedTextNode.textContent;
                userProvidedNoteText = fullTextFromNode.startsWith(" ")
                  ? fullTextFromNode.substring(1)
                  : fullTextFromNode;
              } else userProvidedNoteText = oldNode.attrs.number.toString();
            } else userProvidedNoteText = oldNode.attrs.number.toString();
            if (userProvidedNoteText.trim() === "") {
              userProvidedNoteText = correctNumber.toString();
            }

            if (
              oldNode.attrs.number !== correctNumber ||
              oldNode.content.child(0).textContent !== `[${correctNumber}]` ||
              oldNode.content.child(1).textContent !==
                ` ${userProvidedNoteText}`
            ) {
              const newCitationNode = this.createFootnoteCitationNode(
                schema,
                correctNumber,
                userProvidedNoteText,
              );
              tr.replaceWith(
                oldPos,
                oldPos + oldNode.nodeSize,
                newCitationNode,
              );
            }
          });
        }
        return true;
      },
    };
  },

  addExtensions() {
    const FootnoteRegistry = Node.create({
      name: "footnoteRegistry",
      group: "block",
      content: "footnoteCitation+",
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
      priority: 10,
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

  // Debugging tool: Observe and log all transactions
  onTransaction({ transaction, editor }) { // Added editor here if needed for schema
    console.log(
      "🚀 Transaction Fired. Document ID:",
      transaction.doc.attrs.id || "N/A",
      "Steps:",
      transaction.steps.length,
    );

    if (transaction.steps.length > 0) {
      console.log("   TRANSACTION STEP DETAILS:");
      transaction.steps.forEach((step, index) => {
        console.log(`   Step ${index}:`, step.toJSON());
        // Log content being inserted by ReplaceStep or ReplaceAroundStep
        if (step.slice && step.slice.content && step.slice.content.size > 0) {
          console.log(`     Step ${index} is inserting content:`);
          step.slice.content.forEach((contentNode, cIndex) => {
            console.log(
              `       Slice Child ${cIndex}: Type=${contentNode.type.name}, TextContent="${contentNode.textContent}", Attrs=${
                JSON.stringify(contentNode.attrs)
              }`,
            );
            if (contentNode.content.size > 0) {
              contentNode.content.forEach((innerChild, iIndex) => {
                console.log(
                  `         Inner Child ${iIndex} of Slice Child: Type=${innerChild.type.name}, TextContent="${innerChild.textContent}"`,
                );
              });
            }
          });
        }
      });
    }

    console.log("   DOCUMENT SCAN (after this transaction):");
    transaction.doc.descendants((node, pos) => {
      if (node.type.name === "footnoteCitation") {
        console.log(
          `   📌 FootnoteCitation Node Found - Pos ${pos}, Type: ${node.type.name}, Attrs: ${
            JSON.stringify(node.attrs)
          }, NodeSize: ${node.nodeSize}, ChildCount: ${node.childCount}`,
        );
        node.content.forEach((child, offset, index) => {
          console.log(
            `     Child ${index} of Citation: Type=${child.type.name}, TextContent="${child.textContent}", IsText=${child.isText}, IsBlock=${child.isBlock}, Attrs=${
              JSON.stringify(child.attrs)
            }, Size=${child.nodeSize}`,
          );
        });
      }
      // Optional: Log footerRef too to see its context
      // if (node.type.name === "footerRef") {
      //   console.log(
      //       `   REF Node Found - Pos ${pos}, Type: ${node.type.name}, ParentType: ${transaction.doc.resolve(pos).parent.type.name}`
      //   );
      // }
    });

    if (Object.keys(transaction.meta).length > 0) {
      console.log("   Transaction metadata:", transaction.meta);
    }
    console.log("--- End of Transaction Log ---");
  },

  addCommands() {
    return {
      // Command structure: () => (CommandProps) => result
      insertFooterRef:
        () => ({ editor, chain: chainFactory, tr, dispatch, state, view }) => {
          // 'this' here is the extension instance (due to outer arrow function capturing 'this' from addCommands scope)
          console.log(
            "[insertFooterRef - Inner func] Editor:",
            editor,
            "ChainFactory:",
            chainFactory,
          );

          if (typeof chainFactory !== "function") {
            console.error(
              "Critical: chainFactory from CommandProps is not a function!",
              chainFactory,
            );
            return false; // Cannot proceed
          }

          // Call the chainFactory() to get the actual ChainedCommands instance
          const activeChain = chainFactory();

          console.log(
            "[insertFooterRef - Inner func] activeChain created. Typeof insertContentAt:",
            typeof activeChain.insertContentAt,
          );
          if (typeof activeChain.insertContentAt !== "function") {
            console.error(
              "Critical: activeChain.insertContentAt is not a function! Problem with chainFactory.",
              activeChain,
            );
            return false; // Cannot proceed
          }

          // 'this.options' correctly refers to the options object of the extension.
          // 'editor' is from CommandProps.
          const inputData = this.options.getFootnoteInputData(editor);
          if (!inputData) {
            console.log(
              "[insertFooterRef - Inner func] User cancelled prompt or no input.",
            );
            return false;
          }

          const { insertIndex, initialNewNumber } = this.options
            .calculateNewRefInsertIndexAndNumber(
              editor.state.doc,
              inputData.currentPos,
            );

          return this.options.performFootnoteInsertion(editor, activeChain, { // Pass the *activeChain*
            currentPos: inputData.currentPos,
            initialNewNumber,
            citationText: inputData.citationText,
            refInsertIndex: insertIndex,
          });
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
    console.log("------- EDITOR onCreate -------");
    console.log("Initial document state:");
    editor.state.doc.descendants((node, pos, parent) => {
      const parentType = parent ? parent.type.name : "null";
      console.log(
        `Node: ${node.type.name}, Pos: ${pos}, Size: ${node.nodeSize}, Text: "${
          node.textContent.substring(0, 20)
        }", Attrs: ${JSON.stringify(node.attrs)}, Parent: ${parentType}`,
      );
    });
    console.log("-----------------------------");
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
