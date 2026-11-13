import type { UserConfig } from "@commitlint/types";

const config: UserConfig = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [2, "always", ["web", "api", "shared", "deps", "ci", "repo"]],
    "scope-empty": [1, "never"],
  },
};

export default config;
