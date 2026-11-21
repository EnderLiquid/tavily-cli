import { defineConfig } from "tsup";

export default defineConfig({
  entry: { cli: "src/bin.ts" },
  format: ["esm"],
  target: "node20",
  platform: "node",
  clean: true,
  dts: false,
});
