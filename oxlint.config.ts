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
    // Controller render props and small prop arrays are intentional in form components.
    // "react-perf/jsx-no-new-function-as-prop": "off",
    // "react-perf/jsx-no-new-array-as-prop": "off",
    // "react-perf/jsx-no-jsx-as-prop": "error",
    "typescript/no-explicit-any": "error",
    "no-underscore-dangle": ["error", { allow: ["_id"] }],
  },
  ignorePatterns: ["dist/**", "node_modules/**", "**/routeTree.gen.ts"],
});
