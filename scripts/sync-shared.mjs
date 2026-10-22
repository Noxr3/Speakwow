// Vendors packages/shared's data into apps/agent/shared/.
// The agent's Docker build context is apps/agent, so it cannot reach
// packages/shared at build time. apps/agent/tests/test_shared_data.py fails
// when the copy drifts; run `pnpm shared:sync` after editing a persona card
// the sticker list or the retired teachers.
import { cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'packages', 'shared');
const to = join(root, 'apps', 'agent', 'shared');

rmSync(to, { recursive: true, force: true });
mkdirSync(join(to, 'personas'), { recursive: true });
for (const file of readdirSync(join(from, 'personas')).filter((f) => f.endsWith('.json'))) {
  cpSync(join(from, 'personas', file), join(to, 'personas', file));
}
cpSync(join(from, 'stickers.json'), join(to, 'stickers.json'));
cpSync(join(from, 'retired-personas.json'), join(to, 'retired-personas.json'));
console.log(`synced packages/shared -> apps/agent/shared`);
