import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#10b981"/>
      <stop offset="1" stop-color="#047857"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="116" fill="#09090b"/>
  <rect x="48" y="48" width="416" height="416" rx="92" fill="url(#g)"/>
  <path d="M196 160 L196 352 L384 256 Z" fill="#022c22"/>
  <rect x="112" y="112" width="288" height="26" rx="13" fill="#064e3b" opacity="0.35"/>
  <rect x="112" y="374" width="288" height="26" rx="13" fill="#064e3b" opacity="0.35"/>
</svg>`;

const outDir = path.join(process.cwd(), "electron", "build");
fs.mkdirSync(outDir, { recursive: true });
await sharp(Buffer.from(svg)).png().toFile(path.join(outDir, "icon.png"));
console.log("icon written:", path.join(outDir, "icon.png"));
