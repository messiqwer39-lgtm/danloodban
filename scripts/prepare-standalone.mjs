import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const standaloneDir = path.join(root, ".next", "standalone");

const pairs = [
  [path.join(root, ".next", "static"), path.join(standaloneDir, ".next", "static")],
  [path.join(root, "public"), path.join(standaloneDir, "public")],
];

for (const [from, to] of pairs) {
  if (!fs.existsSync(from)) {
    console.warn("skip missing:", from);
    continue;
  }
  fs.cpSync(from, to, { recursive: true });
  console.log("copied:", from, "->", to);
}
