import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clientIp, underLimit } from './rate-limit.ts';

const env = { KV_REST_API_URL: 'https://kv.example/', KV_REST_API_TOKEN: 't' } as NodeJS.ProcessEnv;

function kvReturning(count: number, calls: { url: string; body: unknown }[] = []) {
  return (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify([{ result: count }, { result: 1 }]));
  }) as typeof fetch;
}

test('counts in KV and refuses past the limit', async () => {
  const calls: { url: string; body: unknown }[] = [];
  assert.equal(await underLimit('code:u1', 5, 3600, env, kvReturning(5, calls)), true);
  assert.equal(await underLimit('code:u1', 5, 3600, env, kvReturning(6)), false);
  assert.equal(calls[0].url, 'https://kv.example/pipeline');
  assert.deepEqual(calls[0].body, [
    ['INCR', 'code:u1'],
    ['EXPIRE', 'code:u1', '3600', 'NX'],
  ]);
});

test('allows without KV or when KV fails', async () => {
  assert.equal(await underLimit('k', 1, 60, {} as NodeJS.ProcessEnv), true);
  const broken = (async () => {
    throw new Error('down');
  }) as typeof fetch;
  assert.equal(await underLimit('k', 1, 60, env, broken), true);
});

test('reads the client address Vercel reports', () => {
  assert.equal(clientIp(new Headers({ 'x-real-ip': '1.2.3.4' })), '1.2.3.4');
  assert.equal(clientIp(new Headers({ 'x-forwarded-for': '5.6.7.8, 10.0.0.1' })), '5.6.7.8');
  assert.equal(clientIp(new Headers()), 'unknown');
});
