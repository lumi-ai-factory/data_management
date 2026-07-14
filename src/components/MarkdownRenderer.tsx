import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import { fromHtmlIsomorphic } from "hast-util-from-html-isomorphic";

import rehypeRaw from "rehype-raw";

const linkIconSvg = fromHtmlIsomorphic(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
  { fragment: true },
).children;
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { visit } from "unist-util-visit";
import { Callout } from "./Callout";
import { CodeBlock } from "./CodeBlock";
import { Quiz } from "./Quiz";
import { parseQuiz } from "@/lib/quiz";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { applyGlossaryMarkers, lookupTerm, splitCodeGlossaryMarkers } from "@/lib/glossary";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

/** Hoist `data.meta` from <code> onto its parent <pre> so it survives the
 *  hast→React boundary and is reachable via JSX props. */
function rehypeHoistCodeMeta() {
  return (tree: unknown) => {
    visit(
      tree as never,
      "element",
      (node: {
        tagName?: string;
        properties?: Record<string, unknown>;
        children?: Array<{ tagName?: string; data?: { meta?: string } }>;
      }) => {
        if (
          node.tagName === "pre" &&
          node.children?.[0]?.tagName === "code" &&
          node.children[0].data?.meta
        ) {
          node.properties = node.properties ?? {};
          (node.properties as Record<string, unknown>).dataMeta = node.children[0].data.meta;
        }
      },
    );
  };
}

function rehypeCopyHeadingButtons() {
  return (tree: unknown) => {
    visit(
      tree as never,
      "element",
      (node: { tagName?: string; properties?: Record<string, unknown>; children?: unknown[] }) => {
        if (!/^h[1-4]$/.test(node.tagName ?? "")) return;
        const id = node.properties?.id;
        if (typeof id !== "string") return;
        node.children = node.children ?? [];
        node.children.push({
          type: "element",
          tagName: "button",
          properties: {
            type: "button",
            className: ["heading-anchor"],
            ariaLabel: "Copy link to this section",
            dataHref: `#${id}`,
          },
          children: linkIconSvg,
        });
      },
    );
  };
}

/** Inline glossary term with a hover/focus popover showing its definition.
 *  Falls back to plain text when the term isn't in the glossary. */
function GlossaryTerm({ term, children }: { term: string; children: React.ReactNode }) {
  const entry = lookupTerm(term);
  if (!entry) {
    if (import.meta.env.DEV && term) {
      console.warn(`[glossary] no definition found for "${term}"`);
    }
    return <>{children}</>;
  }
  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <span
          className="glossary-term"
          tabIndex={0}
          role="button"
          aria-label={`Glossary definition: ${entry.term}`}
        >
          {children}
        </span>
      </HoverCardTrigger>
      <HoverCardContent className="w-72 text-sm">
        <p className="font-semibold text-foreground">{entry.term}</p>
        <p className="mt-1 leading-snug text-muted-foreground">{entry.definition}</p>
      </HoverCardContent>
    </HoverCard>
  );
}

interface MarkdownRendererProps {
  source: string;
  /** When false, glossary auto-linking is skipped (e.g. the glossary page). */
  enableGlossary?: boolean;
}

