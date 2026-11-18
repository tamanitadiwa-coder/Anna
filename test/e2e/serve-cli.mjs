// npm run serve → http://127.0.0.1:8080/Anna/ (same base path as GitHub Pages). Run `npm run build` first.
import { serve } from './serve.mjs';
const { url } = await serve(new URL('../../_site', import.meta.url).pathname, +(process.env.PORT || 8080));
console.log('Anna is running at ' + url + '  (Ctrl+C to stop)');
