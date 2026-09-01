import { load as parseYaml } from "js-yaml";

/**
 * Reading a Jupyter notebook as a page.
 *
 * A `.ipynb` file dropped into `content/` becomes a page exactly like a `.md`
 * file does. Nothing is ever written to disk: the notebook is turned into
 * markdown while the content is loaded, so the `.ipynb` stays the one source of
 * truth. Delete it and the page is gone; edit it in Jupyter and the page
 * follows. Everything downstream (front-matter blocks, headings, the table of
 * contents, glossary terms, code blocks) then works on that markdown without
 * knowing where it came from.
 *
 * Markdown cells are copied through untouched. Code cells become fenced blocks
 * tagged with the notebook's language, so they render as ordinary code with a
 * copy button. Cell outputs are dropped: a page shows the code a reader is
 * meant to run, not the results of whichever run happened to be saved.
 *
 * Imported both by `content.ts` (in the browser bundle) and by `vite.config.ts`
 * (in Node, which needs the same page slugs to prerender pages and to list them
 * in the sitemap), so like `page-blocks.ts` this module must stay free of
 * `import.meta` and of anything browser-only.
 */
interface NotebookCell {
  cell_type?: string;
  source?: string | string[];
  /** Images pasted into a markdown cell, stored in the notebook as base64. */
  attachments?: Record<string, Record<string, string>>;
}

interface Notebook {
  cells?: NotebookCell[];
  metadata?: {
    language_info?: { name?: string };
    kernelspec?: { language?: string; name?: string };
  };
}

/**
 * Front-matter keys the template understands. Used to recognise a raw cell that
 * was meant as front matter, and to tell it apart from a raw cell holding LaTeX
 * or anything else, which is left alone.
 */
const FRONT_MATTER_KEY = /^[ \t]*(title|nav_order|parent|description|has_children)[ \t]*:/m;

/** Almost every notebook is Python; used only when the file declares nothing. */
const DEFAULT_LANGUAGE = "python";

export function isNotebookPath(filePath: string): boolean {
  return /\.ipynb$/i.test(filePath);
}

function cellText(cell: NotebookCell): string {
  const source = cell.source;
  if (Array.isArray(source)) return source.join("");
  return typeof source === "string" ? source : "";
}

/** A fence long enough to hold `code`, so a cell containing back-ticks (a
 *  docstring with a markdown sample, say) cannot end its own block early. */