function resolveAssetUrl(src: string | undefined): string | undefined {
  if (!src) return src;
  if (/^[a-z]+:\/\//i.test(src) || src.startsWith("//")) return src;
  if (src.startsWith("/")) return src;
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  const rel = src.replace(/^\.\//, "");
  return `${base}/${rel}`;
}

const CALLOUT_RE = /^\[!(note|warning|info|tip|command)\][ \t]*([^\n]*)/i;

type CalloutVariant = "note" | "warning" | "info" | "tip" | "command";

function extractCallout(
  children: React.ReactNode,
): { variant: CalloutVariant; title?: React.ReactNode; rest: React.ReactNode } | null {
  const arr = React.Children.toArray(children);
  const firstIdx = arr.findIndex((c) => !(typeof c === "string" && c.trim() === ""));
  if (firstIdx === -1) return null;
  const first = arr[firstIdx];

  if (!React.isValidElement(first)) return null;
  const firstProps = first.props as { children?: React.ReactNode };
  const inner = React.Children.toArray(firstProps.children);
  if (inner.length === 0) return null;
  const head = inner[0];
  if (typeof head !== "string") return null;

  const match = head.match(CALLOUT_RE);
  if (!match) return null;

  const variant = match[1].toLowerCase() as CalloutVariant;
  const matchedLen = match[0].length;

  // `match[2]` is the title text captured from the marker line (up to the first
  // newline). Inline elements (e.g. `code`) split the first paragraph into
  // multiple React children, and a soft line break between the title line and
  // the body shows up as a "\n" inside one of those text nodes. We walk the
  // first paragraph's children and split at the first newline: everything
  // before it is the title, everything after it is the start of the body.
  const afterMarker: React.ReactNode[] = [head.slice(matchedLen), ...inner.slice(1)];
  const titleRest: React.ReactNode[] = [];
  const bodyFromFirstParagraph: React.ReactNode[] = [];
  let didSplit = false;
  for (const node of afterMarker) {
    if (!didSplit && typeof node === "string") {
      const nl = node.indexOf("\n");
      if (nl !== -1) {
        const before = node.slice(0, nl);
        const after = node.slice(nl + 1);
        if (before) titleRest.push(before);
        if (after) bodyFromFirstParagraph.push(after);
        didSplit = true;
        continue;
      }
    }
    (didSplit ? bodyFromFirstParagraph : titleRest).push(node);
  }

  const titleParts: React.ReactNode[] = [];
  if (match[2]) titleParts.push(match[2]);
  for (const node of titleRest) {
    if (typeof node === "string" && node === "") continue;
    titleParts.push(node);
  }
  const title: React.ReactNode | undefined = titleParts.length > 0 ? titleParts : undefined;

  // Body = remainder of the first paragraph (after the title line) plus every
  // following block (additional paragraphs, lists, code, etc.).
  const rest: React.ReactNode[] = [...bodyFromFirstParagraph, ...arr.slice(firstIdx + 1)];

  return { variant, title, rest };
}

/** Parse a code-fence info string like:
 *    title="train.py" {1,3-5} showLineNumbers
 *  into { title, highlightLines, showLineNumbers }. */
function parseCodeMeta(meta?: string): {
  title?: string;
  highlightLines?: Set<number>;
  showLineNumbers?: boolean;
} {
  if (!meta) return {};
  const out: ReturnType<typeof parseCodeMeta> = {};
  const titleMatch = meta.match(/title=(?:"([^"]+)"|'([^']+)'|(\S+))/);
  if (titleMatch) out.title = titleMatch[1] ?? titleMatch[2] ?? titleMatch[3];
  if (/(?:^|\s)showLineNumbers(?:\s|$)/.test(meta)) out.showLineNumbers = true;
  const range = meta.match(/\{([\d,\s-]+)\}/);
  if (range) {
    const set = new Set<number>();
    for (const part of range[1].split(",")) {
      const m = part.trim().match(/^(\d+)(?:-(\d+))?$/);
      if (!m) continue;
      const start = parseInt(m[1], 10);
      const end = m[2] ? parseInt(m[2], 10) : start;
      for (let i = start; i <= end; i++) set.add(i);
    }
    if (set.size) out.highlightLines = set;
  }
  return out;
}

/** Recursively extract plain text from React children (used for quiz fences,
 *  whose raw text may be wrapped in highlight spans). */
function nodeToText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeToText).join("");
  if (React.isValidElement(node)) {
    return nodeToText((node.props as { children?: React.ReactNode }).children);
  }
  return "";
}

/**
 * Wraps the ends of inline code blocks to prevent tiny orphans (like a lonely `/`)
 * when the block wraps across lines.
 */
