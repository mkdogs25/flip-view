import esbuild from "esbuild";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";

mkdirSync("dev/dist", { recursive: true });
await esbuild.build({
  entryPoints: ["dev/harness.ts"],
  bundle: true,
  outfile: "dev/dist/harness.js",
  alias: { obsidian: "./dev/obsidian-shim.ts" },
  loader: { ".woff2": "dataurl", ".jpg": "dataurl", ".png": "dataurl" },
  target: "es2020",
  format: "iife",
  logLevel: "info",
});
copyFileSync("styles.css", "dev/dist/styles.css");
writeFileSync(
  "dev/dist/harness.html",
  `<!doctype html><html><head><meta charset="utf-8"><title>harness</title>
<link rel="stylesheet" href="styles.css">
<style>
 :root{ --font-interface: -apple-system, "Segoe UI", Inter, sans-serif; --font-text: Georgia, "Times New Roman", serif; --interactive-accent:#7c5cbf; }
 html,body{margin:0;height:100%;font-family:var(--font-interface)} #host{position:fixed;inset:0}
</style></head><body><div id="host" class="fv-host"></div><script src="harness.js"></script></body></html>`,
);
