import { defineNitroConfig } from "nitro/config";

export default defineNitroConfig({
  preset: "node-server",
  publicDir: "./public",
  output: {
    dir: ".output",
    publicDir: "./public",
  },
});
