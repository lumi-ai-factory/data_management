// Site-level values. Nothing here is meant to be edited by a course author:
// everything is either a LUMI AI Factory constant or derived from what the
// author already writes in `content/`, so a fresh copy of the template names
// itself correctly with no configuration step. This file is part of the
// template internals, so improvements to it reach existing courses when they
// pull template updates.
//
//   title       first heading of content/index.md, else the repo name
//   description content/index.md front-matter `description`, else its first paragraph
//   siteUrl     VITE_SITE_URL, computed from GITHUB_REPOSITORY in the deploy workflow
//   auxLinks    LUMI AIF constant
//   copyright   LUMI AIF constant, year from the build date
//   fundingNotice LUMI AIF constant

import { findPage, firstHeading, getPageDescription } from "./content";

/** Used only when content/index.md has no heading and no repo name is known. */
const FALLBACK_TITLE = "LUMI AI Factory Learning Materials";
/** Used only when content/index.md has no usable first paragraph. */
const FALLBACK_DESCRIPTION = "Official training documentation from LUMI AI Factory.";

/**
 * Repo name from the GitHub Pages base path, as a last resort for the site
 * title: "/Intro_To_LUMI/" -> "Intro To LUMI". Empty for a user/organisation
 * site (served from "/") and in local dev, where the index.md heading is the
 * only source anyway.
 */
function repoNameFromBasePath(): string {
  const base = (import.meta.env.BASE_URL || "/").replace(/^\/|\/$/g, "");
  if (!base) return "";
  return base.split("/")[0].replace(/[-_]+/g, " ").trim();
}

function deriveTitle(): string {
  const home = findPage("");
  const heading = home ? firstHeading(home.body) : "";
  return heading || repoNameFromBasePath() || FALLBACK_TITLE;
}

function deriveDescription(): string {
  const home = findPage("");
  return (home && getPageDescription(home)) || FALLBACK_DESCRIPTION;
}

export const siteConfig = {
  /** Shown in the browser tab, og:title, and the JSON-LD course name. */
  title: deriveTitle(),
  /** Default meta description and og:description. */
  description: deriveDescription(),
  /**
   * Canonical site URL, no trailing slash. Auto-detected at build time from
   * GITHUB_REPOSITORY in the deploy workflow. Set VITE_SITE_URL by hand only
   * when deploying outside GitHub Pages.
   */
  siteUrl: import.meta.env.VITE_SITE_URL ?? "",
  /** External links shown on the right of the header. */
  auxLinks: [{ label: "LUMI AIF Website", href: "https://lumi-ai-factory.eu/" }],
  /**
   * Attribution shown in the footer, next to the licences. CC BY only works if
   * a reuser knows who to credit. The year is the build year, so it never goes
   * stale.
   */
  copyright: `© ${new Date().getFullYear()} LUMI AI Factory`,
  /** Funding acknowledgement shown at the end of every page. */
  fundingNotice:
    "The LUMI AI Factory Service Center is funded jointly by the EuroHPC Joint Undertaking and the Participating States FI, CZ, DK, EE, NO, PL.",
};

export type SiteConfig = typeof siteConfig;

/**
 * Build an absolute URL for a site-relative path (e.g. "/chapter1" or "/").
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
