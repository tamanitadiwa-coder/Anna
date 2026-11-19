import test from 'node:test'; import assert from 'node:assert/strict';
import * as LK from '../lookup.js';
const fake = (routes) => async (url) => { const hit = routes.find(([re]) => re.test(url)); if (!hit) return { ok: false, status: 404 }; return { ok: true, status: 200, json: async () => hit[1] }; };
test('free lookup: intents', () => {
  assert.deepEqual(LK.intent('What does ejima mean?'), { kind: 'define', word: 'ejima' });
  assert.deepEqual(LK.intent('weather in Harare'), { kind: 'weather', place: 'Harare' });
  assert.deepEqual(LK.intent('who is Nelson Mandela'), { kind: 'wiki', q: 'Nelson Mandela' });
  for (const t of ['what is my balance', 'what is the time', 'who is coming to dinner', 'R500 for rent']) assert.equal(LK.intent(t), null, t);
});
test('free lookup: dictionary, Wikipedia and weather answers (keyless URLs only)', async () => {
  const urls = []; const f = fake([
    [/wiktionary\.org\/api\/rest_v1\/page\/definition\/lekker/, { af: [{ partOfSpeech: 'Adjective', language: 'Afrikaans', definitions: [{ definition: '<b>nice</b>, good, tasty' }] }] }],
    [/w\/api\.php.*srsearch=Table%20Mountain/, { query: { search: [{ title: 'Table Mountain' }] } }],
    [/rest_v1\/page\/summary\/Table_Mountain/, { title: 'Table Mountain', extract: 'Table Mountain is a flat-topped mountain. It overlooks Cape Town. It is a landmark. Extra sentence.' }],
    [/geocoding-api\.open-meteo\.com.*name=Cape%20Town/, { results: [{ name: 'Cape Town', country: 'South Africa', latitude: -33.9, longitude: 18.4 }] }],
    [/api\.open-meteo\.com\/v1\/forecast/, { current: { temperature_2m: 21.4, weather_code: 1, wind_speed_10m: 30.2 }, daily: { temperature_2m_min: [14, 15], temperature_2m_max: [24, 26], precipitation_probability_max: [10, 40], weather_code: [1, 61] } }],
  ]); const fetchFn = (u, o) => { urls.push(u); return f(u, o); };
  const d = await LK.answer({ kind: 'define', word: 'lekker' }, { fetchFn }); assert.equal(d.text, '“lekker” (adjective), Afrikaans: nice, good, tasty\nSource: Wiktionary'); assert.deepEqual(d.learned, { word: 'lekker', means: 'nice, good, tasty' });
  assert.equal((await LK.answer({ kind: 'wiki', q: 'Table Mountain' }, { fetchFn })).text, 'Table Mountain: Table Mountain is a flat-topped mountain. It overlooks Cape Town. It is a landmark.\nSource: Wikipedia');
  assert.equal((await LK.answer({ kind: 'weather', place: '' }, { fetchFn })).text, 'Weather in Cape Town, South Africa: now 21°C, mostly clear, wind 30 km/h.\nToday 14–24°C, 10% chance of rain.\nTomorrow 15–26°C, light rain, 40% chance of rain.\nSource: Open-Meteo');
  assert.match((await LK.answer({ kind: 'define', word: 'zzqx' }, { fetchFn })).text, /couldn’t find “zzqx”/);
  assert.ok(urls.every((u) => !/key=|token|apikey/i.test(u)), 'no keys anywhere');
});
