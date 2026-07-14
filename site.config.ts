// Site-level configuration for the LUMI AI Factory learning template.
//
// Content creators normally only need to edit `title`, `description`, and
// `auxLinks`. The URL, GitHub repo, and branch are auto-detected from the
// GitHub Actions environment at build time, so the template works for any
// fork regardless of repo name — leave them as empty fallbacks unless you
// are deploying outside GitHub Pages.

export const siteConfig = {
  /** Shown in the browser tab and the header. */
  title: "LUMI AIF Learning Materials",
  /** Default meta description and og:description. */
  description: "Official training documentation from LUMI AI Factory.",
  /**
   * Canonical site URL (no trailing slash). Auto-detected at build time from
   * GITHUB_REPOSITORY in the deploy workflow. Only set this manually when
   * deploying outside GitHub Pages.
   */
  siteUrl: import.meta.env.VITE_SITE_URL ?? "",
  /** External links shown on the right of the header. */
  auxLinks: [{ label: "LUMI AIF Website", href: "https://lumi-ai-factory.eu/" }],
  /** Funding acknowledgement shown at the end of every page. Set to "" to hide. */
  fundingNotice:
    "The LUMI AI Factory Service Center is funded jointly by the EuroHPC Joint Undertaking and the Participating States FI, CZ, DK, EE, NO, PL.",
};

export type SiteConfig = typeof siteConfig;

/**
 * Build an absolute URL for a site-relative path (e.g. "/Chapter_2" or "/").
 * Canonical links and og:url must be absolute — a relative "/" resolves
 * against the current page's own URL, which for a GitHub Pages *project*
 * site (served from a subpath) points at the domain root instead of this
 * site. Falls back to the relative path when siteUrl isn't known yet (e.g.
 * local dev), since there's no absolute origin to anchor to.
 */
export function absoluteUrl(path: string): string {
  if (!siteConfig.siteUrl) return path;
  return `${siteConfig.siteUrl}${path}`;
}
