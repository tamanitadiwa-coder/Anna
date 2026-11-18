// Tiny static server for E2E tests: serves _site/ at /Anna/ (same base path as GitHub Pages).
import { createServer } from 'node:http';
import { createReadStream, statSync, existsSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.wasm': 'application/wasm', '.gguf': 'application/octet-stream' };
export function serve(root, port = 0, base = '/Anna/') {
  return new Promise((res) => {
    const srv = createServer((req, rsp) => {
      if (req.method === 'OPTIONS') { rsp.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,HEAD' }); return rsp.end(); }
      const u = new URL(req.url, 'http://x'); if (!u.pathname.startsWith(base)) { rsp.writeHead(404); return rsp.end('not found'); }
      let p = normalize(join(root, decodeURIComponent(u.pathname.slice(base.length)))); if (!p.startsWith(normalize(root))) { rsp.writeHead(403); return rsp.end(); }
      if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
      if (!existsSync(p)) { rsp.writeHead(404); return rsp.end('not found'); }
      rsp.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream', 'content-length': statSync(p).size, 'cache-control': 'no-cache', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-length,etag' });
      if (req.method === 'HEAD') return rsp.end();
      createReadStream(p).pipe(rsp);
    });
    srv.listen(port, '127.0.0.1', () => res({ srv, url: `http://127.0.0.1:${srv.address().port}${base}` }));
  });
}
