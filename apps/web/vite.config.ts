import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, loadEnv } from "vite";
import svgr from "vite-plugin-svgr";

const config = defineConfig(({ mode }) => {
  // Keep the workspace-root .env authoritative and use its API origin for both proxies.
  const environment = loadEnv(mode, "../..", "VITE_");
  // Use a local default so a new checkout can proxy to the local API immediately.
  const apiServerUrl = environment.VITE_API_URL || "http://localhost:3001";

  return {
    envDir: "../..",
    resolve: { tsconfigPaths: true },
    server: {
      proxy: {
        // Forward browser API calls during development to the separate API process.
        "/api": {
          target: apiServerUrl,
          changeOrigin: true,
        },
      },
    },
    plugins: [
      devtools(),
      nitro({
        routeRules: { "/api/**": { proxy: `${apiServerUrl}/api/**` } },
        rollupConfig: { external: [/^@sentry\//] },
      }),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
      svgr(),
    ],
  };
});

export default config;
