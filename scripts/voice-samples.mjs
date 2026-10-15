#!/usr/bin/env node
// Generates each teacher's voice sample, played when the picker ring settles
// on them: apps/web/public/voices/<id>.mp3, from the card's `sample_line`.
//
//   XAI_API_KEY=... pnpm voices:generate               # the same Grok voice as the call
//   OPENAI_API_KEY=... pnpm voices:generate --provider openai
//   pnpm voices:generate --only frank --force          # one teacher, overwrite
//
// Existing files are kept unless --force. Commit the results: they are small
// and every visitor hears them without spending anyone's key.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const provider = flag('--provider') ?? 'xai';
const only = flag('--only');
const force = args.includes('--force');

export function speechRequest(card, provider) {
  if (provider === 'openai') {
    return {
      url: 'https://api.openai.com/v1/audio/speech',
      key: process.env.OPENAI_API_KEY,
      body: {
        model: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
        voice: card.voices?.openai ?? 'marin',
        input: card.sample_line,
        instructions: `You are ${card.display_name}, an English teacher. Accent: ${card.accent}. Voice: ${card.voice_note || 'warm and friendly'}. Sound natural and glad to meet the listener.`,
        response_format: 'mp3',
      },
    };
  }
  return {
    url: 'https://api.x.ai/v1/tts',
    key: process.env.XAI_API_KEY,
    body: {
      text: card.sample_line,
      language: 'en',
      voice_id: (card.voices?.xai ?? card.voice ?? 'eve').toLowerCase(),
      output_format: { codec: 'mp3', sample_rate: 24000, bit_rate: 64000 },
    },
  };
}

async function main() {
  const dir = join(root, 'packages', 'shared', 'personas');
  const out = join(root, 'apps', 'web', 'public', 'voices');
  mkdirSync(out, { recursive: true });
  const cards = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))
    .filter((c) => c.sample_line && (!only || c.id === only));

  let failed = 0;
  for (const card of cards) {
    const file = join(out, `${card.id}.mp3`);
    if (existsSync(file) && !force) {
      console.log(`skip  ${card.id} (exists; --force to redo)`);
      continue;
    }
    const { url, key, body } = speechRequest(card, provider);
    if (!key) throw new Error(`${provider === 'openai' ? 'OPENAI_API_KEY' : 'XAI_API_KEY'} is not set`);
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      failed++;
      console.error(`fail  ${card.id}: ${res.status} ${(await res.text()).slice(0, 200)}`);
      continue;
    }
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    console.log(`wrote ${card.id}.mp3 (${provider}, ${body.voice ?? body.voice_id})`);
  }
  if (failed) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
