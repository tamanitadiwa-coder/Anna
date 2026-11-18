import test from 'node:test';
import assert from 'node:assert/strict';
import { route, acceptPhrase, phraseMessages, researchReply } from '../router.js';
import { PHRASES } from './e2e/phrases.mjs';

test('every route: 3 phrases each go to the right tool', () => {
  for (const [want, ps] of Object.entries(PHRASES)) for (const p of ps) assert.equal(route(p), want, p);
});
test('Qwen wording is kept only when every number survives', () => {
  const f = 'It’s 14:05 in London (Wednesday), 2 hours behind you.';
  assert.equal(acceptPhrase(f, 'Jamal, it’s 14:05 in London right now (Wednesday), 2 hours behind you.'), 'Jamal, it’s 14:05 in London right now (Wednesday), 2 hours behind you.');
  assert.equal(acceptPhrase(f, 'It’s about 2pm in London.'), null, 'a changed time is rejected');
  assert.equal(acceptPhrase('R 5 500,00 left this month.', 'You have R5 500,00 left this month, Jamal.'), 'You have R5 500,00 left this month, Jamal.', 'spaces in amounts are fine');
  assert.equal(acceptPhrase('R 5 500,00 left.', 'You have R5 000 left.'), null);
  assert.equal(acceptPhrase(f, 'As an AI, I think it is 14:05 in London, 2 hours behind.'), null);
  const list = 'Pay in this order:\n1. Rent: R 5 000,00\n2. Gym: R 400,00';
  assert.equal(acceptPhrase(list, 'Here’s the order I’d pay things in, Jamal.'), 'Here’s the order I’d pay things in, Jamal.\n' + list, 'lists: warm intro + exact list');
  assert.equal(acceptPhrase(list, 'Pay rent first, R5000.'), null, 'an intro with numbers is rejected');
  assert.match(phraseMessages('sys', 'q', f)[1].content, /Copy every number/);
});
test('research is honest: offline, or no approved service, never a fake search', () => {
  assert.match(researchReply('news', { online: false }), /needs internet.*offline.*won’t guess/);
  assert.match(researchReply('news', { online: true }), /isn’t switched on yet.*approve/);
});
