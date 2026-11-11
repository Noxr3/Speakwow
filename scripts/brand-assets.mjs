// One vector outline drives every Speakwow mark and platform export.
// Run from any directory with `pnpm brand:generate` after editing assets/brand/symbol.svg.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "apps/web/public/brand");
const appDir = join(root, "apps/web/app");
await mkdir(publicDir, { recursive: true });
const master = await readFile(join(root, "assets/brand/symbol.svg"), "utf8");
const path = master.match(/<path\s[^>]*d="([^"]+)"/)?.[1];
if (!path) throw new Error("The brand master must contain its vector outline.");

const mark = (fill) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="8 8 84 84"><title>Speakwow</title><path d="${path}" fill="${fill}" fill-rule="evenodd"/></svg>\n`;
const icon = ({ rounded = false, maskable = false, small = false } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 100 100">
<title>Speakwow</title>
<defs>
  <linearGradient id="green" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#00D79A"/><stop offset="1" stop-color="#00B98A"/></linearGradient>
  <radialGradient id="teal" cx="0.28" cy="0.58" r="0.72"><stop stop-color="#167EAD"/><stop offset="0.52" stop-color="#118FAA" stop-opacity=".9"/><stop offset="1" stop-color="#00C992" stop-opacity="0"/></radialGradient>
  <clipPath id="tile"><rect width="100" height="100" rx="${rounded ? 22 : 0}"/></clipPath>
</defs>
<g clip-path="url(#tile)">
  <path fill="${small ? "#087C61" : "url(#green)"}" d="M0 0h100v100H0z"/>
  ${small ? "" : '<path fill="url(#teal)" d="M0 0h100v100H0z"/>'}
  <path d="${path}" fill="#fff" fill-rule="evenodd"${maskable ? ' transform="translate(7 7) scale(.86)"' : ""}/>
</g>
</svg>\n`.replace(/[ \t]+\n/g, "\n");
const files = {
  "mark-white.svg": mark("#FFFFFF"),
  "mark-ink.svg": mark("#153C35"),
  "icon.svg": icon(),
  "logo.svg": icon({ rounded: true }),
};
for (const [name, svg] of Object.entries(files))
  await writeFile(join(publicDir, name), svg);
await writeFile(join(appDir, "icon.svg"), icon({ rounded: true, small: true }));
for (const size of [192, 512, 1024]) {
  await sharp(Buffer.from(icon()))
    .resize(size)
    .png()
    .toFile(join(publicDir, `icon-${size}.png`));
}
await sharp(Buffer.from(icon({ maskable: true })))
  .resize(512)
  .png()
  .toFile(join(publicDir, "icon-maskable-512.png"));
// Apple applies its own mask; the 180px source is square and fully opaque.
await sharp(Buffer.from(icon()))
  .resize(180)
  .png()
  .toFile(join(appDir, "apple-icon.png"));

// PNG-backed ICO frames: sharp keeps the vector edges antialiased at each actual size.
const sizes = [16, 32, 48];
const frames = await Promise.all(
  sizes.map((size) =>
    sharp(Buffer.from(icon({ rounded: true, small: true })))
      .resize(size)
      .png()
      .toBuffer(),
  ),
);
const header = Buffer.alloc(6 + 16 * frames.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(frames.length, 4);
let offset = header.length;
frames.forEach((frame, i) => {
  const at = 6 + i * 16;
  header[at] = sizes[i];
  header[at + 1] = sizes[i];
  header.writeUInt16LE(1, at + 4);
  header.writeUInt16LE(32, at + 6);
  header.writeUInt32LE(frame.length, at + 8);
  header.writeUInt32LE(offset, at + 12);
  offset += frame.length;
});
await writeFile(
  join(appDir, "favicon.ico"),
  Buffer.concat([header, ...frames]),
);
console.log(
  "Generated vector marks, app icons, Apple touch icon, and 16/32/48px favicon.",
);