function fenceFor(code: string): string {
  let longest = 0;
  for (const run of code.matchAll(/`+/g)) longest = Math.max(longest, run[0].length);
  return "`".repeat(Math.max(3, longest + 1));
}

/** Inline markdown removed from a heading before it is used as a title. */
function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * First heading of a markdown body, skipping fenced code so that a `#` inside
 * an example never wins. Kept here rather than imported from `content.ts`,
 * which reads `import.meta` and so cannot be loaded by `vite.config.ts`.
 */
function firstHeading(body: string): string {
  let fence = "";
  for (const line of body.split("\n")) {
    const marker = line.match(/^[ \t]*(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = "";
      continue;
    }
    if (fence) continue;
    const heading = /^[ \t]*#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/.exec(line);
    if (heading) return stripInlineMarkdown(heading[1]);
  }
  return "";
}

/**
 * Title and sidebar position taken from the file name, used when the notebook
 * gives nothing better. `01_LLMs.ipynb` is "LLMs" at position 1: a leading
 * number is how people already order notebooks in a folder, so it orders the
 * sidebar too instead of showing up in the title. Underscores and hyphens
 * become spaces. Only the first letter is capitalised, so "LLMs" survives.
 */
function fromFileName(name: string): { title: string; navOrder?: number } {
  const numbered = /^(\d+)[-_. ]+(.*)$/.exec(name);
  const navOrder = numbered ? Number(numbered[1]) : undefined;
  const words = (numbered ? numbered[2] : name).replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  const title = words ? words.charAt(0).toUpperCase() + words.slice(1) : name;
  return { title, navOrder };
}

/**
 * Front matter written in a raw cell, or null when the cell is something else.
 *
 * A notebook has nowhere to put `parent`, so a page made from one would always
 * sit at the top level of the sidebar. A raw cell fills that gap and is
 * reachable without leaving Jupyter: change a cell's type to Raw and type the
 * keys into it. The surrounding `---` lines are optional, and a raw cell that
 * is not front matter stays page content.
 */
function rawCellFrontMatter(
  text: string,
  warn?: (message: string) => void,
): Record<string, unknown> | null {
  const inner = text.trim().replace(/^---\r?\n([\s\S]*?)\r?\n?---$/, "$1");
  if (!FRONT_MATTER_KEY.test(inner)) return null;
  let parsed: unknown;
  try {
    parsed = parseYaml(inner);
  } catch {
    warn?.(
      `a raw cell looks like front matter but could not be read. Put quotes around any value containing a colon, e.g. title: "Chapter 2: Slurm".`,
    );
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  return parsed as Record<string, unknown>;
}

/**
 * Replace `attachment:name` with the image itself. Pasting a picture into a
 * Jupyter markdown cell stores it inside the `.ipynb` as base64 rather than as
 * a file, so it travels with the notebook and there is nothing for the author
 * to copy anywhere.
 */
function inlineAttachments(text: string, attachments: NotebookCell["attachments"]): string {
  if (!attachments || !text.includes("attachment:")) return text;
  return text.replace(/attachment:([^\s")\]>]+)/g, (whole, ref: string) => {
    let name = ref;
    try {
      name = decodeURIComponent(ref);
    } catch {
      // A stray "%" in the name: fall back to matching it as written.
    }
    const bundle = attachments[name] ?? attachments[ref];
    const [mime, data] = Object.entries(bundle ?? {})[0] ?? [];
    if (!mime || typeof data !== "string") return whole;
    return `data:${mime};base64,${data.replace(/\s+/g, "")}`;
  });
}

const MARKDOWN_IMAGE = /(!\[[^\]]*\]\([ \t]*<?)([^)<>\s]+)/g;
const HTML_IMAGE_SRC = /(<img\b[^>]*?\bsrc[ \t]*=[ \t]*")([^"]+)/gi;
const INLINE_CODE = /`+[^`]*`+/g;

/** Paths that already point somewhere definite and must not be rewritten. */
function isFixedUrl(url: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("/") || url.startsWith("#");
}

/**
 * Point a notebook's picture files at `public/assets/`, where every other
 * picture on the site lives.
 *
 * Jupyter writes `./images/plot.png`, meaning a file in a folder beside the
 * notebook. The author moves those files into `public/assets/` once, and this
 * rewrites the paths to match, so the notebook itself is never edited. Only the
 * file name is kept, so it makes no difference which folder Jupyter had them
 * in. A picture pasted into a cell has already become a `data:` URL by this
 * point and is left alone, as is anything with an address of its own.
 *
 * Code is left exactly as written, fenced and inline alike, so a cell that
 * documents the syntax rather than using it keeps the path it typed.
 */
function relocateImages(text: string, onImage?: (fileName: string) => void): string {
  const move = (url: string): string => {
    if (isFixedUrl(url)) return url;
    const fileName = url.split(/[?#]/, 1)[0].split("/").pop() ?? "";
    if (!fileName) return url;
    onImage?.(fileName);
    return `./assets/${fileName}`;
  };
  const rewrite = (prose: string): string =>
    prose
      .replace(MARKDOWN_IMAGE, (_all, before: string, url: string) => before + move(url))
      .replace(HTML_IMAGE_SRC, (_all, before: string, url: string) => before + move(url));

  let fence = "";
  return text
    .split("\n")
    .map((line) => {
      const marker = line.match(/^[ \t]*(`{3,}|~{3,})/);
      if (marker) {
        if (!fence) fence = marker[1];
        else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = "";
        return line;
      }
      if (fence) return line;
      // Rewrite the prose between inline-code spans, never the spans themselves.
      let out = "";
      let last = 0;
      for (const span of line.matchAll(INLINE_CODE)) {
        out += rewrite(line.slice(last, span.index)) + span[0];
        last = span.index + span[0].length;
      }
      return out + rewrite(line.slice(last));
    })
    .join("\n");
}

/** `nav_order` as a number, whether or not the author quoted it in the YAML. */
function asNavOrder(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function quote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function toFrontMatter(fields: Record<string, unknown>): string {
  const lines = ["---"];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === "") continue;
    const scalar =
      typeof value === "number" || typeof value === "boolean" ? String(value) : quote(String(value));
    lines.push(`${key}: ${scalar}`);
  }
  lines.push("---");
  return lines.join("\n");
}

