import GithubSlugger from "github-slugger";

export interface TocItem {
  depth: 2 | 3;
  text: string;
  id: string;
}

/** Extract H2 / H3 headings from a markdown body, skipping fenced code blocks.
 *  Slugs match rehype-slug (which uses github-slugger). */
export function extractToc(body: string): TocItem[] {
  const slugger = new GithubSlugger();
  const lines = body.split("\n");
  const out: TocItem[] = [];
  let inFence = false;
  let fenceMarker = "";

  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");
    const fence = line.match(/^(`{3,}|~{3,})/);
    if (fence) {
      if (!inFence) {
        inFence = true;
        fenceMarker = fence[1][0];
      } else if (line.startsWith(fenceMarker)) {
        inFence = false;
      }
      continue;
    }
    if (inFence) continue;

    const m = line.match(/^(#{2,3})\s+(.+?)\s*#*\s*$/);
    if (!m) continue;
    const depth = m[1].length as 2 | 3;
    // Strip simple inline markdown and glossary markers so the TOC text reads cleanly.
    const text = m[2]
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/(?<![\s\d\\])%/g, "") // Remove glossary % markers
      .replace(/\\%/g, "%"); // Unescape literal \%
    out.push({ depth, text, id: slugger.slug(text) });
  }

  return out;
}
