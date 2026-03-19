import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bufferShimPath = path.resolve(
  __dirname,
  "node_modules/vite-plugin-node-polyfills/shims/buffer/dist/index.js",
);

function bufferShimFix(): Plugin {
  return {
    name: "buffer-shim-fix",
    enforce: "pre",
    resolveId(id) {
      if (id === "vite-plugin-node-polyfills/shims/buffer") {
        return bufferShimPath;
      }
    },
  };
}

// The reactRouter() plugin does an SSR pass even with ssr:false. nodePolyfills
// aliases Node builtins to CJS browser shims which break in Vite 6's ESM SSR
// runner. Intercept loading of polyfill files in SSR and replace with native
// Node module re-exports.
function ssrNativeModules(): Plugin {
  // Map polyfill package dir names to their native Node equivalents.
  // Pre-compute named exports at plugin init so the load hook returns static ESM.
  const require = createRequire(import.meta.url);
  const polyfillToNative = new Map(
    (
      [
        ["stream-browserify", "stream"],
        ["crypto-browserify", "crypto"],
      ] as const
    ).map(([pkg, native]) => {
      const mod = require(native);
      const names = Object.keys(mod).filter((k) => k !== "default");
      return [pkg, { native: `node:${native}`, names }];
    }),
  );

  return {
    name: "ssr-native-modules",
    enforce: "pre",
    load(id) {
      if (this.environment?.name !== "ssr") return;
      for (const [pkg, { native, names }] of polyfillToNative) {
        if (id.includes(`node_modules/${pkg}/`)) {
          return [
            `import { createRequire as _cr } from "node:module";`,
            `const _mod = _cr(import.meta.url)("${native}");`,
            `export default _mod;`,
            ...names.map((n) => `export const ${n} = _mod.${n};`),
          ].join("\n");
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [
    bufferShimFix(),
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
    nodePolyfills({
      include: ["buffer", "process", "util", "stream", "events", "crypto"],
      globals: { Buffer: true, process: true },
    }),
    ssrNativeModules(),
  ],
});
