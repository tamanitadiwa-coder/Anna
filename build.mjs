// Copies ONLY the public web files into _site/. Nothing from anna-native is ever included.
import { cpSync, rmSync, mkdirSync } from 'node:fs';
const FILES = ['index.html', 'app.js', 'logic.js', 'styles.css', 'sw.js', 'manifest.webmanifest'];
rmSync('_site', { recursive: true, force: true }); mkdirSync('_site');
for (const f of FILES) cpSync(f, `_site/${f}`);
cpSync('icons', '_site/icons', { recursive: true });
console.log('Built _site/ with', FILES.length, 'files + icons');