/** Shown in place of a notebook that could not be parsed, so the mistake is
 *  visible on the site as well as in the build log. */
function unreadablePage(relPath: string): string {
  const { title } = fromFileName(relPath.slice(relPath.lastIndexOf("/") + 1).replace(/\.ipynb$/i, ""));
  return [
    toFrontMatter({ title }),
    "",
    `# ${title}`,
    "",
    "> [!warning] This notebook could not be read",
    `> \`content/${relPath}\` is not a readable Jupyter notebook, so its content cannot be shown here. Open it in Jupyter, save it, and commit the saved file.`,
    "",
  ].join("\n");
}

export interface NotebookOptions {
  /** Called with the file name of every image the notebook expects to find in
   *  `public/assets/`, so the build can check it is actually there. */
  onImage?: (fileName: string) => void;
}

/**
 * One notebook as the markdown of one page, front matter included.
 *
 * `relPath` is the path below `content/`, e.g. `01_intro.ipynb`. It names the
 * page in warnings and, when the notebook has no heading of its own, supplies
 * the title.
 */
export function notebookToMarkdown(
  raw: string,
  relPath: string,
  warn?: (message: string) => void,
  options?: NotebookOptions,
): string {
  let notebook: Notebook | undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as Notebook).cells)) {
      notebook = parsed as Notebook;
    }
  } catch {
    // Reported below, together with a notebook that parsed but has no cells.
  }
  if (!notebook) {
    warn?.(
      "could not be read as a Jupyter notebook, so the page shows a warning instead. Check that the file is a notebook saved by Jupyter and not, say, an exported HTML file renamed to .ipynb.",
    );
    return unreadablePage(relPath);
  }

  const language =
    notebook.metadata?.language_info?.name ||
    notebook.metadata?.kernelspec?.language ||
    DEFAULT_LANGUAGE;

  let front: Record<string, unknown> = {};
  const parts: string[] = [];

  for (const cell of notebook.cells ?? []) {
    const text = cellText(cell);
    if (cell.cell_type === "markdown") {
      let markdownText = text;
      // Front matter is read only at the top of the notebook, before any
      // content. Further down, a cell opening with `---` is left in the body so
      // that `page-blocks.ts` can start a subchapter from it, exactly as it
      // does in a `.md` file. Reading it anywhere would silently retitle the
      // page instead of adding one.
      const fmMatch =
        parts.length === 0
          ? markdownText.match(/^[ \t]*---[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*---[ \t]*(?:\r?\n|$)/)
          : null;
      if (fmMatch) {
        const inner = fmMatch[1];
        if (FRONT_MATTER_KEY.test(inner)) {
          try {
            const parsed = parseYaml(inner);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              front = { ...front, ...(parsed as Record<string, unknown>) };
              markdownText = markdownText.slice(fmMatch[0].length);
            }
          } catch {
            warn?.(
              `a markdown cell starts with what looks like front matter but it could not be read. Put quotes around any value containing a colon, e.g. title: "Chapter 2: Slurm".`
            );
          }
        }
      }
      if (!markdownText.trim()) continue;
      parts.push(relocateImages(inlineAttachments(markdownText, cell.attachments), options?.onImage).trim());
      continue;
    }
    if (cell.cell_type === "code") {
      if (!text.trim()) continue;
      const fence = fenceFor(text);
      parts.push(`${fence}${language}\n${text.replace(/\s+$/, "")}\n${fence}`);
      continue;
    }
    if (cell.cell_type === "raw") {
      const fields = rawCellFrontMatter(text, warn);
      if (fields) {
        front = { ...front, ...fields };
      } else if (text.trim()) {
        parts.push(text.trim());
      }
    }
  }

  const body = parts.join("\n\n");
  const name = relPath.slice(relPath.lastIndexOf("/") + 1).replace(/\.ipynb$/i, "");
  const derived = fromFileName(name);
  const given = typeof front.title === "string" ? front.title.trim() : "";
  const { title: _ignored, nav_order: givenOrder, ...rest } = front;

  return [
    toFrontMatter({
      title: given || firstHeading(body) || derived.title,
      nav_order: asNavOrder(givenOrder) ?? derived.navOrder,
      ...rest,
    }),
    "",
    body,
    "",
  ].join("\n");
}
