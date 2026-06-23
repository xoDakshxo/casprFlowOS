import js from "@eslint/js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/dist-electron/**",
      "**/dist-types/**",
      "**/node_modules/**",
      "**/*.tsbuildinfo",
      "apps/desktop/src/casprflow/**",
      "apps/desktop/src/shared/**",
      "apps/desktop/electron/file-tree-watcher.ts",
      "apps/desktop/electron/fs-copy.ts",
      "apps/desktop/electron/git-diff.ts",
      "apps/desktop/electron/git-info.ts",
      "apps/desktop/electron/git-paths.ts",
      "apps/desktop/electron/git-watcher.ts",
      "apps/desktop/electron/project-scanner.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { fixStyle: "inline-type-imports", prefer: "type-imports" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
);
