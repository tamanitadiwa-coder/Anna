// ANNA's online helper (v1.4): when ANNA has data and doesn't understand a message, she asks a free online AI
// (Groq, OpenAI-compatible) what it means, turns it into a phrase her own tools understand, and keeps any new
// words so she understands them offline next time.
// Privacy: ONLY the words of that one message are sent. Never balances, bills, names from memory, or chat history.
// The API key lives in this browser only (localStorage), never in backups.

const KEY = 'anna.online';
export const DEFAULT_MODEL = 'openai/gpt-oss-20b';
export const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
export const config = () => ({ on: false, key: '', model: DEFAULT_MODEL, ...read() });
export function setConfig(patch) { const c = { ...config(), ...patch }; try { localStorage.setItem(KEY, JSON.stringify(c)); } catch {} return c; }
export const ready = () => { const c = config(); return !!(c.on && c.key && (typeof navigator === 'undefined' || navigator.onLine !== false)); };

// The phrasings ANNA's own parsers understand. The online AI rewrites messages into one of these.
export const PHRASES = [
  'I have R4000 right now', 'I get paid R10500 on the 26th', 'payday is the 26th',
  'R500 for rent on the 25th', 'I owe Sipho R500 on the 25th', 'Sipho owes me R300 on the 30th',
  'R5000 coming on 10 January from a client', 'spent R50 on food', 'got R200 from a tip',
  'Netflix R99 every month', 'remove the last added R5000', 'delete the Netflix bill',
  'move all due dates to the 26th', 'I want to buy a phone for R3000',
  'remind me to call mom at 5pm tomorrow', 'what time is it', 'how much can I spend today',
];

export function prompt(text, misread) {
  return [
    { role: 'system', content: `You help ANNA, a personal assistant app in South Africa (money in Rand), understand her owner. He writes casually, with typos and slang (English, South African and Zimbabwean words).
Reply with ONLY a JSON object, no other text:
{"command": string or null, "words": [{"word": string, "means": string}], "answer": string}
- "command": if the message asks ANNA to DO something, rewrite it as ONE short sentence in the style of these examples, keeping every amount, date and name exactly: ${PHRASES.map((p) => `"${p}"`).join(', ')}. Otherwise null.
- "words": only slang, misspelt or unusual words from the message, each with its plain English meaning (e.g. {"word":"cgange","means":"change"}). Empty if none. Never include normal English words.
- "answer": if command is null, a short, kind, plain answer (max 3 sentences). If you can't know (it's about his own life), say so briefly. If command is set, a few words saying what you understood.` },
    { role: 'user', content: misread ? `ANNA misunderstood this message as: ${misread}. What did he really mean?\nMessage: ${text}` : `Message: ${text}` },
  ];
}

export function parseReply(raw) {
  const s = String(raw || ''), j = s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1);
  let o; try { o = JSON.parse(j); } catch { return { command: null, words: [], answer: s.trim().slice(0, 600) }; }
  const words = (Array.isArray(o.words) ? o.words : []).filter((w) => w && typeof w.word === 'string' && typeof w.means === 'string' && w.word.trim().length >= 2 && w.word.trim().toLowerCase() !== w.means.trim().toLowerCase())
    .map((w) => ({ word: w.word.trim().toLowerCase().slice(0, 40), means: w.means.trim().slice(0, 80) })).slice(0, 8);
  return { command: typeof o.command === 'string' && o.command.trim() ? o.command.trim().slice(0, 300) : null, words, answer: typeof o.answer === 'string' ? o.answer.trim().slice(0, 600) : '' };
}

export async function interpret(text, { misread = '', fetchFn = fetch, timeoutMs = 15000 } = {}) {
  const c = config(); if (!c.key) throw new Error('No online key set.');
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, t = ctl && setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetchFn(ENDPOINT, { method: 'POST', signal: ctl?.signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c.key}` },
      body: JSON.stringify({ model: c.model || DEFAULT_MODEL, messages: prompt(text, misread), temperature: 0.2, max_tokens: 400 }) });
    if (r.status === 401) throw new Error('The online key was not accepted. Check it in Settings → Online helper.');
    if (r.status === 429) throw new Error('The free online limit is used up for now. ANNA will use her own brain.');
    if (!r.ok) throw new Error(`Online helper error ${r.status}.`);
    const d = await r.json(); return parseReply(d?.choices?.[0]?.message?.content);
  } finally { if (t) clearTimeout(t); }
}

// Learned words: applied to every message before ANNA's own tools read it, so she understands them offline.
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function applyWords(text, words = []) {
  let out = String(text || '');
  for (const w of words) if (w?.word && w.word.length >= 2) out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}])${reEsc(w.word)}(?![\\p{L}\\p{N}])`, 'giu'), w.means);
  return out;
}
export function mergeWords(have = [], add = [], now = Date.now()) {
  const m = new Map(have.map((w) => [w.word, w])); for (const w of add) m.set(w.word, { ...w, at: now }); return [...m.values()].slice(-300);
}
