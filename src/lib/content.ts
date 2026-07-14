import { load as parseYaml } from "js-yaml";

/**
 * Split a markdown string into its YAML frontmatter and body.
 *
 * Replaces `gray-matter`, which pulled Node's `Buffer`/`fs` into the browser
 * bundle. Our content only uses a leading `---` fenced YAML block, so a small
 * pure-JS parser handles it without any Node polyfills.
 */
function parseFrontmatter(raw: string): { data: Record<string, unknown>; content: string } {
  // Strip a leading BOM, then match an opening `---` fence at the very start.
  const text = raw.replace(/^\uFEFF/, "");
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!match) return { data: {}, content: text };
  const parsed = parseYaml(match[1]);
  const data = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  return { data, content: text.slice(match[0].length) };
}

export interface PageFrontmatter {
  title: string;
  nav_order?: number;
  parent?: string;
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
}

const rawModules = import.meta.glob("/content/**/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function fileToSlug(filePath: string): string {
  // "/content/index.md" -> ""
  // "/content/chapter1.md" -> "chapter1"
  // "/content/sub/page.md" -> "sub/page"
  const rel = filePath.replace(/^\/content\//, "").replace(/\.md$/, "");
  return rel === "index" ? "" : rel;
}

export const pages: Page[] = Object.entries(rawModules)
  .map(([filePath, raw]) => {
    const parsed = parseFrontmatter(raw);
    return {
      slug: fileToSlug(filePath),
      path: filePath.replace(/^\//, ""),
      frontmatter: parsed.data as unknown as PageFrontmatter,
      body: parsed.content,
    };
  })
  .sort((a, b) => (a.frontmatter.nav_order ?? 999) - (b.frontmatter.nav_order ?? 999));

export function findPage(slug: string): Page | undefined {
  return pages.find((p) => p.slug === slug);
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

  let text = paragraph.join(" ");
  // Strip the most common inline markdown so the description reads cleanly.
  text = text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links -> text
    .replace(/`([^`]*)`/g, "$1") // inline code
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/%/g, "") // glossary markers
    .replace(/\s+/g, " ")
    .trim();

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

/** Build "Home › Chapter › Page" trail from front-matter parent links. */
export function getBreadcrumbs(slug: string): Page[] {
  const page = findPage(slug);
  if (!page) return [];
  const trail: Page[] = [page];
  let current = page;
  const byTitle = new Map(pages.map((p) => [p.frontmatter.title, p]));
  while (current.frontmatter.parent) {
    const parent = byTitle.get(current.frontmatter.parent);
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
  const byTitle = new Map<string, NavNode>();
  const roots: NavNode[] = [];

  for (const page of pages) {
    // The glossary is a reference appendix, not part of the reading flow: it
    // gets a pinned link in the sidebar footer instead of a nav entry, and is
    // skipped by prev/next navigation (which flattens this tree).
    if (page.slug === "glossary") continue;
    const node: NavNode = { page, children: [] };
    byTitle.set(page.frontmatter.title, node);
  }

  for (const node of byTitle.values()) {
    const parentTitle = node.page.frontmatter.parent;
    if (parentTitle && byTitle.has(parentTitle)) {
      byTitle.get(parentTitle)!.children.push(node);
    } else {
      roots.push(node);
    }
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
