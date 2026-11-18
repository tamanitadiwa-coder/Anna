// ANNA chat routing (spec §6). Each message goes to the tool that owns the answer; only what no tool owns goes to Qwen.
// Exact answers come from the tool. Qwen may only re-phrase them, and its wording is kept only if every number survives.
export const ROUTES = ['reminders', 'memory', 'journal', 'finance', 'staff', 'calc', 'clock', 'research', 'qwen'];
const R = {
  reminders: /^(?:hey anna[,!]?\s*)?(?:please\s+)?(?:can you\s+)?(?:remind me|set (?:a |me a )?reminder|reminder)\b/i,
  memory: /\bwhat (?:did|have) i (?:tell|told|say|said|mention(?:ed)?)\b|\bwhat do you (?:remember|know) about\b|\bdo you remember\b|\bwhat have you (?:saved|remembered)\b|\bwhat i (?:told|said to) you\b/i,
  journal: /\bhow (?:did|have|was|were) i (?:feel|felt|feeling|been feeling|doing)\b|\bhow was i feeling\b|\bmy (?:mood|moods)\b|\bmood (?:this|last) (?:week|month)\b|\bwhat did i (?:write|journal)\b/i,
  staff: /\bhow many hours did\b|\b(?:staff|team|employees?|workers?)\b.*\b(?:hours|wages?|overtime|timesheets?|shifts?)\b|\b(?:hours|wages?|overtime|timesheets?)\b.*\b(?:staff|team|employees?|workers?)\b|\btimesheets?\b/i,
  finance: /\b(?:can|could) i afford\b|\bafford\b|\bshould i (?:buy|spend|get)\b|\bwhat (?:must|should|do) i pay first\b|\bpay first\b|\bmoney left\b|\bhow much (?:money )?(?:is |do i have )?left\b|\bmy (?:monthly )?budget\b|\bbooks day\b|^(?:i\s+)?(?:got|received|earned|spent|paid|saved|cancell?ed)\b|\bis now r\s?\d|\bvat\b/i,
  calc: /^(?:what(?:'s| is)|calculate|calc|work out|how much is)?\s*[\d(][\d\s.,()R]*\s*(?:[-+*/x×÷^]|%)\s*[\d(]?|\d+(?:[.,]\d+)?\s*(?:%|percent) of\b/i,
  clock: /\bwhat time\b|\bthe time\b|\btime (?:now )?in\b|\bwhat(?:'s| is) (?:the )?date\b|\bwhat day is\b|\bwhat(?:'s| is) today\b|\bpublic holidays?\b|\bwhen is\b|\bwhat date is\b|\bhow many days (?:until|till|to)\b/i,
  research: /\b(?:news|headlines?|latest|current events?|right now in the world|trending|who won|score of|results? of the|election|weather|forecast|exchange rate|stock price|share price|price of (?:bitcoin|petrol|fuel|gold)|look (?:it )?up|search (?:the )?(?:web|internet|online)|google)\b|\bwhat(?:'s| is) happening\b|\btoday'?s (?:news|weather)\b/i,
};
// Order matters: the most specific owners first.
export function route(text) {
  const t = String(text || '').trim();
  if (!t) return 'qwen';
  for (const k of ['reminders', 'memory', 'journal', 'staff', 'finance', 'calc', 'research', 'clock']) if (R[k].test(t)) return k;
  return 'qwen';
}
// Routes whose exact answer Qwen may re-phrase (never research: there is nothing to phrase without a real search).
export const PHRASE = new Set(['clock', 'calc', 'finance', 'staff', 'memory', 'journal', 'reminders']);
const nums = (s) => (String(s).match(/\d[\d\s  ,.:]*\d|\d/g) || []).map((n) => n.replace(/[\s  ]/g, ''));
const flat = (s) => String(s).replace(/[\s  ]/g, '');
// The prompt Qwen gets: the tool's facts, and the instruction to keep them exact.
export function phraseMessages(system, question, facts) {
  const multi = facts.split('\n').length > 2;
  return [{ role: 'system', content: system }, { role: 'user', content: multi
    ? `Jamal asked: "${question}"\nANNA's tools found the exact answer below; it will be shown to him as it is.\n---\n${facts}\n---\nWrite ONE short warm sentence to introduce it. Do not repeat or change any numbers, amounts, dates or names.`
    : `Jamal asked: "${question}"\nExact answer from ANNA's tools: ${facts}\nSay this to him in one or two warm, natural sentences, as his companion. Copy every number, amount, date, time and name exactly. Add no new facts.` }];
}
// Keep Qwen's wording only if it is safe: every number from the tool is there (single answers), or it adds no numbers (intros).
export function acceptPhrase(facts, reply) {
  const r = String(reply || '').trim().replace(/^["“]|["”]$/g, '');
  if (!r || r.length > 400 || /as an ai|language model|i (?:can(?:no|')t|am unable to) (?:access|browse)/i.test(r)) return null;
  if (facts.split('\n').length > 2) return nums(r).length ? null : `${r}\n${facts}`;
  const f = flat(r); return nums(facts).every((n) => f.includes(n)) ? r : null;
}
// Web research (spec §6): only with internet AND a service the owner approved. Never fake a search.
export function researchReply(text, { online, service } = {}) {
  if (!online) return 'That needs a web search, and research needs internet. You’re offline right now, so I can’t look it up, and I won’t guess.';
  if (!service) return 'That needs a live web search. Web research isn’t switched on yet: it needs a search service you approve first (Settings → Web research shows the options and their cost). Until then I won’t guess about current events.';
  return '';
}
