import { defineConfig } from "oxlint";

export default defineConfig({
  plugins: ["typescript", "react", "react-perf", "jsx-a11y", "import"],
  categories: {
    correctness: "error",
    suspicious: "error",
    perf: "warn",
  },
  rules: {
    "react/react-in-jsx-scope": "off",
    "typescript/no-explicit-any": "error",
  },
  ignorePatterns: ["dist/**", "node_modules/**", "**/routeTree.gen.ts"],
});
