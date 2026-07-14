import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { TableOfContents } from "./TableOfContents";
import { extractToc } from "@/lib/toc";
import { getBreadcrumbs, getPrevNext, type Page } from "@/lib/content";
import { useScrollMemory } from "@/hooks/use-scroll-memory";
import { siteConfig } from "../../site.config";

interface Props {
  page: Page;
}

/** Type-safe link to a content page: "" is the home route, anything else goes
 *  through the catch-all splat route. Avoids casting dynamic slugs to `any`. */
function PageLink({
  slug,
  className,
  children,
}: {
  slug: string;
  className?: string;
  children: React.ReactNode;
}) {
  return slug === "" ? (
    <Link to="/" className={className}>
      {children}
    </Link>
  ) : (
    <Link to="/$" params={{ _splat: slug }} className={className}>
      {children}
    </Link>
  );
}

export function PageLayout({ page }: Props) {
  const articleRef = React.useRef<HTMLElement>(null);
  useScrollMemory(page.slug, articleRef);
  const isGlossary = page.slug === "glossary";
  const toc = React.useMemo(() => extractToc(page.body), [page.body]);
  const breadcrumbs = React.useMemo(() => getBreadcrumbs(page.slug), [page.slug]);
  const { prev, next } = React.useMemo(() => getPrevNext(page.slug), [page.slug]);

  return (
    <div className="grid grid-cols-1 gap-10 xl:grid-cols-[minmax(0,1fr)_220px]">
      <article
        ref={articleRef}
        className="min-w-0 mx-auto w-full max-w-[78ch] xl:mx-0 xl:max-w-none"
      >
        {breadcrumbs.length > 1 && (
          <nav
            aria-label="Breadcrumb"
            className="mb-6 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
          >
            {breadcrumbs.map((crumb, i) => {
              const isLast = i === breadcrumbs.length - 1;
              return (
                <React.Fragment key={crumb.slug}>
                  {i > 0 && <span className="opacity-60">/</span>}
                  {isLast ? (
                    <span className="text-foreground/80">{crumb.frontmatter.title}</span>
                  ) : (
                    <PageLink slug={crumb.slug} className="hover:text-lumi-magenta hover:underline">
                      {crumb.frontmatter.title}
                    </PageLink>
                  )}
                </React.Fragment>
              );
            })}
          </nav>
        )}

        <MarkdownRenderer source={page.body} enableGlossary={!isGlossary} />

        {(prev || next) && (
          <nav
            aria-label="Page navigation"
            className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-2"
          >
            {prev ? (
              <PageLink
                slug={prev.slug}
                className="group flex flex-col rounded-lg border border-border p-4 text-left transition-colors hover:border-lumi-magenta"
              >
                <span className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Previous
                </span>
                <span className="mt-1 font-medium text-foreground group-hover:text-lumi-magenta">
                  {prev.frontmatter.title}
                </span>
              </PageLink>
            ) : (
              <span />
            )}
            {next ? (
              <PageLink
                slug={next.slug}
                className="group flex flex-col rounded-lg border border-border p-4 text-right transition-colors hover:border-lumi-magenta sm:col-start-2"
              >
                <span className="flex items-center justify-end gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
                <span className="mt-1 font-medium text-foreground group-hover:text-lumi-magenta">
                  {next.frontmatter.title}
                </span>
              </PageLink>
            ) : null}
          </nav>
        )}

        {siteConfig.fundingNotice && (
          <footer className="mt-12 border-t border-border pt-6 pb-2">
            <p className="mx-auto max-w-md text-center text-xs leading-relaxed text-muted-foreground/70">
              {siteConfig.fundingNotice}
            </p>
          </footer>
        )}
      </article>

      <aside className="hidden xl:block">
        <TableOfContents items={toc} />
      </aside>
    </div>
  );
}
