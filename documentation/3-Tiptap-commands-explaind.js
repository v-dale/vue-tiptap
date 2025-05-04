export const FooterRef = Node.create({
  // ... previous parts ...

  // 8. Editor Commands
  addCommands() {
    return {
      insertFooterRef: () => ({ tr, editor, dispatch }) => {
        if (!dispatch) return true; // Command validation phase

        // Update footnote counter
        this.storage.updateCounter(tr.doc);
        this.storage.counter++;
        const currentNumber = this.storage.counter;

        // Store cursor position
        const currentPos = tr.selection.from;

        // Create reference node
        const referenceNode = editor.schema.nodes.footerRef.create({
          number: currentNumber,
        });

        // Insert reference at cursor
        tr.replaceSelectionWith(referenceNode);

        // Find registry or prepare to create it
        let registryNode = null;
        tr.doc.descendants((node, pos) => {
          if (node.type.name === "footnoteRegistry") {
            registryNode = { node, pos };
            return false;
          }
        });

        // Create citation node
        const citationNode = editor.schema.nodes.footnoteCitation.create(
          { number: currentNumber },
          editor.schema.text(`[${currentNumber}] `),
        );

        // Add citation to registry
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
  /* Why Commands?
   * - Provides interface for editor interactions
   * - Handles complex document transformations
   * - Manages document structure and content
   *
   * Command Flow:
   * 1. Update counter
   * 2. Create and insert reference
   * 3. Find or create registry
   * 4. Create and insert citation
   * 5. Restore cursor
   *
   * Transaction (tr):
   * - Represents a document change
   * - All changes are atomic (all or nothing)
   * - Maintains document consistency
   */
});
