import test from 'node:test'; import assert from 'node:assert/strict';
process.env.TZ = 'Africa/Johannesburg';
const T = await import('../time.js');
const NOW = new Date(2026, 10, 18, 10, 0).getTime(); // Wednesday 18 Nov 2026, 10:00 SAST
const W = (s, now = NOW) => { const r = T.parseWhen(s, now); return r && `${T.iso(r.ts)} ${T.hhmm(r.ts)}${r.repeat !== 'none' ? ' ' + r.repeat : ''}`; };
test('relative days and times', () => {
  assert.equal(W('today at 3pm'), '2026-11-18 15:00'); assert.equal(W('tomorrow'), '2026-11-19 09:00'); assert.equal(W('tomorrow at 15:30'), '2026-11-19 15:30');
  assert.equal(W('day after tomorrow at 8am'), '2026-11-20 08:00'); assert.equal(W('tonight'), '2026-11-18 20:00'); assert.equal(W('at 9am'), '2026-11-19 09:00', 'time already passed today → tomorrow');
  assert.equal(W('at 3'), '2026-11-18 15:00', '"at 3" means 3 pm'); assert.equal(W('at noon'), '2026-11-18 12:00'); assert.equal(W('tomorrow morning'), '2026-11-19 09:00'); assert.equal(W('tomorrow evening'), '2026-11-19 18:00');
  assert.equal(W('in 20 minutes'), '2026-11-18 10:20'); assert.equal(W('in 2 hours'), '2026-11-18 12:00'); assert.equal(W('in 3 days'), '2026-11-21 09:00'); assert.equal(W('in 2 weeks'), '2026-12-02 09:00'); assert.equal(W('in an hour'), '2026-11-18 11:00'); });
test('weekdays, next week, next month', () => {
  assert.equal(W('next friday'), '2026-11-20 09:00'); assert.equal(W('friday at 5pm'), '2026-11-20 17:00'); assert.equal(W('next wednesday'), '2026-11-25 09:00', 'today is Wednesday → next week');
  assert.equal(W('this wednesday at 6pm'), '2026-11-18 18:00'); assert.equal(W('on monday'), '2026-11-23 09:00'); assert.equal(W('next week'), '2026-11-23 09:00', 'Monday of next week');
  assert.equal(W('next month'), '2026-12-01 09:00'); assert.equal(W('this weekend'), '2026-11-21 09:00'); });
test('explicit dates (SA day/month order) and year roll-over', () => {
  assert.equal(W('on 5 March'), '2027-03-05 09:00', 'past month this year → next year'); assert.equal(W('25 December at 10:00'), '2026-12-25 10:00'); assert.equal(W('December 1st'), '2026-12-01 09:00');
  assert.equal(W('3/12'), '2026-12-03 09:00'); assert.equal(W('2027-01-15 14:45'), '2027-01-15 14:45'); assert.equal(W('the 25th'), '2026-11-25 09:00'); assert.equal(W('the 5th'), '2026-12-05 09:00');
  assert.equal(W('31 February'), null, 'impossible date rejected'); });
test('recurring', () => { assert.equal(W('every day at 7am'), '2026-11-19 07:00 daily'); assert.equal(W('every friday at 4pm'), '2026-11-20 16:00 weekly'); assert.equal(W('every month on the 25th'), '2026-11-25 09:00 monthly'); });
test('no date/time phrase → null; amounts are not times', () => { assert.equal(T.parseWhen('call mom', NOW), null); const r = T.parseWhen('pay R12.50 for parking tomorrow', NOW); assert.equal(`${T.iso(r.ts)} ${T.hhmm(r.ts)}`, '2026-11-19 09:00'); });
test('reminders: title, exact time, repeat', () => {
  const r = T.parseReminder('Remind me to call Mom tomorrow at 3pm', NOW); assert.equal(r.title, 'Call Mom'); assert.equal(`${T.iso(r.ts)} ${T.hhmm(r.ts)}`, '2026-11-19 15:00'); assert.equal(r.hasTime, true);
  const r2 = T.parseReminder('remind me next friday to pay the rent', NOW); assert.equal(r2.title, 'Pay the rent'); assert.equal(T.iso(r2.ts), '2026-11-20'); assert.equal(r2.hasTime, false);
  const r3 = T.parseReminder('Set a reminder to water the plants every day at 7am', NOW); assert.equal(r3.title, 'Water the plants'); assert.equal(r3.repeat, 'daily'); assert.equal(T.hhmm(r3.ts), '07:00');
  const r4 = T.parseReminder('remind me in 20 minutes to check the oven', NOW); assert.equal(r4.title, 'Check the oven'); assert.equal(T.hhmm(r4.ts), '10:20');
  const r5 = T.parseReminder('remind me to buy bread', NOW); assert.equal(r5.title, 'Buy bread'); assert.equal(r5.ts, null, 'no time given → ANNA must ask');
  assert.equal(T.parseReminder('what time is it?', NOW), null); });
