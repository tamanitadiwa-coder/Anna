// ANNA date & time engine. Exact dates and times come from code, never from the language model.
// Device clock for "now"; local calendar maths via Date (follows the device time zone, so daylight saving is correct);
// other cities via the IANA time-zone database built into Intl. Timestamps are stored as UTC milliseconds.
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MON_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const DAY_RE = '(mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)';
const monIdx = (s) => MONTHS.findIndex((m) => m.startsWith(s.toLowerCase().slice(0, 3)));
const dayIdx = (s) => DAYS.findIndex((d) => d.startsWith(s.toLowerCase().slice(0, 3)));
const ymd = (d) => ({ y: d.getFullYear(), m: d.getMonth(), d: d.getDate() });
const at = (y, m, d, h = 0, mi = 0) => new Date(y, m, d, h, mi, 0, 0).getTime();
export const iso = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const hhmm = (t) => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
export const fmtDate = (t) => new Date(t).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const fmtDateTime = (t) => `${new Date(t).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} at ${hhmm(t)}`;
export const deviceZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'local time'; } catch { return 'local time'; } };

// ---- natural-language dates ----
// Returns { ts, hasDate, hasTime, repeat, rest } or null when no date/time phrase was found. `rest` is the text left over.
export function parseWhen(input, now = Date.now()) {
  let s = ` ${String(input || '').toLowerCase().replace(/[,]/g, ' ').replace(/\s+/g, ' ')} `;
  const cut = (re) => { const m = s.match(re); if (m) s = s.replace(m[0], ' '); return m; };
  const base = new Date(now); let date = null, hour = null, minute = 0, abs = null, repeat = 'none';
  // repeats
  let m;
  if ((m = cut(new RegExp(`\\bevery ${DAY_RE}\\b`)))) { repeat = 'weekly'; date = nextDow(now, dayIdx(m[1]), true); }
  else if (cut(/\b(every ?day|daily|each day)\b/)) repeat = 'daily';
  else if (cut(/\b(every week|weekly|each week)\b/)) repeat = 'weekly';
  else if (cut(/\b(every month|monthly|each month)\b/)) repeat = 'monthly';
  // relative offsets: in 20 minutes / in 2 hours / in 3 days / in 2 weeks / in 1 month
  if ((m = cut(/\bin (\d{1,3}|an?|one|two|three|half an?) ?(minutes?|mins?|hours?|hrs?|days?|weeks?|months?)\b/))) {
    const n = { a: 1, an: 1, one: 1, two: 2, three: 3, 'half a': 0.5, 'half an': 0.5 }[m[1]] ?? Number(m[1]), u = m[2];
    if (/^m(in|inute)/.test(u)) abs = now + n * 6e4; else if (/^h/.test(u)) abs = now + n * 36e5;
    else { const d = new Date(now); if (/^d/.test(u)) d.setDate(d.getDate() + n); else if (/^w/.test(u)) d.setDate(d.getDate() + 7 * n); else d.setMonth(d.getMonth() + n); date = ymd(d); }
  }
  // explicit dates
  if (!date && (m = cut(/\b(\d{4})-(\d{2})-(\d{2})\b/))) date = { y: +m[1], m: +m[2] - 1, d: +m[3] };
  if (!date && (m = cut(new RegExp(`\\b(?:on )?(?:the )?(\\d{1,2})(?:st|nd|rd|th)? (?:of )?${MON_RE}(?: (\\d{4}))?\\b`)))) date = withYear({ m: monIdx(m[2]), d: +m[1] }, m[3], now);
  if (!date && (m = cut(new RegExp(`\\b(?:on )?${MON_RE} (\\d{1,2})(?:st|nd|rd|th)?(?: (\\d{4}))?\\b`)))) date = withYear({ m: monIdx(m[1]), d: +m[2] }, m[3], now);
  if (!date && (m = cut(/\b(?:on )?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) date = withYear({ m: +m[2] - 1, d: +m[1] }, m[3] && (m[3].length === 2 ? '20' + m[3] : m[3]), now); // SA order: day/month
  if (!date && (m = cut(/\b(?:on )?the (\d{1,2})(?:st|nd|rd|th)\b/))) { const d = new Date(now); let t = { y: d.getFullYear(), m: d.getMonth(), d: +m[1] }; if (at(t.y, t.m, t.d) < at(d.getFullYear(), d.getMonth(), d.getDate())) t = ymd(new Date(t.y, t.m + 1, t.d)); date = t; }
  // relative days
  if (!date && cut(/\b(the )?day after tomorrow\b/)) { const d = new Date(now); d.setDate(d.getDate() + 2); date = ymd(d); }
  if (!date && cut(/\btomorrow\b/)) { const d = new Date(now); d.setDate(d.getDate() + 1); date = ymd(d); }
  if (!date && cut(/\btonight\b/)) { date = ymd(base); if (hour === null) hour = 20; }
  if (!date && cut(/\btoday\b/)) date = ymd(base);
  if (!date && cut(/\bnext week\b/)) date = nextDow(now, 1, false, true);
  if (!date && cut(/\bnext month\b/)) date = ymd(new Date(base.getFullYear(), base.getMonth() + 1, 1));
  if (!date && cut(/\b(this )?weekend\b/)) date = nextDow(now, 6, true);
  if (!date && (m = cut(new RegExp(`\\b(next|this|on|coming)? ?${DAY_RE}\\b`)))) date = nextDow(now, dayIdx(m[2]), m[1] === 'this');
  // times
  if ((m = cut(/(?<![R$€£\d.,])\b(?:at |@ ?)?(\d{1,2})[:h.](\d{2})(?![\d.,]) ?(am|pm|a\.m\.|p\.m\.)?\b/))) { hour = to24(+m[1], m[3]); minute = +m[2]; }
  else if ((m = cut(/\b(?:at |@ ?)?(\d{1,2}) ?(am|pm|a\.m\.|p\.m\.)\b/))) { hour = to24(+m[1], m[2]); minute = 0; }
  else if ((m = cut(/\bat (\d{1,2})\b(?! ?(?:minutes?|mins?|hours?|days?|weeks?|months?|st|nd|rd|th))/))) { const h = +m[1]; hour = h >= 1 && h <= 6 ? h + 12 : h; minute = 0; } // "at 3" → 15:00
  else if (cut(/\b(at )?noon|midday\b/)) { hour = 12; minute = 0; }
  else if (cut(/\b(at )?midnight\b/)) { hour = 0; minute = 0; if (!date) { const d = new Date(now); d.setDate(d.getDate() + 1); date = ymd(d); } }
  else if ((m = cut(/\b(?:in the |this )?(morning|afternoon|evening)\b/))) { hour = { morning: 9, afternoon: 15, evening: 18 }[m[1]]; minute = 0; }
  if (hour !== null && (hour > 23 || minute > 59)) return null;
  if (abs === null && !date && hour === null && repeat === 'none') return null;
  let ts;
  if (abs !== null) ts = abs;
  else {
    const hasTime = hour !== null; if (!date) { date = ymd(base); if (hasTime && at(date.y, date.m, date.d, hour, minute) <= now) { const d = new Date(now); d.setDate(d.getDate() + 1); date = ymd(d); } }
    if (!validDate(date)) return null;
    ts = at(date.y, date.m, date.d, hasTime ? hour : 9, hasTime ? minute : 0);
    if (repeat === 'daily' && !hasTime && !date) ts = at(base.getFullYear(), base.getMonth(), base.getDate() + 1, 9);
  }
  const rest = s.replace(/\b(on|at|by|in|for|the)\s*$/g, '').replace(/\s+/g, ' ').trim();
  return { ts, hasDate: abs !== null || date !== null, hasTime: abs !== null || hour !== null, repeat, rest };
}
function to24(h, ap) { if (!ap) return h; const pm = ap[0] === 'p'; if (h === 12) return pm ? 12 : 0; return pm ? h + 12 : h; }
function validDate({ y, m, d }) { const t = new Date(y, m, d); return t.getFullYear() === y && t.getMonth() === m && t.getDate() === d; }
function withYear({ m, d }, y, now) { if (y) return { y: +y, m, d }; const n = new Date(now), ty = n.getFullYear(); return at(ty, m, d) < at(ty, n.getMonth(), n.getDate()) ? { y: ty + 1, m, d } : { y: ty, m, d }; }
// next occurrence of a weekday: strictly after today, unless includeToday ("this friday" on a Friday = today).
// nextWeek=true: the Monday (or given day) of next week.
function nextDow(now, dow, includeToday = false, nextWeek = false) {
  const d = new Date(now); d.setHours(12, 0, 0, 0);
  if (nextWeek) { const toMon = ((8 - d.getDay()) % 7) || 7; d.setDate(d.getDate() + toMon); return ymd(d); }
  let diff = (dow - d.getDay() + 7) % 7; if (diff === 0 && !includeToday) diff = 7; d.setDate(d.getDate() + diff); return ymd(d);
}

// "remind me to call mom tomorrow at 3pm" → { title, ts, repeat, hasTime } (null if it isn't a reminder request)
export function parseReminder(text, now = Date.now()) {
  const m = String(text || '').trim().match(/^(?:hey anna[,!]?\s*)?(?:please\s+)?(?:can you\s+)?(?:remind me|set (?:a |me a )?reminder|reminder)\b\s*(.*)$/i);
  if (!m) return null;
  const w = parseWhen(m[1], now);
  let title = (w ? w.rest : m[1].toLowerCase()).replace(/^(?:to|that|about|of|for)\s+/, '').replace(/\s+(?:on|at|by|in|for)$/, '').trim();
  const orig = m[1]; const i = orig.toLowerCase().indexOf(title); if (title && i >= 0) title = orig.slice(i, i + title.length); // keep the user's capitalisation
  title = title.replace(/^./, (c) => c.toUpperCase()).replace(/[.!]+$/, '');
  return { title, ts: w?.ts ?? null, hasTime: !!w?.hasTime, hasDate: !!w?.hasDate, repeat: w?.repeat || 'none' };
}

// ---- world clock ----
export const CITIES = { johannesburg: 'Africa/Johannesburg', joburg: 'Africa/Johannesburg', pretoria: 'Africa/Johannesburg', 'cape town': 'Africa/Johannesburg', durban: 'Africa/Johannesburg', 'south africa': 'Africa/Johannesburg', soweto: 'Africa/Johannesburg', 'port elizabeth': 'Africa/Johannesburg', gqeberha: 'Africa/Johannesburg', bloemfontein: 'Africa/Johannesburg', polokwane: 'Africa/Johannesburg',
  london: 'Europe/London', uk: 'Europe/London', dublin: 'Europe/Dublin', lisbon: 'Europe/Lisbon', paris: 'Europe/Paris', berlin: 'Europe/Berlin', amsterdam: 'Europe/Amsterdam', brussels: 'Europe/Brussels', madrid: 'Europe/Madrid', rome: 'Europe/Rome', zurich: 'Europe/Zurich', vienna: 'Europe/Vienna', stockholm: 'Europe/Stockholm', athens: 'Europe/Athens', istanbul: 'Europe/Istanbul', moscow: 'Europe/Moscow', kyiv: 'Europe/Kyiv', warsaw: 'Europe/Warsaw',
  'new york': 'America/New_York', nyc: 'America/New_York', washington: 'America/New_York', boston: 'America/New_York', miami: 'America/New_York', toronto: 'America/Toronto', chicago: 'America/Chicago', houston: 'America/Chicago', dallas: 'America/Chicago', denver: 'America/Denver', phoenix: 'America/Phoenix', 'los angeles': 'America/Los_Angeles', la: 'America/Los_Angeles', 'san francisco': 'America/Los_Angeles', seattle: 'America/Los_Angeles', vancouver: 'America/Vancouver', 'mexico city': 'America/Mexico_City', 'sao paulo': 'America/Sao_Paulo', 'são paulo': 'America/Sao_Paulo', 'rio de janeiro': 'America/Sao_Paulo', 'buenos aires': 'America/Argentina/Buenos_Aires', lima: 'America/Lima', bogota: 'America/Bogota', honolulu: 'Pacific/Honolulu',
  dubai: 'Asia/Dubai', 'abu dhabi': 'Asia/Dubai', doha: 'Asia/Qatar', riyadh: 'Asia/Riyadh', 'tel aviv': 'Asia/Jerusalem', jerusalem: 'Asia/Jerusalem', mumbai: 'Asia/Kolkata', delhi: 'Asia/Kolkata', 'new delhi': 'Asia/Kolkata', india: 'Asia/Kolkata', karachi: 'Asia/Karachi', dhaka: 'Asia/Dhaka', bangkok: 'Asia/Bangkok', singapore: 'Asia/Singapore', 'kuala lumpur': 'Asia/Kuala_Lumpur', jakarta: 'Asia/Jakarta', manila: 'Asia/Manila', 'hong kong': 'Asia/Hong_Kong', beijing: 'Asia/Shanghai', shanghai: 'Asia/Shanghai', china: 'Asia/Shanghai', taipei: 'Asia/Taipei', seoul: 'Asia/Seoul', tokyo: 'Asia/Tokyo', japan: 'Asia/Tokyo',
  sydney: 'Australia/Sydney', melbourne: 'Australia/Melbourne', brisbane: 'Australia/Brisbane', perth: 'Australia/Perth', auckland: 'Pacific/Auckland',
  lagos: 'Africa/Lagos', nigeria: 'Africa/Lagos', nairobi: 'Africa/Nairobi', kenya: 'Africa/Nairobi', cairo: 'Africa/Cairo', egypt: 'Africa/Cairo', accra: 'Africa/Accra', ghana: 'Africa/Accra', casablanca: 'Africa/Casablanca', 'addis ababa': 'Africa/Addis_Ababa', harare: 'Africa/Harare', zimbabwe: 'Africa/Harare', lusaka: 'Africa/Lusaka', gaborone: 'Africa/Gaborone', botswana: 'Africa/Gaborone', windhoek: 'Africa/Windhoek', namibia: 'Africa/Windhoek', maputo: 'Africa/Maputo', mozambique: 'Africa/Maputo', maseru: 'Africa/Maseru', lesotho: 'Africa/Maseru', mbabane: 'Africa/Mbabane', eswatini: 'Africa/Mbabane', kinshasa: 'Africa/Kinshasa', luanda: 'Africa/Luanda', 'dar es salaam': 'Africa/Dar_es_Salaam', kampala: 'Africa/Kampala', kigali: 'Africa/Kigali' };
export function zoneFor(place) {
  const p = String(place || '').toLowerCase().replace(/[?.!]/g, '').replace(/^(the )/, '').trim(); if (!p) return null;
  if (CITIES[p]) return CITIES[p];
  try { new Intl.DateTimeFormat('en', { timeZone: place.trim() }); return place.trim(); } catch {}
  const k = Object.keys(CITIES).find((c) => p.endsWith(' ' + c) || p.startsWith(c + ' ')); return k ? CITIES[k] : null;
}
// minutes east of UTC for a zone at a moment (DST-aware, from Intl)
export function offsetMin(zone, t = Date.now()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(t).map((p) => [p.type, p.value]));
  return Math.round((Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second) - Math.floor(t / 1000) * 1000) / 6e4);
}
export function timeIn(zone, t = Date.now()) {
  const time = new Intl.DateTimeFormat('en-ZA', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(t);
  const day = new Intl.DateTimeFormat('en-ZA', { timeZone: zone, weekday: 'long', day: 'numeric', month: 'long' }).format(t);
  const diff = offsetMin(zone, t) - -new Date(t).getTimezoneOffset();
  return { zone, time, day, diffMin: diff };
}
const diffText = (m) => { if (!m) return 'the same time as here'; const h = Math.abs(m) / 60; return `${Number.isInteger(h) ? h : h.toFixed(1)} hour${h === 1 ? '' : 's'} ${m > 0 ? 'ahead of' : 'behind'} you`; };

// ---- South African public holidays (Public Holidays Act 36 of 1994): a holiday on a Sunday moves to the Monday ----
export function easter(y) { const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1; return { m: mo - 1, d: da }; }
export function saHolidays(y) {
  const e = easter(y), ed = new Date(y, e.m, e.d);
  const list = [[0, 1, 'New Year’s Day'], [2, 21, 'Human Rights Day'], [ed.getMonth(), ed.getDate() - 2, 'Good Friday'], [ed.getMonth(), ed.getDate() + 1, 'Family Day'], [3, 27, 'Freedom Day'], [4, 1, 'Workers’ Day'], [5, 16, 'Youth Day'], [7, 9, 'National Women’s Day'], [8, 24, 'Heritage Day'], [11, 16, 'Day of Reconciliation'], [11, 25, 'Christmas Day'], [11, 26, 'Day of Goodwill']]
    .map(([m, d, name]) => { const t = new Date(y, m, d, 12); return { date: iso(t.getTime()), name, ts: t.getTime() }; });
  const out = [...list];
  for (const h of list) if (new Date(h.ts).getDay() === 0) { const t = h.ts + 864e5; out.push({ date: iso(t), name: `Public holiday (${h.name} observed)`, ts: t }); }
  return out.sort((a, b) => a.ts - b.ts);
}
export function nextHolidays(now = Date.now(), n = 3) { const today = iso(now), y = new Date(now).getFullYear(); return [...saHolidays(y), ...saHolidays(y + 1)].filter((h) => h.date >= today).slice(0, n); }
export const holidayOn = (t) => saHolidays(new Date(t).getFullYear()).find((h) => h.date === iso(t)) || null;

// ---- answers ANNA gives from code (no language model involved) ----
export function answerTime(text, now = Date.now()) {
  const t = String(text || '').trim();
  let m = t.match(/\b(?:what(?:'s| is)? the time|what time is it|time)\s+(?:now\s+)?in\s+(.+?)\??$/i);
  if (m) { const z = zoneFor(m[1]); if (!z) return `I don’t know the time zone for “${m[1].trim()}”. Try a major city, like London or New York.`; const r = timeIn(z, now); return `It’s ${r.time} in ${titleCase(m[1].replace(/\?$/, '').trim())} (${r.day}), ${diffText(r.diffMin)}.`; }
  if (/^(?:hey anna[,!]?\s*)?(?:what(?:'s| is)? the time|what time is it)(?: now)?\??$/i.test(t)) return `It’s ${hhmm(now)} (${fmtDate(now)}, ${deviceZone()}).`;
  if (/\bpublic holidays?\b/i.test(t)) { const w = parseWhen(t.replace(/\bpublic holidays?\b/i, ''), now); if (w?.hasDate && /\bis\b/i.test(t)) { const h = holidayOn(w.ts); return h ? `Yes, ${fmtDate(w.ts)} is a public holiday in South Africa: ${h.name}.` : `No, ${fmtDate(w.ts)} is not a South African public holiday.`; } return 'Next South African public holidays: ' + nextHolidays(now, 3).map((h) => `${h.name}, ${fmtDate(h.ts)}`).join('; ') + '.'; }
  if (/^(?:hey anna[,!]?\s*)?(?:what(?:'s| is) (?:the )?date(?: today)?|what day is (?:it|today)|what(?:'s| is) today(?:'s date)?)\??$/i.test(t)) return `Today is ${fmtDate(now)}.`;
  m = t.match(/^(?:what (?:date|day) is|when is|what(?:'s| is) the date (?:on|for)?)\s+(.+?)\??$/i);
  if (m) { const w = parseWhen(m[1], now); if (w?.hasDate && !/\bholiday|birthday|meeting|appointment\b/i.test(m[1])) { const h = holidayOn(w.ts); return `${titleCase(m[1].trim())} is ${fmtDate(w.ts)}${h ? ` (public holiday: ${h.name})` : ''}.`; } }
  return '';
}
const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

// ---- hand-off to iPhone Reminders via the user's "ANNA Reminder" shortcut ----
export function shortcutURL(r) {
  const payload = { title: r.title, date: iso(r.at), time: hhmm(r.at), due: `${iso(r.at)} ${hhmm(r.at)}`, notes: r.notes || '' };
  return 'shortcuts://run-shortcut?name=' + encodeURIComponent('ANNA Reminder') + '&input=text&text=' + encodeURIComponent(JSON.stringify(payload));
}
