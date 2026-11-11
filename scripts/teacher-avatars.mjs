import { readFile, mkdir, writeFile, readdir } from 'node:fs/promises';
import { Avatar, Style } from '@dicebear/core';
import definition from '@dicebear/styles/dylan.json' with { type: 'json' };

const root = new URL('../', import.meta.url);
const designs = JSON.parse(await readFile(new URL('assets/teachers/dylan.json', root), 'utf8'));
const personaFiles = (await readdir(new URL('packages/shared/personas/', root))).filter((f) => f.endsWith('.json'));
const ids = personaFiles.map((f) => f.replace(/\.json$/, '')).sort();
if (JSON.stringify(ids) !== JSON.stringify(Object.keys(designs).sort())) throw new Error('Every teacher needs exactly one avatar design');
const style = new Style(definition);
// Bump the directory version when changing a design; these assets are cached immutably.
const out = new URL('apps/web/public/teachers/dylan-v1/', root);
await mkdir(out, { recursive: true });
for (const id of ids) {
  const options = designs[id];
  for (const [key, value] of Object.entries(options)) {
    if (key.endsWith('Variant') && !definition.components[key.slice(0, -7)]?.variants[value]) throw new Error(`Unknown ${id} option ${key}: ${value}`);
  }
  const svg = new Avatar(style, { seed: `Speakwow-${id}`, idRandomization: false, size: 160, facialHairProbability: 0, ...options }).toString();
  await writeFile(new URL(`${id}.svg`, out), svg);
}
console.log(`Generated ${ids.length} local Dylan avatars (DiceBear 10.6.0).`);
