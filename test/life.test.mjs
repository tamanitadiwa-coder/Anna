import test from 'node:test'; import assert from 'node:assert/strict';
import * as LF from '../life.js'; import { buildContext, systemPrompt } from '../ai.js'; import * as L from '../logic.js';
const T = new Date(2026, 10, 18, 12).getTime(), D = 864e5;
test('journal search by words, date and tag; newest first', () => {
  const j = [{ id: 'a', date: '2026-11-10', text: 'Argued with Sipho about money', tags: ['relationship', 'challenge'] }, { id: 'b', date: '2026-11-17', title: 'Promotion', text: 'Got the promotion!', tags: ['achievement'] }, { id: 'c', date: '2026-11-12', text: 'Quiet day' }];
  assert.deepEqual(LF.searchJournal(j).map((e) => e.id), ['b', 'c', 'a']); assert.deepEqual(LF.searchJournal(j, 'sipho').map((e) => e.id), ['a']);
  assert.deepEqual(LF.searchJournal(j, '', 'achievement').map((e) => e.id), ['b']); assert.deepEqual(LF.searchJournal(j, '2026-11-12').map((e) => e.id), ['c']); assert.equal(LF.searchJournal(j, 'zzz').length, 0); });
test('relevant(): only 3–5 related items, never whole histories', () => {
  const mem = Array.from({ length: 40 }, (_, i) => ({ content: `Unrelated fact number ${i}`, created_at: i })); mem.push({ content: 'My running club meets on Saturdays', created_at: 1 }, { content: 'Guess', status: 'assumption', created_at: 99 });
  const goals = [{ id: 'g', title: 'Run 3 times a week', horizon: 'weekly', created_at: 5 }, { id: 'h', title: 'Save R5000', horizon: 'monthly', done: true }];
  const r = LF.relevant(mem, goals, 'How is my running going?'); assert.ok(r.length >= 1 && r.length <= 5); assert.ok(r.some((x) => /running club/.test(x.text))); assert.ok(r.some((x) => x.kind === 'goal' && /Run 3/.test(x.text)));
  assert.ok(!r.some((x) => /Guess|Save R5000/.test(x.text)), 'no assumptions or finished goals'); assert.ok(LF.relevant(mem, goals, 'hello').length <= 3); });
test('goal progress, habit streak and weekly review use real records only', () => {
  const g = { id: 'g', title: 'Run', horizon: 'weekly', target: 3, unit: 'runs' }, h = { id: 'h', title: 'Read', horizon: 'habit' };
  const prog = [{ goal: 'g', value: 1, at: T - D }, { goal: 'g', value: 1, at: T }, { goal: 'g', value: 1, at: T - 8 * D }, { goal: 'h', value: 1, at: T }, { goal: 'h', value: 1, at: T - D }, { goal: 'h', value: 1, at: T - 2 * D }, { goal: 'h', value: 1, at: T - 4 * D }];
  const p = LF.goalProgress(g, prog, T); assert.equal(p.total, 2); assert.equal(p.pct, 67); assert.equal(p.done, false);
  assert.equal(LF.streak('h', prog, T), 3); assert.equal(LF.streak('x', prog, T), 0);
  const life = { ...LF.emptyLife(), goals: [g, h], progress: prog, journal: [{ id: 'j', created_at: T, mood: 4, tags: ['achievement'] }] };
  const rv = LF.weeklyReview(life, T); assert.equal(rv.goals.find((x) => x.id === 'g').thisWeek, 2); assert.equal(rv.wins, 1); assert.equal(rv.avgMood, 4); assert.ok(rv.lines.some((l) => /Run: 2 logged this week/.test(l)));
  const none = LF.weeklyReview(LF.emptyLife(), T); assert.match(none.lines[0], /Nothing logged yet/); });
test('remember offers: personal statements and explicit requests only; questions never', () => {
  assert.equal(LF.rememberCandidate('Remember that my sister Lindiwe is a nurse'), 'My sister Lindiwe is a nurse');
  assert.ok(LF.rememberCandidate('I prefer working in the mornings')); assert.ok(LF.rememberCandidate('My business is a bakery in Soweto'));
  assert.equal(LF.rememberCandidate('What is 15% of 200?'), ''); assert.equal(LF.rememberCandidate('ok'), ''); assert.equal(LF.rememberCandidate('The weather is nice'), ''); });
test('support style is detected from what the user says', () => {
  assert.equal(LF.styleFromText('Please just listen for a bit'), 'listen'); assert.equal(LF.styleFromText('Be honest with me'), 'honest'); assert.equal(LF.styleFromText('hold me accountable this week'), 'accountable');
  assert.equal(LF.styleFromText('give me steps'), 'steps'); assert.equal(LF.styleFromText('hi'), ''); });
test('check-in at most once a day and not after journaling today', () => {
  assert.ok(LF.checkinPrompt(null, [], T)); assert.equal(LF.checkinPrompt(T - 3600e3, [], T), ''); assert.ok(LF.checkinPrompt(T - D, [], T));
  assert.equal(LF.checkinPrompt(null, [{ created_at: T - 60e3 }], T), ''); });
test('prompt never contains journal entries; carries style, few memories and goal progress', () => {
  const S = L.emptyState(); const life = { memories: [{ content: 'Prefers tea over coffee', created_at: 1 }], goals: [{ id: 'g', title: 'Walk daily', horizon: 'daily', target: 1, created_at: 2 }], progress: [{ goal: 'g', value: 1, at: T }], journal: [{ text: 'SECRET JOURNAL LINE' }], style: 'listen' };
  const c = buildContext(S, { mem: true }, T, 'tea and my daily walk', life); assert.match(c, /Prefers tea/); assert.match(c, /Walk daily — 1 of 1/); assert.match(c, /SUPPORT STYLE .*Just listen/); assert.doesNotMatch(c, /SECRET JOURNAL/);
  assert.doesNotMatch(buildContext(S, {}, T, 'tea', life), /Prefers tea/, 'memory access switch still respected'); });
test('system prompt: listen first, no diagnosing/labelling/pressure, crisis help, independence, Jamal', () => {
  const p = systemPrompt('R'); for (const re of [/Listen first/, /what happened/, /boundaries/, /Never diagnose, never label people, never pressure/, /SADAG 0800 567 567/, /independence/, /call him Jamal/, /never say "as a language model"/, /Never invent numbers, progress or achievements/]) assert.match(p, re); });
test('backup validation of the personal record', () => {
  const v = LF.validateLife({ journal: [{ id: 'a', text: 'x' }, null, { text: 'no id' }], goals: [] }); assert.equal(v.journal.length, 1); assert.deepEqual(v.memories, []);
  assert.throws(() => LF.validateLife({ journal: 'x' }), /bad "journal"/); assert.deepEqual(LF.validateLife(undefined), LF.emptyLife()); });
