import { env } from "#/env";

export const SEO = {
  siteName: "Slate",
  siteUrl: env.VITE_SITE_URL?.replace(/\/$/, ""),
  title: "Slate — Retrospectives that move teams forward",
  description:
    "A real-time workspace for engineering teams to map the work, make sense of it together, and turn honest retrospectives into clear next steps.",
  themeColor: "#18262b",
} as const;

export function generateStructuredData() {
  // Use stable identifiers so crawlers can connect the site and application records.
  const websiteId = SEO.siteUrl ? `${SEO.siteUrl}/#website` : undefined;
  const applicationId = SEO.siteUrl ? `${SEO.siteUrl}/#application` : undefined;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        ...(websiteId && { "@id": websiteId, url: SEO.siteUrl }),
        "@type": "WebSite",
        name: SEO.siteName,
        description: SEO.description,
        inLanguage: "en",
      },
      {
        ...(applicationId && { "@id": applicationId, url: SEO.siteUrl }),
        "@type": "WebApplication",
        name: SEO.siteName,
        applicationCategory: "BusinessApplication",
        applicationSubCategory: "Collaborative retrospective and story mapping tool",
        operatingSystem: "Web",
        description: SEO.description,
        featureList: [
          "Real-time team collaboration",
          "Interactive retrospective boards",
          "Story mapping",
          "Sticky-note clustering",
          "Dot voting",
          "Connections between ideas",
        ],
        ...(websiteId && { isPartOf: { "@id": websiteId } }),
      },
    ],
  };
}
