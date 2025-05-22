import { Link } from "@tiptap/extension-link";

const CustomLink = Link.extend({
  addAttributes() {
    // Merge the parent's attributes and add our own id attribute.
    return {
      ...this.parent?.(),
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute("id"),
        renderHTML: (attributes) => {
          return attributes.id ? { id: attributes.id } : {};
        },
      },
      // Override the "rel" attribute so that it doesn't output a value.
      rel: {
        default: null,
        parseHTML: (element) => null,
        renderHTML: () => ({}),
      },
    };
  },
  renderHTML({ HTMLAttributes }) {
    // Remove rel completely from the final output by merging an empty rel.
    return ["a", { ...HTMLAttributes, rel: null }, 0];
  },
});

export default CustomLink;
