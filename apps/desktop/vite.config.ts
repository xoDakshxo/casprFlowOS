import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { build as esbuild, context as esbuildContext, type BuildOptions } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(dirname, "../..");

const buildPreload = (): Plugin => {
  const options: BuildOptions = {
    entryPoints: ["electron/preload.ts"],
    outfile: "dist-electron/preload.cjs",
    format: "cjs",
    platform: "node",
    bundle: true,
    sourcemap: true,
    external: ["electron"],
  };

  return {
    name: "casprflowos-preload",
    async buildStart() {
      if (this.meta.watchMode) {
        const context = await esbuildContext(options);
        await context.watch();
        return;
      }

      await esbuild(options);
    },
  };
};

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    buildPreload(),
    electron([
      {
        entry: "electron/main.ts",
        vite: {
          build: {
            outDir: "dist-electron",
            rollupOptions: {
              external: ["electron", "node-pty"],
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: [
      {
        find: "@casprflowos/ui/tokens.css",
        replacement: path.resolve(workspaceRoot, "packages/ui/src/tokens.css"),
      },
      {
        find: /^@casprflowos\/shared$/,
        replacement: path.resolve(workspaceRoot, "packages/shared/src/index.ts"),
      },
      {
        find: /^@casprflowos\/canvas-core$/,
        replacement: path.resolve(workspaceRoot, "packages/canvas-core/src/index.ts"),
      },
      {
        find: /^@casprflowos\/ui$/,
        replacement: path.resolve(workspaceRoot, "packages/ui/src/index.ts"),
      },
    ],
  },
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
