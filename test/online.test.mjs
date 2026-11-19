import test from 'node:test'; import assert from 'node:assert/strict';
const store = {}; globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
const OL = await import('../online.js');
test('online helper: sends only the one message, parses JSON, learns words', async () => {
  OL.setConfig({ key: 'gsk_test', on: true }); let sent;
  const fetchFn = async (url, o) => { sent = { url, o: JSON.parse(o.body), auth: o.headers.Authorization }; return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'Sure: {"command":"move all due dates to the 26th","words":[{"word":"cgange","means":"change"},{"word":"the","means":"the"}],"answer":"Moving your bills."}' } }] }) }; };
  const r = await OL.interpret('cgange all due dates after pay on the 26th', { fetchFn });
  assert.equal(sent.url, OL.ENDPOINT); assert.equal(sent.auth, 'Bearer gsk_test'); assert.equal(sent.o.model, OL.DEFAULT_MODEL);
  assert.equal(sent.o.messages.length, 2); assert.match(sent.o.messages[1].content, /^Message: cgange all due dates after pay on the 26th$/);
  assert.deepEqual(r, { command: 'move all due dates to the 26th', words: [{ word: 'cgange', means: 'change' }], answer: 'Moving your bills.' });
  assert.equal(OL.applyWords('Cgange my bills, not cgangeX', r.words), 'change my bills, not cgangeX');
  assert.deepEqual(OL.mergeWords([{ word: 'a1', means: 'x' }], [{ word: 'a1', means: 'y' }], 5), [{ word: 'a1', means: 'y', at: 5 }]);
});
test('online helper: errors are friendly; plain text answers still work', async () => {
  await assert.rejects(OL.interpret('hi', { fetchFn: async () => ({ ok: false, status: 429 }) }), /limit/);
  await assert.rejects(OL.interpret('hi', { fetchFn: async () => ({ ok: false, status: 401 }) }), /key/);
  assert.deepEqual(OL.parseReply('Hello there'), { command: null, words: [], answer: 'Hello there' });
  OL.setConfig({ on: false }); assert.equal(OL.ready(), false);
});
