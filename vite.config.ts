// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  nitro: {
    cloudflare: {
      nodeCompat: true,
      deployConfig: true,
      // hash-wasm compiles Argon2 wasm at runtime via WebAssembly.compile().
      // Cloudflare Workers blocks dynamic wasm compilation by default unless the
      // `wasm_unsafe_eval_compatibility_modules` compatibility flag is enabled.
      wrangler: {
        compatibility_flags: ["wasm_unsafe_eval_compatibility_modules"],
      },
    },
  } as never,
});
