import { blockSlug, splitPageBlocks } from "./page-blocks";
import { isNotebookPath, notebookToMarkdown } from "./notebook";

/**
 * Let authors size a collapsible title with normal markdown:
 *   <summary>### Exercise 1</summary>
 *
 * Markdown is not parsed inside a raw HTML line, so the heading is lifted onto
 * a block of its own (the blank lines end and restart the surrounding HTML
 * block, and rehype-raw stitches the pieces back together). It then behaves
 * like every other heading: real heading size, a slug id, a copy-link icon,
 * and an entry in the table of contents. Lines inside fenced code blocks are
 * left alone, so documenting the syntax in a code fence still shows it as
 * written.
 */
function expandSummaryHeadings(body: string): string {
  if (!body.includes("<summary")) return body;
  const out: string[] = [];
  let fence = "";
  for (const line of body.split("\n")) {
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = "";
      out.push(line);
      continue;
    }
    if (fence) {
      out.push(line);
      continue;
    }
    const m = line.match(
      /^([ \t]*)(<summary(?:\s[^>]*)?>)[ \t]*(#{1,6}[ \t]+.+?)[ \t]*(<\/summary>[ \t]*)$/i,
    );
    out.push(m ? `${m[1]}${m[2]}\n\n${m[1]}${m[3]}\n\n${m[1]}${m[4]}` : line);
  }
  return out.join("\n");
}

export interface PageFrontmatter {
  title: string;
  nav_order?: number;
  parent?: string;
  /** Accepted for Just the Docs-style front matter, but not required — nesting
   * is driven entirely by the children's `parent` fields. */
  has_children?: boolean;
  /** Optional meta description. When omitted, one is derived from the body. */
  description?: string;
}

export interface Page {
  /** URL slug — "" for index, otherwise filename without extension. */
  slug: string;
  /** Filesystem-style path used for "edit on GitHub". */
  path: string;
  frontmatter: PageFrontmatter;
  body: string;
  /**
   * Set only on a page written inside another page's file: the slug of that
   * file's own page. Such a page always nests under the page it was written
   * in, so it needs no `parent` of its own.
   */
  parentSlug?: string;
}

