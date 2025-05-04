// Basic structure of a Tiptap Node
import { mergeAttributes, Node } from "@tiptap/core";

export const FooterRef = Node.create({
  // 1. Core Node Configuration
  name: "footerRef", // Unique identifier for this node type
  group: "inline", // Defines where this node can be used (inline with text)
  inline: true, // Indicates this node appears in line with text
  atom: true, // Makes node behave as a single unit (can't be split)

  /* Why these settings?
   * - name: Must be unique, used to reference this node type throughout the editor
   * - group: 'inline' allows node to be placed within text, like <p>text<our-node/>text</p>
   * - inline: true pairs with group:'inline' to ensure proper text flow
   * - atom: true prevents node from being split by user actions
   */

  // 2. Node Attributes
  addAttributes() {
    return {
      number: {
        default: 1, // Default value if no number specified

        // Converts HTML attributes to node attributes during parsing
        parseHTML: (element) => {
          // Try getting number from data-attribute first
          const dataNumber = element.getAttribute("data-number");
          if (dataNumber) return parseInt(dataNumber);

          // Fallback: parse number from content [1], [2], etc.
          const match = element.textContent.match(/$(\d+)$/);
          return match ? parseInt(match[1]) : 1;
        },

        // Converts node attributes to HTML attributes during rendering
        renderHTML: (attributes) => ({
          "data-number": attributes.number,
          "class": "footnote-ref",
        }),
      },
    };
  },
  /* Why attributes?
   * - Attributes store data associated with the node
   * - parseHTML: tells editor how to extract data from HTML
   * - renderHTML: tells editor how to save data back to HTML
   * - This maintains node state through HTML round-trip
   */

  // 3. HTML Parsing Configuration
  parseHTML() {
    return [{
      tag: "a.footnote-ref", // Match <a> tags with class='footnote-ref'
    }];
  },
  /* Why parseHTML?
   * - Tells editor what HTML elements should become this node
   * - Essential for loading existing content
   * - tag: 'a.footnote-ref' means <a class="footnote-ref">
   */

  // 4. HTML Rendering Configuration
  renderHTML({ node }) {
    return [
      "a", // Create <a> element
      mergeAttributes(
        { "class": "footnote-ref" }, // Default attributes
        { "data-number": node.attrs.number }, // Node-specific attributes
      ),
      `[${node.attrs.number}]`, // Text content
    ];
  },
  /* Why renderHTML?
   * - Defines how node appears in editor and final HTML
   * - Returns array describing element structure:
   *   ['tag', {attributes}, 'content']
   * - mergeAttributes combines default and node-specific attributes
   */
});
