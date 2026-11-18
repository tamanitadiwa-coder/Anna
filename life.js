// ANNA — personal life record. Separate IndexedDB database "anna-life", one object store per kind of data, so the
// journal can never be mixed into memories or prompts by accident. Pure helpers below the storage part are unit-tested.
export const STORES = ['profile', 'preferences', 'goals', 'journal', 'memories', 'progress'];
export const MOODS = [[1, 'Very low'], [2, 'Low'], [3, 'Okay'], [4, 'Good'], [5, 'Great']];
export const TAGS = [['event', 'Event'], ['relationship', 'Relationship'], ['achievement', 'Achievement'], ['challenge', 'Challenge']];
export const HORIZONS = [['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['long', 'Long-term'], ['habit', 'Habit']];
export const STYLES = [['listen', 'Just listen'], ['encourage', 'Encourage me'], ['honest', 'Be honest with me'], ['questions', 'Ask me questions'], ['steps', 'Give me clear steps'], ['accountable', 'Hold me accountable']];
export const emptyLife = () => Object.fromEntries(STORES.map((s) => [s, []]));

// ---- storage (browser only) ----
let dbp = null;
const db = () => (dbp ||= new Promise((res, rej) => { const r = indexedDB.open('anna-life', 1); r.onupgradeneeded = () => { for (const s of STORES) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s, { keyPath: 'id' }); }; r.onsuccess = () => res(r.result); r.onerror = () => { dbp = null; rej(r.error); }; }));
const tx = async (stores, mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction(stores, mode); let out; Promise.resolve(fn(t)).then((v) => { out = v; }); t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); };
const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
export async function loadAll() { const out = emptyLife(); await tx(STORES, 'readonly', (t) => Promise.all(STORES.map(async (s) => { out[s] = await req(t.objectStore(s).getAll()); }))); return out; }
export const put = (store, rec) => tx([store], 'readwrite', (t) => { t.objectStore(store).put(rec); });
export const del = (store, id) => tx([store], 'readwrite', (t) => { t.objectStore(store).delete(id); });
export const clear = (store) => tx([store], 'readwrite', (t) => { t.objectStore(store).clear(); });
export const replaceAll = (data) => tx(STORES, 'readwrite', (t) => { for (const s of STORES) { const os = t.objectStore(s); os.clear(); for (const r of data[s] || []) os.put(r); } });

// ---- pure helpers ----
const words = (s) => new Set(String(s || '').toLowerCase().match(/[a-z0-9À-ɏ]{3,}/g) || []);
const STOP = new Set(['the', 'and', 'for', 'that', 'this', 'with', 'you', 'are', 'was', 'what', 'how', 'have', 'about', 'can', 'should', 'would', 'could', 'just', 'like', 'want', 'feel', 'today', 'anna']);
const keyWords = (s) => new Set([...words(s)].filter((w) => !STOP.has(w)));

export function searchJournal(entries, q = '', tag = '') {
  const ws = String(q).toLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter((e) => (!tag || (e.tags || []).includes(tag)) && ws.every((w) => `${e.title || ''} ${e.text || ''} ${(e.tags || []).join(' ')} ${e.date || ''}`.toLowerCase().includes(w)))
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.created_at || 0) - (a.created_at || 0));
}

// The few memories and goals that share words with the question (then the most recent), never whole histories.
export function relevant(memories, goals, question, max = 5) {
  const q = [...keyWords(question)], near = (a, b) => a === b || (Math.min(a.length, b.length) >= 3 && (a.startsWith(b) || b.startsWith(a)));
  const score = (txt) => { let n = 0; for (const w of keyWords(txt)) if (q.some((x) => near(x, w))) n++; return n; };
  const mem = memories.filter((m) => m.status !== 'assumption').map((m) => ({ kind: 'memory', text: m.content, s: score(`${m.content} ${m.category}`), t: m.created_at || 0 }));
  const gol = goals.filter((g) => !g.done).map((g) => ({ kind: 'goal', text: g.title, g, s: score(`${g.title} ${g.area || ''} ${g.horizon}`), t: g.created_at || 0 }));
  const all = [...mem, ...gol].sort((a, b) => b.s - a.s || b.t - a.t);
  const hits = all.filter((x) => x.s > 0);
  return (hits.length ? hits : all.slice(0, 3)).slice(0, max); // nothing related: just the 3 most recent
}

