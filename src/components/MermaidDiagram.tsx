import * as React from "react";
import { useTheme } from "@/lib/theme";

/*
 * Mermaid diagrams themed with the LUMI AIF brand palette only:
 *   white #ffffff, black #231f20, purple #7477b8, blue #2c6789,
 *   magenta #ec008c — or mixes of these with white/black.
 * Mermaid's theme engine needs concrete hex values (it does its own colour
 * math), so the mixes are computed here instead of via CSS color-mix().
 */

const WHITE = "#ffffff";
const BLACK = "#231f20";
const PURPLE = "#7477b8";
const BLUE = "#2c6789";
const MAGENTA = "#ec008c";

/** Mix two hex colours; `weight` is the share of `a` (0..1). */
function mix(a: string, b: string, weight: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) =>
    Math.round(((pa >> shift) & 0xff) * weight + ((pb >> shift) & 0xff) * (1 - weight));
  return "#" + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}

/** 12-step categorical ramp cycling purple/blue/magenta at varying tints.
 *  Used for pie slices, git branches, and timeline/mindmap sections. All
 *  steps are light enough to carry dark text in either page theme. */
function brandRamp(): string[] {
  const bases = [PURPLE, BLUE, MAGENTA];
  const weights = [0.55, 0.3, 0.75, 0.15];
  const out: string[] = [];
  for (const w of weights) for (const base of bases) out.push(mix(base, WHITE, w));
  return out;
}

function buildThemeVariables(mode: "light" | "dark"): Record<string, string> {
  const dark = mode === "dark";
  // Diagram surface colour: hex equivalents of the --code-bg tokens the
  // container box uses. Only mermaid's internal colour derivations depend on
  // these being exact — the visible edge-label backgrounds are forced to
  // var(--code-bg) by a CSS override in styles.css, so they always match the
  // box even if these approximations drift from the stylesheet.
  const bg = dark ? "#1a2026" : "#f3f9fd";
  const fg = dark ? WHITE : BLACK;
  const ramp = brandRamp();

  const scales: Record<string, string> = {};
  ramp.forEach((c, i) => {
    scales[`pie${i + 1}`] = c;
    scales[`cScale${i}`] = c;
    scales[`cScaleLabel${i}`] = BLACK;
    if (i < 8) scales[`git${i}`] = c;
  });

  return {
    darkMode: String(dark),
    background: bg,
    textColor: fg,
    lineColor: dark ? mix(BLUE, WHITE, 0.5) : BLUE,

    // Nodes (flowchart, state, class, sequence actors, ...)
    primaryColor: dark ? mix(PURPLE, BLACK, 0.45) : mix(PURPLE, WHITE, 0.18),
    primaryTextColor: fg,
    primaryBorderColor: dark ? mix(PURPLE, WHITE, 0.65) : PURPLE,
    secondaryColor: dark ? mix(BLUE, BLACK, 0.5) : mix(BLUE, WHITE, 0.16),
    secondaryTextColor: fg,
    secondaryBorderColor: dark ? mix(BLUE, WHITE, 0.55) : BLUE,
    tertiaryColor: dark ? mix(WHITE, BLACK, 0.09) : mix(BLACK, WHITE, 0.05),
    tertiaryTextColor: fg,
    tertiaryBorderColor: dark ? mix(WHITE, BLACK, 0.28) : mix(BLACK, WHITE, 0.3),

    // Subgraphs / clusters
    clusterBkg: dark ? mix(BLUE, BLACK, 0.3) : mix(BLUE, WHITE, 0.07),
    clusterBorder: dark ? mix(BLUE, WHITE, 0.4) : mix(BLUE, WHITE, 0.35),
    edgeLabelBackground: bg,

    // Notes (sequence/state) — magenta accent instead of mermaid's yellow
    noteBkgColor: dark ? mix(MAGENTA, BLACK, 0.35) : mix(MAGENTA, WHITE, 0.1),
    noteTextColor: fg,
    noteBorderColor: dark ? mix(MAGENTA, WHITE, 0.5) : mix(MAGENTA, WHITE, 0.45),

    // Sequence diagrams
    actorLineColor: dark ? mix(WHITE, BLACK, 0.45) : mix(BLACK, WHITE, 0.45),

    // ER diagrams
    attributeBackgroundColorOdd: dark ? mix(WHITE, BLACK, 0.06) : WHITE,
    attributeBackgroundColorEven: dark ? mix(WHITE, BLACK, 0.12) : mix(BLACK, WHITE, 0.04),

    // Gantt charts
    sectionBkgColor: dark ? mix(PURPLE, BLACK, 0.25) : mix(PURPLE, WHITE, 0.12),
    altSectionBkgColor: bg,
    sectionBkgColor2: dark ? mix(BLUE, BLACK, 0.25) : mix(BLUE, WHITE, 0.12),
    taskBkgColor: dark ? mix(PURPLE, BLACK, 0.55) : mix(PURPLE, WHITE, 0.4),
    taskBorderColor: PURPLE,
    taskTextColor: fg,
    taskTextOutsideColor: fg,
    activeTaskBkgColor: dark ? mix(BLUE, BLACK, 0.6) : mix(BLUE, WHITE, 0.35),
    activeTaskBorderColor: BLUE,
    doneTaskBkgColor: dark ? mix(WHITE, BLACK, 0.2) : mix(BLACK, WHITE, 0.12),
    doneTaskBorderColor: dark ? mix(WHITE, BLACK, 0.4) : mix(BLACK, WHITE, 0.4),
    critBkgColor: dark ? mix(MAGENTA, BLACK, 0.55) : mix(MAGENTA, WHITE, 0.35),
    critBorderColor: MAGENTA,
    todayLineColor: MAGENTA,
    gridColor: dark ? mix(WHITE, BLACK, 0.25) : mix(BLACK, WHITE, 0.2),

    // Pie / timeline / mindmap label text sits on the light ramp tints
    pieTitleTextColor: fg,
    pieLegendTextColor: fg,
    pieSectionTextColor: BLACK,
    pieStrokeColor: dark ? mix(WHITE, BLACK, 0.3) : WHITE,
    pieOuterStrokeColor: dark ? mix(WHITE, BLACK, 0.3) : mix(BLACK, WHITE, 0.3),

    errorBkgColor: MAGENTA,
    errorTextColor: WHITE,

    ...scales,
  };
}

