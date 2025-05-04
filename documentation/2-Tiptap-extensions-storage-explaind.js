export const FooterRef = Node.create({
  // ... basic configuration from Part 1 ...

  // 5. Additional Required Extensions
  addExtensions() {
    // Registry node - Container for footnotes
    const FootnoteRegistry = Node.create({
      name: "footnoteRegistry",
      group: "block", // Appears as block element (like paragraph)
      content: "block+", // Can contain one or more block elements

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
    /* Why FootnoteRegistry?
     * - Acts as container for all footnote citations
     * - group: 'block' makes it a top-level element
     * - content: 'block+' allows it to contain other blocks
     * - Appears at bottom of document
     */

    // Citation node - Individual footnote entries
    const FootnoteCitation = Node.create({
      // ... citation node configuration ...
    });

    return [FootnoteRegistry, FootnoteCitation];
  },
  /* Why addExtensions?
   * - Bundles related nodes together
   * - Ensures all required node types are available
   * - Keeps code organized and modular
   */

  // 6. Extension Storage (State Management)
  addStorage() {
    return {
      counter: 0, // Tracks highest footnote number

      // Updates counter based on existing footnotes
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
  /* Why Storage?
   * - Maintains state between editor operations
   * - Persists data across editor lifecycle
   * - Provides shared state for extension features
   */

  // 7. Editor Update Hook
  onUpdate({ editor }) {
    this.storage.updateCounter(editor.state.doc);
  },
  /* Why onUpdate?
   * - Responds to editor content changes
   * - Keeps counter synchronized with content
   * - Ensures footnote numbers stay consistent
   */
});
