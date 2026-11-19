// ANNA's free lookup (v1.5): no account, no key, no subscription. Public, keyless services only:
//   Wiktionary (word meanings) · Wikipedia (who/what is…) · Open-Meteo (weather).
// Only the words being looked up are sent (e.g. "ejima", "Nelson Mandela", "Cape Town"). Nothing else leaves the phone.

const enc = encodeURIComponent;
export const strip = (h) => String(h || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();
const sentences = (s, n) => (String(s).match(/[^.!?]+[.!?]+(?:\s|$)/g) || [s]).slice(0, n).join('').trim();
async function getJSON(url, fetchFn, timeoutMs = 12000) {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, t = ctl && setTimeout(() => ctl.abort(), timeoutMs);
  try { const r = await fetchFn(url, { signal: ctl?.signal, headers: { Accept: 'application/json' } }); if (r.status === 404) return null; if (!r.ok) throw new Error(`Lookup failed (${r.status}).`); return await r.json(); }
  finally { if (t) clearTimeout(t); }
}

// What the person is asking for. null = not a lookup question.
export function intent(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  let m;
  if (/\b(?:weather|forecast|temperature|going to rain|will it rain|is it (?:hot|cold|raining))\b/i.test(t)) {
    m = t.match(/\b(?:in|for|at)\s+([A-Z][\p{L}' -]{1,40})$/u) || t.match(/\b(?:in|for|at)\s+([\p{L}' -]{2,40})$/iu);
    return { kind: 'weather', place: m ? m[1].replace(/\b(?:today|tomorrow|now|tonight|this week)\b/gi, '').trim() : '' };
  }
  if ((m = t.match(/^(?:what(?:'s| is| does)|whats)\s+(?:the\s+)?(?:meaning of|definition of)\s+["“']?(.+?)["”']?$/i)) || (m = t.match(/^(?:what\s+does|wat\s+does|what\s+do)\s+["“']?(.+?)["”']?\s+mean$/i)) || (m = t.match(/^(?:define|meaning of|definition of)\s+["“']?(.+?)["”']?$/i)) || (m = t.match(/^["“']?([\p{L}'-]{2,30})["”']?\s+meaning$/iu)))
    return { kind: 'define', word: m[1].trim().toLowerCase() };
  if ((m = t.match(/^(?:who\s+(?:is|was|are|were)|what\s+(?:is|was|are|were)\s+(?:a|an|the)?|tell me about|look up|search(?: for)?|google|wiki(?:pedia)?)\s+(.{2,80})$/i)) && !/^\p{L}+ing\b/iu.test(m[1]) && !/\b(?:my|our|i|me|time|date|day|today|tomorrow|balance|money|spend|left|payday|bill|bills)\b/i.test(m[1]))
    return { kind: 'wiki', q: m[1].trim() };
  return null;
}

export async function define(word, fetchFn = fetch) {
  const w = String(word || '').trim(); if (!w) return null;
  const d = await getJSON(`https://en.wiktionary.org/api/rest_v1/page/definition/${enc(w.replace(/ /g, '_'))}`, fetchFn).catch(() => null);
  const langs = d ? [...(d.en || []), ...Object.entries(d).filter(([k]) => k !== 'en').flatMap(([, v]) => v)] : [];
  for (const sec of langs) for (const def of sec.definitions || []) { const s = strip(def.definition); if (s) return { word: w, part: sec.partOfSpeech || '', meaning: s.slice(0, 220), language: sec.language || 'English', source: 'Wiktionary', url: `https://en.wiktionary.org/wiki/${enc(w.replace(/ /g, '_'))}` }; }
  const f = await getJSON(`https://api.dictionaryapi.dev/api/v2/entries/en/${enc(w)}`, fetchFn).catch(() => null);
  const m = Array.isArray(f) && f[0]?.meanings?.[0]; if (m?.definitions?.[0]?.definition) return { word: w, part: m.partOfSpeech || '', meaning: m.definitions[0].definition.slice(0, 220), language: 'English', source: 'Free Dictionary', url: `https://en.wiktionary.org/wiki/${enc(w)}` };
  return null;
}

export async function wiki(q, fetchFn = fetch) {
  const s = await getJSON(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${enc(q)}&srlimit=1&format=json&origin=*`, fetchFn);
  const title = s?.query?.search?.[0]?.title; if (!title) return null;
  const p = await getJSON(`https://en.wikipedia.org/api/rest_v1/page/summary/${enc(title.replace(/ /g, '_'))}`, fetchFn);
  if (!p?.extract) return null;
  return { title: p.title || title, text: sentences(p.extract, 3), source: 'Wikipedia', url: p.content_urls?.mobile?.page || `https://en.wikipedia.org/wiki/${enc(title.replace(/ /g, '_'))}` };
}

const WMO = { 0: 'clear sky', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast', 45: 'fog', 48: 'fog', 51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle', 61: 'light rain', 63: 'rain', 65: 'heavy rain', 71: 'light snow', 73: 'snow', 75: 'heavy snow', 80: 'rain showers', 81: 'rain showers', 82: 'heavy showers', 95: 'thunderstorms', 96: 'thunderstorms with hail', 99: 'thunderstorms with hail' };
export async function weather(place, fetchFn = fetch) {
  const g = await getJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${enc(place)}&count=1&format=json`, fetchFn), loc = g?.results?.[0]; if (!loc) return null;
  const w = await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=auto&forecast_days=2`, fetchFn);
  if (!w?.current) return null; const d = w.daily || {}, r = (x) => Math.round(x);
  return { place: [loc.name, loc.country].filter(Boolean).join(', '), now: `${r(w.current.temperature_2m)}°C, ${WMO[w.current.weather_code] || 'mixed weather'}, wind ${r(w.current.wind_speed_10m)} km/h`,
    today: d.temperature_2m_max ? `${r(d.temperature_2m_min[0])}–${r(d.temperature_2m_max[0])}°C, ${d.precipitation_probability_max?.[0] ?? 0}% chance of rain` : '',
    tomorrow: d.temperature_2m_max?.[1] != null ? `${r(d.temperature_2m_min[1])}–${r(d.temperature_2m_max[1])}°C, ${WMO[d.weather_code?.[1]] || ''}, ${d.precipitation_probability_max?.[1] ?? 0}% chance of rain` : '', source: 'Open-Meteo' };
}

// One plain-text answer for the chat. Returns { text, learned? } or null if nothing was found.
export async function answer(it, { home = 'Cape Town', fetchFn = fetch } = {}) {
  if (it.kind === 'define') { const d = await define(it.word, fetchFn); if (!d) return { text: `I couldn’t find “${it.word}” in the free dictionary. If it’s slang, tell me what it means (“${it.word} means …”) and I’ll remember.` };
    return { text: `“${d.word}”${d.part ? ` (${d.part.toLowerCase()})` : ''}${d.language && d.language !== 'English' ? `, ${d.language}` : ''}: ${d.meaning}\nSource: ${d.source}`, learned: { word: d.word, means: d.meaning.split(/[.;]/)[0].slice(0, 80) } }; }
  if (it.kind === 'wiki') { const w = await wiki(it.q, fetchFn); return w ? { text: `${w.title}: ${w.text}\nSource: ${w.source}` } : { text: `I couldn’t find anything on Wikipedia for “${it.q}”.` }; }
  if (it.kind === 'weather') { const place = it.place || home, w = await weather(place, fetchFn); if (!w) return { text: `I couldn’t find the weather for “${place}”.` };
    return { text: `Weather in ${w.place}: now ${w.now}.${w.today ? `\nToday ${w.today}.` : ''}${w.tomorrow ? `\nTomorrow ${w.tomorrow}.` : ''}\nSource: ${w.source}` }; }
  return null;
}
