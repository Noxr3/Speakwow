import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { speechRequest } from './voice-samples.mjs';

const dir = new URL('../packages/shared/personas/', import.meta.url);
const cards = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')));

test('every teacher has a short sample line and a known motif', () => {
  const motifs = new Set(['bars', 'wave', 'rings', 'dots', 'pixels', 'radial', 'flame', 'orbit', 'strings', 'ripple']);
  for (const card of cards) {
    assert.ok(card.sample_line && card.sample_line.length <= 120, `${card.id}: sample_line`);
    assert.ok(motifs.has(card.look?.motif), `${card.id}: motif`);
    assert.equal(card.look.colors.length, 2, `${card.id}: two colours`);
  }
});

test('requests use the same voice the call uses', () => {
  const frank = cards.find((c) => c.id === 'frank');
  assert.equal(speechRequest(frank, 'xai').body.voice_id, 'rex');
  assert.equal(speechRequest(frank, 'xai').url, 'https://api.x.ai/v1/tts');
  assert.equal(speechRequest(frank, 'openai').body.voice, 'cedar');
});
