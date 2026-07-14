import * as React from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalloutProps {
  variant: "note" | "warning" | "info" | "tip" | "command";
  title?: React.ReactNode;
  children: React.ReactNode;
}

const variantStyles: Record<CalloutProps["variant"], string> = {
  note: "border-callout-note-border bg-callout-note-bg",
  warning: "border-callout-warning-border bg-callout-warning-bg",
  info: "border-callout-info-border bg-callout-info-bg",
  tip: "border-callout-tip-border bg-callout-tip-bg",
  command: "border-callout-command-border bg-callout-command-bg",
};

const variantAccent: Record<CalloutProps["variant"], string> = {
  note: "bg-lumi-purple",
  warning: "bg-lumi-magenta",
  info: "bg-lumi-blue/55",
  tip: "bg-lumi-blue",
  command: "bg-lumi-blue",
};

const variantLabel: Record<CalloutProps["variant"], string> = {
  note: "Note",
  warning: "Warning",
  info: "Info",
  tip: "Tip",
  command: "Command",
};

export function Callout({ variant, title, children }: CalloutProps) {
  if (variant === "command") {
    return <CommandCallout title={title}>{children}</CommandCallout>;
  }

  return (
    <aside className={cn("my-6 overflow-hidden rounded-lg border", variantStyles[variant])}>
      <div className="flex">
        <div className={cn("w-1.5 shrink-0", variantAccent[variant])} />
        <div className="flex-1 px-5 py-4">
          <p className="mb-1 text-sm font-semibold tracking-wide uppercase text-foreground/80">
            {title ?? variantLabel[variant]}
          </p>
          <div className="callout-body text-foreground/90 [&>:first-child]:mt-0 [&>:last-child]:mb-0">
            {children}
          </div>
        </div>
      </div>
    </aside>
  );
}

function CommandCallout({
  title,
  children,
}: {
  title?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [copied, setCopied] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  const onCopy = async () => {
    const text = ref.current?.innerText.trim() ?? "";
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <aside className={cn("my-6 overflow-hidden rounded-lg border", variantStyles.command)}>
      <div className="flex items-center justify-between border-b border-callout-command-border bg-callout-command-bg/50 px-4 py-2">
        <span className="text-xs font-semibold tracking-wide uppercase text-foreground/70">
          {title ?? "Command"}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-foreground/70 transition-colors hover:bg-foreground/10"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div ref={ref} className="callout-command-body px-5 py-3 font-mono text-sm text-foreground">
        {children}
      </div>
    </aside>
  );
}
