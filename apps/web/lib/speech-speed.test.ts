import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadSpeechPreferences, saveSpeechPreferences } from './client-prefs.ts';
import { newerSpeechState, normalizeSpeechPreferences, parseSpeechState } from './speech-speed.ts';

test('untrusted speech settings fall back safely without coercion', () => {
  for (const value of [
    null,
    [],
    { speed: true },
    { speed: '0.8' },
    { speed: NaN },
    { speed: 2, adaptive: 'false' },
  ]) {
    assert.deepEqual(normalizeSpeechPreferences(value), { speed: 1, adaptive: true });
  }
  assert.deepEqual(normalizeSpeechPreferences({ speed: 0.85, adaptive: false }), {
    speed: 0.85,
    adaptive: false,
  });
});

test('teacher state is validated and a late RPC cannot undo a newer acknowledgement', () => {
  const state = {
    speed: 0.85,
    adaptive: true,
    appliedSpeed: 0.85,
    pending: false,
    supported: true,
    source: 'teacher',
    revision: 3,
    error: null,
  };
  const parsed = parseSpeechState(JSON.stringify(state));
  assert.ok(parsed);
  assert.equal(newerSpeechState(parsed, { ...parsed, speed: 1, revision: 2 }), parsed);
  for (const patch of [
    { speed: 0 },
    { appliedSpeed: '1' },
    { revision: -1 },
    { adaptive: 'true' },
    { source: 'other' },
  ]) {
    assert.equal(parseSpeechState(JSON.stringify({ ...state, ...patch })), null);
  }
  assert.equal(parseSpeechState('invalid'), null);
});

test('speech preference survives reload and works when storage is blocked', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const storage = new Map<string, string>();
  try {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => storage.set(key, value),
        },
      },
    });
    saveSpeechPreferences({ speed: 0.75, adaptive: false });
    assert.deepEqual(loadSpeechPreferences(), { speed: 0.75, adaptive: false });
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });
    assert.doesNotThrow(() => saveSpeechPreferences({ speed: 1, adaptive: true }));
    assert.deepEqual(loadSpeechPreferences(), { speed: 1, adaptive: true });
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