test('daylight saving: local calendar maths follows the device zone', () => {
  process.env.TZ = 'Europe/London'; const now = new Date(2026, 2, 28, 10, 0).getTime(); // Sat 28 Mar 2026; clocks go forward on Sun 29 Mar
  const r = T.parseWhen('tomorrow at 9am', now); assert.equal(new Date(r.ts).toISOString(), '2026-03-29T08:00:00.000Z', '09:00 BST = 08:00 UTC');
  assert.equal(T.hhmm(T.parseWhen('in 24 hours', now).ts), '11:00', '24 real hours across the change lands at 11:00 local'); process.env.TZ = 'Africa/Johannesburg'; });
test('world clock uses IANA zones with DST', () => {
  const winter = Date.UTC(2026, 0, 15, 10, 0), summer = Date.UTC(2026, 6, 15, 10, 0);
  assert.equal(T.zoneFor('London'), 'Europe/London'); assert.equal(T.zoneFor('cape town'), 'Africa/Johannesburg'); assert.equal(T.zoneFor('Asia/Tokyo'), 'Asia/Tokyo'); assert.equal(T.zoneFor('Atlantis'), null);
  assert.equal(T.timeIn('Europe/London', winter).time, '10:00'); assert.equal(T.timeIn('Europe/London', summer).time, '11:00'); assert.equal(T.timeIn('America/New_York', summer).time, '06:00');
  assert.equal(T.timeIn('Europe/London', winter).diffMin, -120); assert.equal(T.timeIn('Europe/London', summer).diffMin, -60);
  assert.match(T.answerTime('What time is it in London?', winter), /^It’s 10:00 in London .* 2 hours behind you\.$/); assert.match(T.answerTime('what time is it in tokyo', winter), /19:00 .*7 hours ahead/);
  assert.match(T.answerTime('What time is it?', NOW), /^It’s 10:00 \(Wednesday, 18 November 2026, Africa\/Johannesburg\)\.$/); assert.match(T.answerTime('time in Atlantis', NOW), /don’t know the time zone/); });
test('South African public holidays (Easter + Sunday→Monday rule)', () => {
  const h26 = T.saHolidays(2026).map((h) => `${h.date} ${h.name}`);
  for (const x of ['2026-04-03 Good Friday', '2026-04-06 Family Day', '2026-03-21 Human Rights Day', '2026-08-10 Public holiday (National Women’s Day observed)', '2026-12-16 Day of Reconciliation']) assert.ok(h26.includes(x), x);
  assert.equal(T.easter(2027).m, 2); assert.equal(T.easter(2027).d, 28);
  assert.deepEqual(T.nextHolidays(NOW, 3).map((h) => h.date), ['2026-12-16', '2026-12-25', '2026-12-26']);
  assert.match(T.answerTime('Is 16 December a public holiday?', NOW), /^Yes, .*Day of Reconciliation/); assert.match(T.answerTime('is tomorrow a public holiday', NOW), /^No/);
  assert.match(T.answerTime('When is the next public holiday?', NOW), /Day of Reconciliation, Wednesday, 16 December 2026/); });
test('date questions', () => { assert.equal(T.answerTime('What day is next Friday?', NOW), 'Next Friday is Friday, 20 November 2026.'); assert.equal(T.answerTime("what's the date today?", NOW), 'Today is Wednesday, 18 November 2026.'); assert.equal(T.answerTime('tell me a joke', NOW), ''); });
test('iPhone Reminders shortcut URL', () => {
  const u = T.shortcutURL({ title: 'Pay rent & water', at: new Date(2026, 10, 20, 15, 30).getTime(), notes: 'Flat 2' });
  assert.ok(u.startsWith('shortcuts://run-shortcut?name=ANNA%20Reminder&input=text&text='));
  const p = JSON.parse(decodeURIComponent(u.split('&text=')[1])); assert.deepEqual(p, { title: 'Pay rent & water', date: '2026-11-20', time: '15:30', due: '2026-11-20 15:30', notes: 'Flat 2' });
  assert.ok(!/[ &?#]/.test(u.split('&text=')[1]), 'payload fully URL-encoded'); });