function formatInlineCode(node: React.ReactNode): React.ReactNode {
  const text = nodeToText(node);
  const MIN_CHUNK = 6;

  if (text.length <= MIN_CHUNK * 2) {
    return <span className="whitespace-nowrap">{node}</span>;
  }

  // Mixed content (e.g. glossary triggers) can't be re-sliced from plain
  // text without dropping the elements — let it wrap naturally instead.
  const parts = React.Children.toArray(node);
  if (parts.some((p) => typeof p !== "string" && typeof p !== "number")) {
    return node;
  }

  const start = text.slice(0, MIN_CHUNK);
  const middle = text.slice(MIN_CHUNK, -MIN_CHUNK);
  const end = text.slice(-MIN_CHUNK);

  return (
    <>
      <span className="whitespace-nowrap">{start}</span>
      {middle}
      <span className="whitespace-nowrap">{end}</span>
    </>
  );
}

export function MarkdownRenderer({ source, enableGlossary = true }: MarkdownRendererProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const processedSource = React.useMemo(
    () => (enableGlossary ? applyGlossaryMarkers(source) : source),
    [source, enableGlossary],
  );
  const [lightbox, setLightbox] = React.useState<{
    src: string;
    alt: string;
  } | null>(null);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("button.heading-anchor");
      if (!target) return;
      e.preventDefault();
      const href = (target as HTMLButtonElement).dataset.href;
      if (!href || !href.startsWith("#")) return;
      const url = window.location.origin + window.location.pathname + href;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).catch(() => {});
        toast.success("Link copied to clipboard");
      }
    };
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, []);

  return (
    <div className="prose-lumi" ref={containerRef}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          rehypeHoistCodeMeta,
          rehypeRaw,
          rehypeSlug,
          rehypeCopyHeadingButtons,
          rehypeHighlight,
          rehypeKatex,
        ]}
        components={{
          span(props) {
            const p = props as Record<string, unknown>;
            const node = p.node as { properties?: Record<string, unknown> } | undefined;
            const className = node?.properties?.className;
            const isGlossary = Array.isArray(className)
              ? className.includes("glossary-term")
              : className === "glossary-term";
            if (isGlossary) {
              const props2 = node?.properties ?? {};
              const term = props2["dataTerm"] ?? props2["data-term"];
              return (
                <GlossaryTerm term={typeof term === "string" ? term : ""}>
                  {props.children}
                </GlossaryTerm>
              );
            }
            const { node: _node, ...rest } = props as Record<string, unknown>;
            return <span {...(rest as React.HTMLProps<HTMLSpanElement>)} />;
          },
          blockquote({ children }) {
            const callout = extractCallout(children);
            if (callout) {
              return (
                <Callout variant={callout.variant} title={callout.title}>
                  {callout.rest}
                </Callout>
              );
            }
            return (
              <blockquote className="my-5 border-l-4 border-border pl-4 italic text-foreground/80">
                {children}
              </blockquote>
            );
          },
          pre(props) {
            const { children } = props;
            const p = props as Record<string, unknown>;
            const node = p.node as
              | {
                  children?: Array<{
                    tagName?: string;
                    data?: { meta?: string };
                  }>;
                }
              | undefined;
            const dataMeta =
              (p.dataMeta as string | undefined) ??
              (p["data-meta"] as string | undefined) ??
              node?.children?.find((child) => child.tagName === "code")?.data?.meta;
            const child = React.Children.only(children) as React.ReactElement<{
              className?: string;
              children?: React.ReactNode;
            }>;

            const childClassName = child.props.className ?? "";
            if (/\blanguage-quiz\b/.test(childClassName)) {
              const quiz = parseQuiz(nodeToText(child.props.children));
              return <Quiz title={quiz.title} questions={quiz.questions} />;
            }

            const parsed = parseCodeMeta(dataMeta);
            return (
              <CodeBlock
                className={child.props.className}
                title={parsed.title}
                showLineNumbers={parsed.showLineNumbers}
                highlightLines={parsed.highlightLines}
              >
                {child.props.children}
              </CodeBlock>
            );
          },
          code({ className, children }) {
            if (!className) {
              // Resolve `Term%` glossary markers that sit inside the code
              // content — the preprocessor leaves those untouched because raw
              // HTML between backticks would render as literal text.
              let content: React.ReactNode = children;
              const isPlainText =
                typeof children === "string" ||
                (Array.isArray(children) && children.every((c) => typeof c === "string"));
              if (enableGlossary && isPlainText && nodeToText(children).includes("%")) {
                content = splitCodeGlossaryMarkers(nodeToText(children)).map((seg, i) =>
                  seg.term ? (
                    <GlossaryTerm key={i} term={seg.term}>
                      {seg.text}
                    </GlossaryTerm>
                  ) : (
                    <React.Fragment key={i}>{seg.text}</React.Fragment>
                  ),
                );
              }
              return (
                <code className="rounded bg-inline-code-bg px-1.5 py-0.5 font-mono text-[0.9em] text-inline-code-fg break-words">
                  {formatInlineCode(content)}
                </code>
              );
            }
            return <code className={className}>{children}</code>;
          },
          a({ href, children }) {
            const className =
              "text-link underline-offset-2 hover:text-lumi-magenta hover:underline";
            // External, protocol-relative, mailto/tel, and pure-hash links stay
            // as plain anchors.
            const isExternal =
              !href || /^[a-z]+:/i.test(href) || href.startsWith("//") || href.startsWith("#");
            if (isExternal) {
              const isHttp = href?.startsWith("http");
              return (
                <a
                  href={href}
                  target={isHttp ? "_blank" : undefined}
                  rel={isHttp ? "noreferrer noopener" : undefined}
                  className={className}
                >
                  {children}
                </a>
              );
            }
            // Internal links go through the router so the GitHub Pages base
            // path (e.g. "/<repo>/") is applied automatically.
            const [path, hash] = href.split("#");
            const to = path.startsWith("/") ? path : `/${path}`;
            return (
              <Link to={to as string} hash={hash || undefined} className={className}>
                {children}
              </Link>
            );
          },
          img(props) {
            const { src, alt, style, width, height, className } =
              props as React.ImgHTMLAttributes<HTMLImageElement>;
            const resolved = resolveAssetUrl(src) ?? "";
            const altText = alt ?? "";
            return (
              <button
                type="button"
                onClick={() => setLightbox({ src: resolved, alt: altText })}
                className="cursor-zoom-in border-0 bg-transparent p-0 w-full mx-auto block"
                aria-label={altText ? `Open image: ${altText}` : "Open image"}
              >
                <img
                  src={resolved}
                  alt={altText}
                  style={style}
                  width={width}
                  height={height}
                  className={className}
                />
              </button>
            );
          },
          iframe(props) {
            const src = resolveAssetUrl(props.src);
            return (
              <div className="my-6 aspect-video w-full overflow-hidden rounded-lg border border-border">
                <iframe {...props} src={src} className="h-full w-full" allowFullScreen />
              </div>
            );
          },
        }}
      >
        {processedSource}
      </ReactMarkdown>

      <Dialog open={lightbox !== null} onOpenChange={(open) => !open && setLightbox(null)}>
        <DialogContent className="max-w-[95vw] border-0 bg-transparent p-0 shadow-none sm:max-w-[90vw]">
          <VisuallyHidden>
            <DialogTitle>{lightbox?.alt || "Image preview"}</DialogTitle>
          </VisuallyHidden>
          {lightbox && (
            <div
              className="flex min-h-[85vh] w-full items-center justify-center"
              onClick={() => setLightbox(null)}
            >
              <figure className="flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
                <img
                  src={lightbox.src}
                  alt={lightbox.alt}
                  onClick={() => setLightbox(null)}
                  className="max-h-[85vh] w-auto cursor-zoom-out rounded-lg object-contain"
                />
                {lightbox.alt && (
                  <figcaption className="mt-3 text-center text-sm text-white/90">
                    {lightbox.alt}
                  </figcaption>
                )}
              </figure>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
