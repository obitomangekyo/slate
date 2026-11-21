import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext } from "@tanstack/react-router";
import { RootError, RootNotFound, RootPending } from "#/components/root/root-boundaries";
import { RootDocument } from "#/components/root/root-document";
import { RootLayout } from "#/components/root/root-layout";
import { reportError } from "#/lib/error-reporting";
import { generateStructuredData, SEO } from "#/lib/seo";
import appCss from "#/styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // Keep the document shell, loading UI, and error screens consistent on every route.
  wrapInSuspense: true,
  pendingMs: 200,
  pendingMinMs: 350,
  pendingComponent: RootPending,
  errorComponent: RootError,
  notFoundComponent: RootNotFound,
  onError: (error) => reportError(error, { kind: "router.onError" }),
  onCatch: (error) => reportError(error, { kind: "router.onCatch" }),
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        name: "referrer",
        content: "strict-origin-when-cross-origin",
      },
      {
        name: "color-scheme",
        content: "light",
      },
      {
        title: SEO.title,
      },
      {
        name: "description",
        content: SEO.description,
      },
      {
        name: "application-name",
        content: "Slate",
      },
      {
        name: "theme-color",
        content: SEO.themeColor,
      },
      {
        name: "author",
        content: SEO.siteName,
      },
      {
        name: "robots",
        content: "index,follow,max-image-preview:large",
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        property: "og:site_name",
        content: "Slate",
      },
      {
        property: "og:title",
        content: SEO.title,
      },
      {
        property: "og:description",
        content: SEO.description,
      },
      ...(SEO.siteUrl ? [{ property: "og:url", content: SEO.siteUrl }] : []),
      {
        property: "og:locale",
        content: "en_US",
      },
      {
        name: "twitter:card",
        content: "summary",
      },
      {
        name: "twitter:title",
        content: SEO.title,
      },
      {
        name: "twitter:description",
        content: SEO.description,
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/favicon-32x32.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "16x16",
        href: "/favicon-16x16.png",
      },
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "/apple-touch-icon.png",
      },
      { rel: "manifest", href: "/manifest.json" },
      ...(SEO.siteUrl ? [{ rel: "canonical", href: SEO.siteUrl }] : []),
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(generateStructuredData()),
      },
    ],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
});
