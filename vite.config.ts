import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, relative } from "node:path";
import type { Plugin } from "vite";
// Note: do NOT import ./site.config here — it reads import.meta.env, which is
// undefined when vite.config.ts itself runs in Node, and would crash the build.

const basePath = process.env.VITE_BASE_PATH || "/";

function walkMd(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) walkMd(full, out);
    else if (name.endsWith(".md")) out.push(full);
  }
  return out;
}

function fileToSlug(filePath: string): string {
  const rel = relative("content", filePath).replace(/\\/g, "/").replace(/\.md$/, "");
  return rel === "index" ? "" : rel;
}

function joinUrl(a: string, b: string) {
  return `${a.replace(/\/$/, "")}/${b.replace(/^\//, "")}`;
}

// Last commit time of a file (ISO 8601). Falls back to filesystem mtime when
// git history is unavailable (shallow clone, uncommitted file, no git).
// Requires `fetch-depth: 0` on actions/checkout in CI — a shallow clone would
// silently report the wrong date.
function lastModified(filePath: string): string {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cI", "--", filePath], {
      encoding: "utf-8",
    }).trim();
    if (out) return out;
  } catch {
    // fall through to mtime
  }
  return statSync(filePath).mtime.toISOString();
}

// Generate sitemap.xml + robots.txt at build time from markdown content.
function sitemapPlugin(): Plugin {
  return {
    name: "lumi-sitemap",
    apply: "build",
    closeBundle() {
      try {
        const files = walkMd("content");
        const base = (process.env.VITE_SITE_URL || "").replace(/\/$/, "");
        if (!base) return;
        const urls = files.map((f) => {
          const slug = fileToSlug(f);
          const loc = slug === "" ? `${base}/` : `${base}/${slug}/`;
          const lastmod = lastModified(f);
          return `  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod></url>`;
        });
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
        const robots = `User-agent: *\nAllow: /\n\nSitemap: ${joinUrl(base, "sitemap.xml")}\n`;
        // Force write to dist/client so it gets uploaded to GitHub Pages
        const finalDir = join(process.cwd(), "dist", "client");
        mkdirSync(finalDir, { recursive: true });
        writeFileSync(join(finalDir, "sitemap.xml"), xml);
        writeFileSync(join(finalDir, "robots.txt"), robots);
      } catch (e) {
        // Don't fail the build on sitemap errors.

        console.warn("[lumi-sitemap] skipped:", e);
      }
    },
  };
}

// Prerender one HTML file per content page so deep links (opened directly or
// in a new tab) are served their own fully-rendered HTML — with the correct
// sidebar item highlighted — instead of falling back to the "/" shell (which
// would always show the first/home chapter as active until JS hydrates).
function contentPages() {
  const slugs = walkMd("content").map(fileToSlug);
  const paths = new Set<string>(["/"]);
  for (const slug of slugs) paths.add(slug === "" ? "/" : `/${slug}/`);
  return Array.from(paths).map((path) => ({
    path,
    prerender: { enabled: true, crawlLinks: true },
  }));
}

export default defineConfig({
  base: basePath,
  // Match the build's CSS pipeline in dev. @tailwindcss/vite runs Lightning CSS
  // at build, so build-time transforms (e.g. collapsing a hand-written
  // `-webkit-backdrop-filter` to the prefixed form Chrome ignores) would break
  // the built/static output while the dev preview looks fine. Running Lightning
  // CSS in both keeps the preview honest.
  css: { transformer: "lightningcss" },
  resolve: {
    alias: {
      "@": `${process.cwd()}/src`,
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  server: { host: "::", port: 8080 },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
      server: { entry: "server" },
      spa: { enabled: true },
      pages: contentPages(),
    }),
    viteReact(),
    sitemapPlugin(),
  ],
});
