import { TanStackDevtools } from "@tanstack/react-devtools";
import { HotkeysDevtoolsPanel } from "@tanstack/react-hotkeys-devtools";
import { PacerDevtoolsPanel } from "@tanstack/react-pacer-devtools";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { HeadContent, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import type { ReactNode } from "react";

const devtoolsPlugins = [
  {
    name: "Tanstack Router",
    render: <TanStackRouterDevtoolsPanel />,
  },
  {
    name: "Tanstack Hotkeys",
    render: <HotkeysDevtoolsPanel />,
  },
  {
    name: "Tanstack Query",
    // Inspect cached requests during development; this panel is not part of the app UI.
    render: <ReactQueryDevtoolsPanel />,
  },
  {
    name: "Tanstack Pacer",
    render: <PacerDevtoolsPanel />,
  },
];

export function RootDocument({ children }: { children: ReactNode }) {
  // Render the HTML shell so Start can add head tags and hydration scripts.
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackDevtools plugins={devtoolsPlugins} />
        <Scripts />
      </body>
    </html>
  );
}
