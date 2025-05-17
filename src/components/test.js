// Reference (anchor) Node Spec
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
          const match = element.textContent.match(/$(\d+)$$/);
          return match ? parseInt(match[1]) : 1;
        },
        renderHTML: (attributes) => ({
          "data-number": attributes.number,
          "class": "footnote-ref",
          href: `#fn${attributes.number}`,
        }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "a.footnote-ref" }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      "a",
      {
        ...HTMLAttributes,
        "data-number": node.attrs.number,
        class: "footnote-ref",
        href: `#fn${node.attrs.number}`,
      },
      `[${node.attrs.number}]`,
    ];
  },
});

// Footnote Citation Node Spec
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
          return dataNumber ? parseInt(dataNumber) : 1;
        },
        renderHTML: (attributes) => ({
          "data-number": attributes.number,
          "class": "footnote-citation",
          id: `fn${attributes.number}`,
        }),
      },
    };
  },
  parseHTML() {
    return [
      { tag: "p.footnote-citation" },
      { tag: "div.footnote-citation" },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      "p",
      {
        ...HTMLAttributes,
        "data-number": node.attrs.number,
        class: "footnote-citation",
        id: `fn${node.attrs.number}`,
      },
      0,
    ];
  },
});

// Footnote Registry Node Spec
const FootnoteRegistry = Node.create({
  name: "footnoteRegistry",
  group: "block",
  content: "block+",
  parseHTML() {
    return [
      { tag: 'aside.footnotes[aria-label="Footnotes"]' },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "aside",
      {
        ...HTMLAttributes,
        class: "footnotes",
        "aria-label": "Footnotes",
      },
      0,
    ];
  },
});

// , [
//   editor.schema.marks.link.create({
//     href: `#bk${nextNumber}`,
//     class: "footnote-backlink",
//     "aria-label": `Jump to reference ${nextNumber}`,
//   }),
// ]
//
//
