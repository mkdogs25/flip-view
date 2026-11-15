// Usage: npm run bump [patch|minor|major|x.y.z]
// Updates manifest.json, package.json and versions.json together.
import { readFileSync, writeFileSync } from "node:fs";

const arg = process.argv[2] ?? "patch";
const read = (f) => JSON.parse(readFileSync(f, "utf8"));
const write = (f, o) => writeFileSync(f, JSON.stringify(o, null, 2) + "\n");

const manifest = read("manifest.json");
let next = arg;
if (["patch", "minor", "major"].includes(arg)) {
  const [maj, min, pat] = manifest.version.split(/[.-]/).map(Number);
  next = arg === "major" ? `${maj + 1}.0.0` : arg === "minor" ? `${maj}.${min + 1}.0` : `${maj}.${min}.${pat + 1}`;
}
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(next)) {
  console.error(`Invalid version: ${next}`);
  process.exit(1);
}
manifest.version = next;
write("manifest.json", manifest);
const pkg = read("package.json");
pkg.version = next;
write("package.json", pkg);
const versions = read("versions.json");
versions[next] = manifest.minAppVersion;
write("versions.json", versions);
console.log(`Bumped to ${next}. Commit and push to main to publish the release.`);
