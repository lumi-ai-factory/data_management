import { load as parseYaml } from "js-yaml";
import { slug as slugify } from "github-slugger";

/**
 * Splitting a `.md` file into the pages it contains.
 *
 * A file normally holds one page. It holds several when the author, instead of
 * creating one file per subchapter, appends further front-matter blocks to the
 * end of the file:
 *
 *     ---
 *     title: "Chapter 1"
 *     ---
 *
 *     The chapter's own page.
 *
 *     ---
 *     title: "First Subchapter"
 *     ---
 *
 *     A page of its own, nested under Chapter 1.
 *
 * Every block after the first becomes an ordinary page: its own URL, its own
 * sidebar entry, its own place in the Previous/Next flow. Nothing about the
 * reader's experience differs from one file per subchapter, and a file with no
 * extra blocks behaves exactly as it always has.
 *
 * This module is imported both by `content.ts` (in the browser bundle) and by
 * `vite.config.ts` (in Node, which needs the same slugs to prerender pages and
 * to list them in the sitemap), so it must stay free of `import.meta` and of
 * anything browser-only.
 */
export interface PageBlock {
  data: Record<string, unknown>;
  content: string;
}

/**
 * Front-matter keys the template understands. Used only to tell a mistyped page
 * block apart from an ordinary horizontal rule, so that the first gets a
 * warning and the second is left alone.
 */
const KEY_LINE = /^[ \t]*(title|nav_order|parent|description|has_children)[ \t]*:/m;

const FENCE = /^[ \t]*(`{3,}|~{3,})/;

/** How far past a `---` to look for the closing `---`. Front matter is a few
 *  short lines; anything longer is prose between two horizontal rules. */
const MAX_BLOCK_LINES = 60;

function asMapping(parsed: unknown): Record<string, unknown> | null {
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : null;
}

/**
 * Split a markdown file into its pages: the file's own page first, then one
 * per front-matter block written further down.
 *
 * `warn` is called with a message for a block that was clearly meant to start a
 * page but could not (bad YAML, no title). Those are left as page content, so
 * the mistake is visible on the page as well as in the build log.
 */
export function splitPageBlocks(raw: string, warn?: (message: string) => void): PageBlock[] {
  // Strip a leading BOM, then match the opening `---` fence at the very start.
  const text = raw.replace(/^\uFEFF/, "");
  const opening = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  const ownData = opening ? (asMapping(parseYaml(opening[1])) ?? {}) : {};
  const body = opening ? text.slice(opening[0].length) : text;
  // Line numbers in warnings count from the top of the file, not from here.
  const lineOffset = opening ? opening[0].split("\n").length - 1 : 0;

  const lines = body.split("\n");
  const cuts: { at: number; contentFrom: number; data: Record<string, unknown> }[] = [];
  let fence = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, "");

    const marker = line.match(FENCE);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = "";
      continue;
    }
    if (fence) continue;
    if (line.trimEnd() !== "---") continue;
    // `Some text` followed by `---` is a setext heading, not a rule and not the
    // start of a block.
    if (i > 0 && lines[i - 1].trim() !== "") continue;

    let close = -1;
    const limit = Math.min(lines.length, i + 1 + MAX_BLOCK_LINES);
    for (let j = i + 1; j < limit; j++) {
      const ahead = lines[j].replace(/\r$/, "");
      if (FENCE.test(ahead)) break; // a code block: this was a horizontal rule
      if (ahead.trimEnd() === "---") {
        close = j;
        break;
      }
    }
    if (close <= i + 1) continue; // unclosed, or an empty `---` `---` pair

    const yaml = lines.slice(i + 1, close).join("\n");
    const looksIntended = KEY_LINE.test(yaml);
    const at = lineOffset + i + 1;
    let data: Record<string, unknown> | null = null;
    try {
      data = asMapping(parseYaml(yaml));
    } catch {
      if (looksIntended) {
        warn?.(
          `the block starting on line ${at} looks like the start of a page, but its front matter could not be read. Put quotes around any value containing a colon, e.g. title: "Chapter 2: Slurm".`,
        );
      }
      continue;
    }

    const title = data?.title;
    if (!data || typeof title !== "string" || !title.trim()) {
      if (looksIntended) {
        warn?.(
          `the block starting on line ${at} has front matter but no "title", so it does not start a page and is shown as page content instead.`,
        );
      }
      continue;
    }

    cuts.push({ at: i, contentFrom: close + 1, data });
    i = close;
  }

  const blocks: PageBlock[] = [
    { data: ownData, content: lines.slice(0, cuts[0]?.at ?? lines.length).join("\n") },
  ];
  for (let k = 0; k < cuts.length; k++) {
    const end = cuts[k + 1]?.at ?? lines.length;
    blocks.push({ data: cuts[k].data, content: lines.slice(cuts[k].contentFrom, end).join("\n") });
  }
  return blocks;
}

/**
 * URL slug for a page written inside another page's file. A page in a file of
 * its own is named by that file; this one has no filename, so it is named by
 * its title, exactly as a heading anchor is. `index` is only used to keep a
 * title made entirely of punctuation from producing an empty URL.
 */
export function blockSlug(data: Record<string, unknown>, fileSlug: string, index: number): string {
  const fromTitle = typeof data.title === "string" ? slugify(data.title) : "";
  return fromTitle || `${fileSlug || "page"}-${index}`;
}

/** Every slug a single `.md` file contributes, in document order. */
export function pageSlugs(raw: string, fileSlug: string): string[] {
  return splitPageBlocks(raw).map((block, i) =>
    i === 0 ? fileSlug : blockSlug(block.data, fileSlug, i),
  );
}
