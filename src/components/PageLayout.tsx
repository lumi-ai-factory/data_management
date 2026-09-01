import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { PageLink } from "./PageLink";
import { TableOfContents } from "./TableOfContents";
import { extractToc } from "@/lib/toc";
import { getBreadcrumbs, getPrevNext, type Page } from "@/lib/content";
import { useScrollMemory } from "@/hooks/use-scroll-memory";
import { siteConfig } from "@/lib/site";

interface Props {
  page: Page;
}

const footerLink =
  "text-foreground/75 underline decoration-border underline-offset-4 transition-colors hover:text-lumi-magenta hover:decoration-lumi-magenta";

/** Separator between the footer's legal items. */
function FooterDot() {
  return (
    <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-current opacity-30" />
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

        <footer className="mt-16 flex flex-col items-center gap-2.5 border-t border-border pt-8 pb-14 text-center leading-relaxed text-muted-foreground">
          <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[13px]">
            <span className="whitespace-nowrap">{siteConfig.copyright}</span>
            <FooterDot />
            <span className="whitespace-nowrap">
              Content licensed under{" "}
              <a
                href="https://creativecommons.org/licenses/by/4.0/"
                target="_blank"
                rel="noopener noreferrer"
                title="Creative Commons Attribution 4.0 International"
                className={footerLink}
              >
                CC BY 4.0
              </a>
            </span>
            <FooterDot />
            <span className="whitespace-nowrap">
              Code licensed under the{" "}
              <a
                href="https://opensource.org/license/mit"
                target="_blank"
                rel="noopener noreferrer"
                className={footerLink}
              >
                MIT Licence
              </a>
            </span>
          </p>
          {siteConfig.fundingNotice && (
            <p className="text-pretty text-xs">{siteConfig.fundingNotice}</p>
          )}
        </footer>
      </article>

      <aside className="hidden xl:block">
        <TableOfContents items={toc} />
      </aside>
    </div>
  );
}