const rawModules = import.meta.glob("/content/**/*.{md,ipynb}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function fileToSlug(filePath: string): string {
  // "/content/index.md" -> ""
  // "/content/chapter1.md" -> "chapter1"
  // "/content/sub/page.md" -> "sub/page"
  // "/content/01_intro.ipynb" -> "01_intro"
  const rel = filePath.replace(/^\/content\//, "").replace(/\.(md|ipynb)$/, "");
  return rel === "index" ? "" : rel;
}

/**
 * Every page of the site. Usually one per `.md` file, but a file that ends in
 * further front-matter blocks contributes one page per block, so a chapter can
 * keep its subchapters in the same file. Those extra pages are ordinary in
 * every way: their own URL, sidebar entry, breadcrumbs and Previous/Next step.
 *
 * A `.ipynb` file is a page too: it is converted to markdown on the way in and
 * is indistinguishable from a `.md` file from here on.
 */
export const pages: Page[] = Object.entries(rawModules)
  .flatMap(([filePath, raw]) => {
    const path = filePath.replace(/^\//, "");
    const fileSlug = fileToSlug(filePath);
    const warn = (message: string) => console.warn(`[content] ${path}: ${message}`);
    const text = isNotebookPath(filePath)
      ? notebookToMarkdown(raw, filePath.replace(/^\/content\//, ""), warn)
      : raw;
    const blocks = splitPageBlocks(text, warn);
    return blocks.map((block, i) => ({
      slug: i === 0 ? fileSlug : blockSlug(block.data, fileSlug, i),
      path,
      frontmatter: block.data as unknown as PageFrontmatter,
      body: expandSummaryHeadings(block.content),
      // Written inside `fileSlug`'s file, so it hangs under that page. Sorting
      // below is stable, which keeps blocks in the order they were written.
      ...(i === 0 ? {} : { parentSlug: fileSlug }),
    }));
  })
  .sort((a, b) => (a.frontmatter.nav_order ?? 999) - (b.frontmatter.nav_order ?? 999));

/**
 * Warn about front-matter mistakes that the nav would otherwise swallow
 * silently: pages are linked to their parent by exact title, so a typo in
 * `parent` or a duplicated title rearranges the sidebar with no error. Runs
 * once on load, so warnings show up in the browser console during
 * `bun run dev` and in the CI build log when the site is prerendered.
 */
function warnAboutContentMistakes(all: Page[]) {
  const byTitle = new Map<string, Page>();
  for (const page of all) {
    const title = page.frontmatter.title;
    if (!title) {
      console.warn(`[content] ${page.path}: missing "title" in front matter.`);
      continue;
    }
    const other = byTitle.get(title);
    if (other) {
      console.warn(
        `[content] ${page.path} and ${other.path} share the title "${title}". Titles must be unique: they are how "parent" fields and breadcrumbs identify pages.`,
      );
    } else {
      byTitle.set(title, page);
    }
  }
  for (const page of all) {
    const parent = page.frontmatter.parent;
    if (page.parentSlug !== undefined) {
      if (parent) {
        console.warn(
          `[content] ${page.path}: "${page.frontmatter.title}" is written inside this file, so it always sits under the page the file belongs to. Its "parent" field is ignored.`,
        );
      }
      continue;
    }
    if (!parent) continue;
    if (parent === page.frontmatter.title) {
      console.warn(
        `[content] ${page.path}: "parent" points at the page itself and is ignored.`,
      );
    } else if (!byTitle.has(parent)) {
      console.warn(
        `[content] ${page.path}: parent "${parent}" does not match any page title, so the page shows at the top level of the sidebar. Check it against the target page's "title".`,
      );
    }
  }

  // A page written inside a file is named by its title, so two different titles
  // can still land on the same URL. Only the first of them is reachable.
  const bySlug = new Map<string, Page>();
  for (const page of all) {
    const other = bySlug.get(page.slug);
    if (!other) {
      bySlug.set(page.slug, page);
    } else if (other.frontmatter.title !== page.frontmatter.title) {
      // Identical titles are already reported above; don't say it twice.
      console.warn(
        `[content] "${page.frontmatter.title}" (${page.path}) and "${other.frontmatter.title}" (${other.path}) both resolve to the URL "/${page.slug}", so only the first is reachable. A page written inside a file takes its URL from its title: reword one of them.`,
      );
    }
  }
}

warnAboutContentMistakes(pages);

export function findPage(slug: string): Page | undefined {
  return pages.find((p) => p.slug === slug);
}

/**
 * Strip the inline markdown that would otherwise leak into plain text taken
 * from a body: images, links, inline code, emphasis, and glossary markers.
 * Used for meta descriptions and for the derived site title.
 */
function stripInlineMarkdown(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links -> text
    .replace(/`([^`]*)`/g, "$1") // inline code
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    // Glossary markers: a "%" directly after a letter ends a `Term%` marker.
    // Percentages ("40%") follow digits, so they survive. `\%` escapes to "%".
    .replace(/(?<=\p{L})%/gu, "")
    .replace(/\\%/g, "%")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * First heading of a markdown body as plain text, or "" when there is none.
 * Headings inside fenced code blocks are skipped, so documenting markdown in a
 * code fence never wins. This is how the site gets its name: the `#` heading at
 * the top of `content/index.md` is the site title, so an author renames their
 * whole site by editing one heading they were writing anyway.
 */
export function firstHeading(body: string): string {
  let fence = "";
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    const marker = line.match(/^(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = "";
      continue;
    }
    if (fence) continue;
    const heading = line.match(/^#{1,6}[ \t]+(.+?)[ \t]*#*$/);
    if (heading) return stripInlineMarkdown(heading[1]);
  }
  return "";
}

/**
 * Produce a meta description for a page. Uses the front-matter `description`
 * when an author set one, otherwise auto-derives it from the first real
 * paragraph of the markdown body — so creators never have to write one.
 */
export function getPageDescription(page: Page, maxLen = 155): string {
  const fm = page.frontmatter.description?.trim();
  if (fm) return fm;

  const lines = page.body.split(/\r?\n/);
  const paragraph: string[] = [];
  let inFence = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (/^(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    // Skip headings, callout markers, blockquotes, list markers, images,
    // tables, html, and front-matter fences.
    if (
      line === "" ||
      line === "---" ||
      /^#{1,6}\s/.test(line) ||
      /^>\s*\[!/.test(line) ||
      /^[-*+]\s/.test(line) ||
      /^\d+\.\s/.test(line) ||
      /^\|/.test(line) ||
      /^!\[/.test(line) ||
      /^<\w/.test(line)
    ) {
      if (paragraph.length) break; // paragraph already collected
      continue;
    }
    if (line.startsWith(">")) {
      if (paragraph.length) break;
      continue;
    }
    paragraph.push(line);
  }

  const text = stripInlineMarkdown(paragraph.join(" "));

  if (!text) return "";
  if (text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(" ");
  return `${(lastSpace > 40 ? truncated.slice(0, lastSpace) : truncated).trimEnd()}…`;
}

/** Linear list of pages in sidebar order — used for prev/next navigation. */
export function flattenNavOrder(): Page[] {
  const tree = buildNavTree();
  const out: Page[] = [];
  const walk = (nodes: NavNode[]) => {
    for (const n of nodes) {
      out.push(n.page);
      walk(n.children);
    }
  };
  walk(tree);
  return out;
}

export interface PrevNext {
  prev?: Page;
  next?: Page;
}

export function getPrevNext(slug: string): PrevNext {
  const flat = flattenNavOrder();
  const idx = flat.findIndex((p) => p.slug === slug);
  if (idx === -1) return {};
  return {
    prev: idx > 0 ? flat[idx - 1] : undefined,
    next: idx < flat.length - 1 ? flat[idx + 1] : undefined,
  };
}

let titleIndex: Map<string, Page> | null = null;

/**
 * The page a page nests under, or undefined when it sits at the top level.
 *
 * There are two ways to be a subpage and this is the single place that knows
 * both: a page written inside another page's file always belongs to that page,
 * and any other page belongs to whichever page its `parent` title names. The
 * sidebar and the breadcrumbs both go through here, so a page can never appear
 * in one place under a parent it does not have in the other.
 */
export function getParentPage(page: Page): Page | undefined {
  // Note the explicit undefined check: the home page's slug is "".
  if (page.parentSlug !== undefined) return findPage(page.parentSlug);
  const parentTitle = page.frontmatter.parent;
  if (!parentTitle) return undefined;
  if (!titleIndex) titleIndex = new Map(pages.map((p) => [p.frontmatter.title, p]));
  return titleIndex.get(parentTitle);
}

/** Build "Home › Chapter › Page" trail from front-matter parent links. */
export function getBreadcrumbs(slug: string): Page[] {
  const page = findPage(slug);
  if (!page) return [];
  const trail: Page[] = [page];
  let current = page;
  for (;;) {
    const parent = getParentPage(current);
    if (!parent || trail.includes(parent)) break;
    trail.unshift(parent);
    current = parent;
  }
  // Always start from Home unless we're already on it.
  const home = findPage("");
  if (home && trail[0].slug !== "") trail.unshift(home);
  return trail;
}

export interface NavNode {
  page: Page;
  children: NavNode[];
}

export function buildNavTree(): NavNode[] {
  const nodes = new Map<Page, NavNode>();
  const roots: NavNode[] = [];

  for (const page of pages) {
    // The glossary is a reference appendix, not part of the reading flow: it
    // gets a pinned link in the sidebar footer instead of a nav entry, and is
    // skipped by prev/next navigation (which flattens this tree). Pages written
    // inside glossary.md are part of that appendix and stay out of the nav too.
    if (page.slug === "glossary" || page.parentSlug === "glossary") continue;
    nodes.set(page, { page, children: [] });
  }

  const parentNode = (node: NavNode): NavNode | undefined => {
    const parent = getParentPage(node.page);
    return parent ? nodes.get(parent) : undefined;
  };

  // True when hanging `node` under `start` would make the node its own ancestor
  // (a page whose `parent` names itself, or a longer loop) — that node becomes
  // a root instead, since a cycle would recurse forever when the tree is walked.
  const wouldCycle = (node: NavNode, start: NavNode): boolean => {
    const seen = new Set<NavNode>();
    let current: NavNode | undefined = start;
    while (current && !seen.has(current)) {
      if (current === node) return true;
      seen.add(current);
      current = parentNode(current);
    }
    return false;
  };

  for (const node of nodes.values()) {
    const parent = parentNode(node);
    if (parent && !wouldCycle(node, parent)) parent.children.push(node);
    else roots.push(node);
  }

  const sortChildren = (nodes: NavNode[]) => {
    nodes.sort(
      (a, b) => (a.page.frontmatter.nav_order ?? 999) - (b.page.frontmatter.nav_order ?? 999),
    );
    nodes.forEach((n) => sortChildren(n.children));
  };
  sortChildren(roots);

  return roots;
}
