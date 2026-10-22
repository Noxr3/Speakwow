import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pickPersonaId } from './client-prefs.ts';

const KNOWN = ['frank', 'lily', 'grace', 'leo'];
const RETIRED = { lucy: 'grace', kai: 'frank', max: 'leo' };

test('a saved teacher comes back, a retired one as their heir', () => {
  assert.equal(pickPersonaId('lily', KNOWN, 'frank', RETIRED), 'lily');
  // saved before persona ids, as a display name
  assert.equal(pickPersonaId('Grace', KNOWN, 'frank', RETIRED), 'grace');
  assert.equal(pickPersonaId('lucy', KNOWN, 'frank', RETIRED), 'grace');
  assert.equal(pickPersonaId('Lucy', KNOWN, 'frank', RETIRED), 'grace');
  assert.equal(pickPersonaId('max', KNOWN, 'frank', RETIRED), 'leo');
  assert.equal(pickPersonaId('nobody', KNOWN, 'frank', RETIRED), 'frank');
  assert.equal(pickPersonaId(null, KNOWN, 'frank', RETIRED), 'frank');
});
