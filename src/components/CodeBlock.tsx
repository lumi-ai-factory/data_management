import * as React from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  className?: string;
  children: React.ReactNode;
  title?: string;
  showLineNumbers?: boolean;
  highlightLines?: Set<number>;
}

const TERMINAL_LANGS = new Set(["bash", "shell", "zsh", "console"]);

/** `.sh` scripts are shown as a file being edited (nano), not a live shell,
 *  so they get an editor chrome with no `user@machine` prompt. */
const NANO_LANGS = new Set(["sh"]);

/** Recursively split a (possibly nested) React tree into per-line arrays.
 *  Newlines may be buried inside spans emitted by rehype-highlight, so we
 *  walk children and clone wrapping elements once per line. */
function splitIntoLines(node: React.ReactNode): React.ReactNode[][] {
  if (node == null || node === false || node === true) return [[]];
  if (Array.isArray(node)) {
    const out: React.ReactNode[][] = [[]];
    for (const child of node) {
      const sub = splitIntoLines(child);
      if (sub.length === 0) continue;
      out[out.length - 1].push(...sub[0]);
      for (let i = 1; i < sub.length; i++) out.push([...sub[i]]);
    }
    return out;
  }
  if (typeof node === "string" || typeof node === "number") {
    const parts = String(node).split("\n");
    return parts.map((p) => (p.length ? [p] : []));
  }
  if (React.isValidElement(node)) {
    const props = (node as React.ReactElement<{ children?: React.ReactNode }>).props;
    const inner = splitIntoLines(props.children);
    return inner.map((lineChildren, i) => {
      if (lineChildren.length === 0) return [];
      return [
        React.cloneElement(
          node as React.ReactElement<{ children?: React.ReactNode }>,
          { key: `s${i}` },
          ...lineChildren,
        ),
      ];
    });
  }
  return [[]];
}

function wrapLines(children: React.ReactNode, highlight?: Set<number>): React.ReactNode {
  const lines = splitIntoLines(children);
  while (lines.length > 1 && lines[lines.length - 1].length === 0) lines.pop();
  return lines.map((parts, i) => (
    <span key={i} className={cn("code-line", highlight?.has(i + 1) && "code-line-hl")}>
      {parts.length > 0 ? parts : "\u200B"}
    </span>
  ));
}

function wrapTerminalLines(children: React.ReactNode): React.ReactNode {
  const lines = splitIntoLines(children);
  while (lines.length > 1 && lines[lines.length - 1].length === 0) lines.pop();
  return lines.map((parts, i) => (
    <span key={i} className="terminal-line code-line">
      <span className="terminal-prompt" aria-hidden="true">
        user@lumi:~$&nbsp;
      </span>
      <span className="terminal-command">{parts.length > 0 ? parts : "\u200B"}</span>
    </span>
  ));
}

export function CodeBlock({
  className,
  children,
  title,
  showLineNumbers,
  highlightLines,
}: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false);
  const ref = React.useRef<HTMLPreElement>(null);

  const lang = className?.match(/language-(\w+)/)?.[1];
  const isTerminal = lang ? TERMINAL_LANGS.has(lang.toLowerCase()) : false;
  const isNano = lang ? NANO_LANGS.has(lang.toLowerCase()) : false;

  const onCopy = async () => {
    let text = "";
    if (isTerminal && ref.current) {
      const cmds = ref.current.querySelectorAll(".terminal-command");
      text = Array.from(cmds)
        .map((el) => (el as HTMLElement).innerText)
        .join("\n");
    } else {
      text = ref.current?.innerText ?? "";
    }

    // Strip out the zero-width spaces we injected for empty line rendering
    text = text.replace(/\u200B/g, "");

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const wrapped = isTerminal ? wrapTerminalLines(children) : wrapLines(children, highlightLines);

  if (isNano) {
    return (
      <div className="nano-block group relative my-5 overflow-hidden rounded-md border border-nano-border shadow-md">
        <div className="nano-titlebar flex items-center justify-between px-3 py-1.5">
          <span className="font-sans text-xs font-semibold truncate">
            GNU nano — {title ?? "New Buffer"}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onCopy}
              className="mr-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-white/80 opacity-0 transition-opacity hover:bg-white/10 group-hover:opacity-100 focus:opacity-100"
              aria-label="Copy code"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <span className="nano-btn" aria-hidden>
              −
            </span>
            <span className="nano-btn" aria-hidden>
              ▢
            </span>
            <span className="nano-btn" aria-hidden>
              ×
            </span>
          </div>
        </div>
        <pre
          ref={ref}
          className={cn(
            "nano-body overflow-x-auto px-4 py-3 text-sm leading-relaxed",
            showLineNumbers && "with-line-numbers",
          )}
        >
          <code className={className}>{wrapped}</code>
        </pre>
      </div>
    );
  }

  if (isTerminal) {
    return (
      <div className="terminal-block group relative my-5 overflow-hidden rounded-md border border-terminal-border shadow-md">
        <div className="terminal-chrome flex items-center justify-between px-3 py-1.5">
          <div className="w-16" />
          <span className="font-sans text-xs text-terminal-chrome-fg truncate">
            {title ?? "user@lumi: ~"}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onCopy}
              className="mr-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-terminal-chrome-fg/80 opacity-0 transition-opacity hover:bg-white/10 group-hover:opacity-100 focus:opacity-100"
              aria-label="Copy code"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <span className="terminal-btn" aria-hidden>
              −
            </span>
            <span className="terminal-btn" aria-hidden>
              ▢
            </span>
            <span className="terminal-btn" aria-hidden>
              ×
            </span>
          </div>
        </div>
        <pre
          ref={ref}
          className={cn(
            "overflow-x-auto px-4 py-3 text-sm leading-relaxed text-terminal-fg bg-terminal-bg",
            showLineNumbers && "with-line-numbers",
          )}
        >
          <code className={className}>{wrapped}</code>
        </pre>
      </div>
    );
  }

  return (
    <div className="group relative my-5 overflow-hidden rounded-lg border border-code-border bg-code-bg">
      <div className="flex items-center justify-between border-b border-code-border px-4 py-2 text-xs">
        <span className="flex items-center gap-2 font-mono text-foreground/60">
          {title && <span className="font-sans font-medium text-foreground/80">{title}</span>}
          {title && lang && <span className="opacity-40">·</span>}
          <span>{lang ?? "text"}</span>
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-foreground/60 opacity-0 transition-opacity hover:bg-foreground/10 group-hover:opacity-100 focus:opacity-100"
          aria-label="Copy code"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        ref={ref}
        className={cn(
          "overflow-x-auto px-4 py-3 text-sm leading-relaxed",
          showLineNumbers && "with-line-numbers",
        )}
      >
        <code className={className}>{wrapped}</code>
      </pre>
    </div>
  );
}
