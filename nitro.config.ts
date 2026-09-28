import { defineNitroConfig } from "nitro/config";

export default defineNitroConfig({
  preset: "node-server",
  publicDir: "./public",
  output: {
    dir: ".output",
    publicDir: "./public",
  },
  publicAssets: [
    {
      dir: "./public",
      fallthrough: true,
    },
  ],
  routeRules: {
    "/assets/**": {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
    "/**": {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    },
  },
});