// ---- goals & progress (encouragement only from real records) ----
export const startOfWeek = (now = Date.now()) => { const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };
const startOfDay = (t) => new Date(t).setHours(0, 0, 0, 0);
export function periodStart(horizon, now = Date.now()) { const d = new Date(now); if (horizon === 'daily' || horizon === 'habit') return startOfDay(now); if (horizon === 'weekly') return startOfWeek(now); if (horizon === 'monthly') return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); return 0; }
export function goalProgress(goal, progress, now = Date.now()) {
  const from = periodStart(goal.horizon, now), recs = progress.filter((p) => p.goal === goal.id && p.at >= from && p.at <= now);
  const total = recs.reduce((n, p) => n + (Number(p.value) || 0), 0), target = Number(goal.target) || 0;
  return { total, target, pct: target ? Math.min(100, Math.round((total / target) * 100)) : null, entries: recs.length, done: !!goal.done || (target > 0 && total >= target) };
}
// Consecutive days (ending today, or yesterday if nothing yet today) with at least one record for this habit.
export function streak(goalId, progress, now = Date.now()) {
  const days = new Set(progress.filter((p) => p.goal === goalId).map((p) => startOfDay(p.at)));
  let d = startOfDay(now); if (!days.has(d)) d -= 864e5; let n = 0;
  while (days.has(d)) { n++; d = new Date(d - 12 * 36e5).setHours(0, 0, 0, 0); }
  return n;
}
export function weeklyReview(life, now = Date.now()) {
  const from = startOfWeek(now), prevFrom = from - 7 * 864e5;
  const inWeek = (t) => t >= from && t <= now, inPrev = (t) => t >= prevFrom && t < from;
  const goals = life.goals.filter((g) => !g.archived).map((g) => { const thisW = life.progress.filter((p) => p.goal === g.id && inWeek(p.at)), prevW = life.progress.filter((p) => p.goal === g.id && inPrev(p.at));
    return { id: g.id, title: g.title, horizon: g.horizon, thisWeek: thisW.reduce((n, p) => n + (Number(p.value) || 0), 0), lastWeek: prevW.reduce((n, p) => n + (Number(p.value) || 0), 0), logs: thisW.length, streak: g.horizon === 'habit' ? streak(g.id, life.progress, now) : null }; });
  const entries = life.journal.filter((e) => inWeek(e.created_at || 0)), moods = entries.map((e) => e.mood).filter(Boolean);
  const wins = entries.filter((e) => (e.tags || []).includes('achievement')).length, challenges = entries.filter((e) => (e.tags || []).includes('challenge')).length;
  const lines = [];
  for (const g of goals) if (g.logs) lines.push(`${g.title}: ${g.thisWeek} logged this week${g.lastWeek || g.thisWeek !== g.lastWeek ? ` (last week ${g.lastWeek})` : ''}${g.streak ? `, ${g.streak}-day streak` : ''}.`);
  if (wins) lines.push(`You wrote down ${wins} achievement${wins > 1 ? 's' : ''} this week.`);
  if (!lines.length) lines.push('Nothing logged yet this week. Small steps count: log one when you are ready.');
  return { from, goals, journalEntries: entries.length, avgMood: moods.length ? +(moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(1) : null, wins, challenges, lines };
}

// ---- conversation helpers ----
// Personal statements ANNA may offer to remember (she always asks first; nothing is saved automatically).
export function rememberCandidate(text) {
  const t = String(text || '').trim(); if (t.length < 8 || t.length > 400 || /\?\s*$/.test(t)) return '';
  if (/^(please\s+)?remember( that)?\s+/i.test(t)) return t.replace(/^(please\s+)?remember( that)?\s+/i, '').replace(/^./, (c) => c.toUpperCase());
  if (/\b(i am|i'm|my name|my (wife|husband|partner|son|daughter|mom|mother|dad|father|sister|brother|friend|boss|birthday|goal|business|job|favourite|favorite)|i (like|love|hate|prefer|work|live|have|want to|need to|can't|cannot|struggle))\b/i.test(t)) return t;
  return '';
}
// "Just listen", "be honest with me", … → a support style ANNA can offer to remember.
export function styleFromText(text) {
  const t = String(text || '').toLowerCase();
  if (/\bjust listen|only listen|need to vent|let me vent\b/.test(t)) return 'listen';
  if (/\bhold me accountable|keep me accountable|check (in )?on me\b/.test(t)) return 'accountable';
  if (/\bbe (brutally )?honest|tell me the truth|don'?t sugar ?coat\b/.test(t)) return 'honest';
  if (/\bgive me (clear |the )?steps|step by step|what should i do\b/.test(t)) return 'steps';
  if (/\bask me questions|help me think\b/.test(t)) return 'questions';
  if (/\bencourage me|i need encouragement|cheer me on\b/.test(t)) return 'encourage';
  return '';
}
// Light check-in: at most once per day, never if a journal entry was already written today, and only after the
// first few minutes of a session, so it doesn't greet the user every time the app opens.
const CHECKINS = ['How are you feeling today?', 'What’s on your mind?'];
export function checkinPrompt(lastShownAt, journal, now = Date.now()) {
  const sod = startOfDay(now);
  if (lastShownAt && lastShownAt >= sod) return '';
  if (journal.some((e) => (e.created_at || 0) >= sod)) return '';
  return CHECKINS[Math.floor(sod / 864e5) % CHECKINS.length];
}
export const todayISO = (now = Date.now()) => { const d = new Date(now); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export function validateLife(x) {
  if (x == null) return emptyLife();
  if (typeof x !== 'object') throw new Error('Backup is damaged (bad personal record).');
  const out = emptyLife();
  for (const s of STORES) { if (x[s] != null && !Array.isArray(x[s])) throw new Error(`Backup is damaged (bad "${s}").`); out[s] = (x[s] || []).filter((r) => r && typeof r === 'object' && r.id); }
  return out;
}
