// ANNA WEB — owner identity and password protection (WebCrypto only; nothing leaves the device).
// Password: PBKDF2-SHA-256 (310 000 iterations, random 16-byte salt) → stored hash only, never the password.
// Backups: AES-256-GCM with a key derived from the same password (separate salt), so a backup file is unreadable
// without the owner's password and carries the owner identity + password check to a new device.
export const OWNER = Object.freeze({ name: 'Jamal Tamani', role: 'original owner' }); // permanent; not editable in the app
export const ITER = 310000;
const te = new TextEncoder(), td = new TextDecoder();
const b64 = (u8) => btoa(String.fromCharCode(...new Uint8Array(u8)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const rand = (n) => crypto.getRandomValues(new Uint8Array(n));
async function pbkdf2(password, salt, iter, usage) {
  const base = await crypto.subtle.importKey('raw', te.encode(password.normalize('NFKC')), 'PBKDF2', false, ['deriveBits', 'deriveKey']);
  if (usage === 'bits') return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, 256));
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
const eq = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0; };

export function passwordProblem(p) {
  if (typeof p !== 'string' || p.length < 8) return 'Use at least 8 characters.';
  if (p.length > 200) return 'That password is too long.';
  if (/^(.)\1+$/.test(p) || /^(0123456789|12345678|password|qwerty)/i.test(p)) return 'That password is too easy to guess.';
  return '';
}
// Creates the stored auth record for the owner. Contains no secret that reveals the password.
export async function createAuth(password, now = Date.now()) {
  const p = passwordProblem(password); if (p) throw new Error(p);
  const salt = rand(16), encSalt = rand(16), hash = await pbkdf2(password, salt, ITER, 'bits');
  return { v: 1, owner: OWNER.name, kdf: 'PBKDF2-SHA256', iter: ITER, salt: b64(salt), hash: b64(hash), encSalt: b64(encSalt), created_at: now, changed_at: now };
}
export async function verifyPassword(auth, password) {
  if (!auth?.salt || !auth?.hash || typeof password !== 'string') return false;
  return eq(await pbkdf2(password, unb64(auth.salt), auth.iter || ITER, 'bits'), unb64(auth.hash));
}
export const backupKey = (auth, password) => pbkdf2(password, unb64(auth.encSalt), auth.iter || ITER, 'key');

// Encrypted backup envelope. `auth` travels with it (hash + salts only) so the owner can unlock on a new device.
export async function encryptBackup(state, auth, key) {
  const iv = rand(12), ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(state)));
  return { app: 'anna-web', schema: 1, encrypted: 1, owner: OWNER.name, exported_at: Date.now(), auth, iv: b64(iv), ct: b64(ct) };
}
export async function decryptBackup(env, password) {
  if (!env?.encrypted || !env.auth) throw new Error('This backup is not encrypted.');
  if (!(await verifyPassword(env.auth, password))) throw new Error('Wrong password for this backup.');
  try { const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv) }, await backupKey(env.auth, password), unb64(env.ct)); return td.decode(pt); }
  catch { throw new Error('The backup is damaged and could not be decrypted.'); }
}
// Slows down guessing: after 5 wrong tries, wait 30 s, doubling each further failure (max 1 hour).
export const lockoutMs = (fails) => (fails < 5 ? 0 : Math.min(3600e3, 30e3 * 2 ** (fails - 5)));
