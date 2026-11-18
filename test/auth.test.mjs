import test from 'node:test'; import assert from 'node:assert/strict';
import * as A from '../auth.js';
test('owner identity is fixed', () => { assert.equal(A.OWNER.name, 'Jamal Tamani'); assert.throws(() => { 'use strict'; A.OWNER.name = 'x'; }); });
test('password hash: never stores the password, verifies correctly', async () => {
  const a = await A.createAuth('correct horse 42'); assert.equal(a.owner, 'Jamal Tamani'); assert.ok(a.iter >= 310000); assert.ok(!JSON.stringify(a).includes('correct horse'));
  assert.equal(await A.verifyPassword(a, 'correct horse 42'), true); assert.equal(await A.verifyPassword(a, 'correct horse 43'), false); assert.equal(await A.verifyPassword(null, 'x'), false);
  const b = await A.createAuth('correct horse 42'); assert.notEqual(a.salt, b.salt); assert.notEqual(a.hash, b.hash); });
test('weak passwords are refused', async () => { for (const p of ['', 'short', 'aaaaaaaaaa', '12345678abc', 'Password1']) assert.ok(A.passwordProblem(p), p); assert.equal(A.passwordProblem('Lindiwe-3March!'), ''); await assert.rejects(A.createAuth('short')); });
test('encrypted backup round-trip; wrong password and tampering rejected', async () => {
  const auth = await A.createAuth('my secret pass'), key = await A.backupKey(auth, 'my secret pass'), state = { app: 'anna-web', mem: [{ content: 'VAT number in the blue folder' }] };
  const env = await A.encryptBackup(state, auth, key); assert.equal(env.encrypted, 1); assert.equal(env.owner, 'Jamal Tamani'); assert.ok(!JSON.stringify(env).includes('blue folder'));
  assert.deepEqual(JSON.parse(await A.decryptBackup(env, 'my secret pass')), state);
  await assert.rejects(A.decryptBackup(env, 'wrong pass 123'), /Wrong password/);
  const bad = { ...env, ct: env.ct.slice(0, -4) + (env.ct.at(-4) === 'A' ? 'B' : 'A') + env.ct.slice(-3) }; await assert.rejects(A.decryptBackup(bad, 'my secret pass'), /damaged/); });
test('lockout grows after repeated failures', () => { assert.equal(A.lockoutMs(4), 0); assert.equal(A.lockoutMs(5), 30000); assert.equal(A.lockoutMs(6), 60000); assert.equal(A.lockoutMs(40), 3600000); });
