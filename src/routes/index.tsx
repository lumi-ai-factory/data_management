import { createFileRoute, notFound } from "@tanstack/react-router";
import { findPage, getPageDescription } from "@/lib/content";
import { PageLayout } from "@/components/PageLayout";
import { siteConfig, absoluteUrl } from "../../site.config";

export const Route = createFileRoute("/")({
  component: IndexPage,
  head: () => {
    const page = findPage("");
    const title = page?.frontmatter.title
      ? `${page.frontmatter.title} — ${siteConfig.title}`
      : siteConfig.title;
    const description = page
      ? getPageDescription(page) || siteConfig.description
      : siteConfig.description;
    const url = absoluteUrl("/");
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Course",
            name: siteConfig.title,
            description,
            provider: {
              "@type": "Organization",
              name: siteConfig.title,
            },
          }),
        },
      ],
    };
  },
});

function IndexPage() {
  const page = findPage("");
  if (!page) throw notFound();
  return <PageLayout page={page} />;
}