type MermaidAPI = typeof import("mermaid").default;

let loader: Promise<MermaidAPI> | null = null;
function loadMermaid(): Promise<MermaidAPI> {
  loader ??= import("mermaid").then((m) => m.default);
  return loader;
}

let renderSeq = 0;

interface MermaidDiagramProps {
  source: string;
}

export function MermaidDiagram({ source }: MermaidDiagramProps) {
  const { resolved } = useTheme();
  const [svg, setSvg] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    // Inter is a self-hosted web font, and mermaid sizes every box by measuring
    // its label in the browser. Measuring before the font swaps in bakes the
    // fallback font's metrics into the SVG, so wait for fonts first.
    Promise.all([loadMermaid(), document.fonts?.ready])
      .then(([mermaid]) => {
        // initialize() is global, but every diagram on a page shares the same
        // resolved theme, so re-initializing before each render is safe.
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          suppressErrorRendering: true,
          theme: "base",
          themeVariables: buildThemeVariables(resolved),
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
          // Mermaid's 200px default is narrower than a typical authored line,
          // so it re-wraps labels that already carry their own <br/> breaks and
          // leaves orphan words. Wide enough for a hand-broken line to survive,
          // still narrow enough that an unbroken sentence wraps instead of
          // stretching the diagram off the page.
          flowchart: { wrappingWidth: 340 },
        });
        return mermaid.render(`lumi-mermaid-${++renderSeq}`, source);
      })
      .then((result) => {
        if (cancelled) return;
        setSvg(result.svg);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setSvg(null);
        setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [source, resolved]);

  if (error) {
    return (
      <div className="mermaid-error my-5 overflow-hidden rounded-lg border">
        <p className="border-b px-4 py-2 text-sm font-medium">Mermaid diagram failed to render</p>
        <pre className="overflow-x-auto px-4 py-3 text-sm leading-relaxed">
          <code>{source}</code>
        </pre>
        <p className="border-t px-4 py-2 font-mono text-xs whitespace-pre-wrap">{error}</p>
      </div>
    );
  }

  if (svg) {
    return <div className="mermaid-block" dangerouslySetInnerHTML={{ __html: svg }} />;
  }

  // Pre-hydration / while the mermaid chunk loads: show the source dimmed so
  // prerendered HTML still carries the diagram's content.
  return (
    <div className="mermaid-block mermaid-loading" aria-busy="true">
      <pre>
        <code>{source}</code>
      </pre>
    </div>
  );
}
