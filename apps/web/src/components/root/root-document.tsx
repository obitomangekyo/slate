import { TanStackDevtools } from "@tanstack/react-devtools";
import { HeadContent, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { type ReactNode, useMemo } from "react";

export function RootDocument({ children }: { children: ReactNode }) {
  const devtoolsPlugins = useMemo(
    () => [
      {
        name: "Tanstack Router",
        render: <TanStackRouterDevtoolsPanel />,
      },
    ],
    [],
  );

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
