---
title: "Chapter 1 — Getting Started with LUMI"
nav_order: 2
---

# Chapter 1 — Getting Started with LUMI

This is an example of an extra page. Use chapters like this to add structure and split your materials into modules instead of a single long page.

Every page here is written in Markdown% and starts with Front Matter%. Hover
over those highlighted words to see their glossary definitions — defined once in
`content/glossary.md`.

You can even **add subchapters** by creating another `.md` file (e.g. `chapter1-1.md`) and using the `parent` field. Update this file's frontmatter to mark it as a parent:

```yaml
---
title: "Chapter 1 — Getting Started with LUMI"
nav_order: 2
has_children: true
---
```

…and the new subchapter's frontmatter as:

```yaml
---
title: "Authentication & Environment"
parent: "Chapter 1 — Getting Started with LUMI"
nav_order: 1
---
```

> [!warning] Before you publish
> Double-check `nav_order` across all pages so the sidebar reads
> top-to-bottom in the order you teach. Mismatched ordering is the most
> common authoring mistake.

The `parent` value must match the parent page's `title` exactly.

> [!warning]
> Don't rename `index.md` — it's the home page of the site. All other pages can be named arbitrarily. 
> All `.md` files in `content/` (except `index.md`) can be named anything you like. The URL is derived from the filename.

## Quick quiz

Test what you picked up in this chapter:

```quiz
title: Getting started with LUMI

Q: Which file is always the home page of the site?
- [ ] home.md
- [x] index.md
- [ ] readme.md
> index.md is special — every other page can be named freely.

---

Q: Which front matter fields control where a page sits in the sidebar? (select all)
- [x] nav_order
- [x] parent
- [ ] slug
- [ ] author
> nav_order sets the order and parent nests a page under another. The URL comes from the filename, not a slug field.

---

Q: How do you mark the correct answer in a quiz block?
- [ ] With an asterisk before the option
- [x] With a checked Markdown checkbox, [x]
- [ ] By writing "correct" after it
> Use - [x] for correct answers and - [ ] for wrong ones.
```
