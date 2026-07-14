import { createFileRoute, notFound } from "@tanstack/react-router";
import { findPage, getBreadcrumbs, getPageDescription } from "@/lib/content";
import { PageLayout } from "@/components/PageLayout";
import { siteConfig, absoluteUrl } from "../../site.config";

export const Route = createFileRoute("/$")({
  component: CatchAllPage,
  head: ({ params }) => {
    const slug = ((params as { _splat?: string })._splat ?? "").replace(/\/+$/, "");
    const page = findPage(slug);
    const title = page?.frontmatter.title
      ? `${page.frontmatter.title} — ${siteConfig.title}`
      : siteConfig.title;
    if (!page) {
      return { meta: [{ title }, { property: "og:title", content: title }] };
    }

    const description = getPageDescription(page) || siteConfig.description;
    const url = absoluteUrl(slug === "" ? "/" : `/${slug}/`);
    const crumbs = getBreadcrumbs(slug);

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: page.frontmatter.title,
            description,
            isPartOf: {
              "@type": "Course",
              name: siteConfig.title,
            },
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: crumbs.map((crumb, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: crumb.frontmatter.title,
              item: absoluteUrl(crumb.slug === "" ? "/" : `/${crumb.slug}/`),
            })),
          }),
        },
      ],
    };
  },
});

function CatchAllPage() {
  const params = Route.useParams() as { _splat?: string };
  const slug = (params._splat ?? "").replace(/\/+$/, "");
  const page = findPage(slug);
  if (!page) throw notFound();
  return <PageLayout page={page} />;
}
