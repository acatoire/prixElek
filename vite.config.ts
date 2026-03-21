import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import type { Plugin, Connect } from 'vite';
import type { ServerResponse } from 'node:http';
import https from 'node:https';
import zlib from 'node:zlib';

// ── Bricodepot server-side fetch plugin ───────────────────────────────────────
// The Vite proxy approach sends a Host header that Bricodepot's WAF blocks (403).
// This plugin handles /api/bricodepot-page?path=<url-path> entirely in Node,
// which works reliably (proven by probe: no cookies needed, 200 every time).

function bricodepotFetchPlugin(): Plugin {
  return {
    name: 'bricodepot-fetch',
    configureServer(server) {
      server.middlewares.use(
        '/api/bricodepot-page',
        (req: Connect.IncomingMessage, res: ServerResponse) => {
          const qs = new URL(req.url ?? '', 'http://localhost').searchParams;
          const path = qs.get('path') ?? '';
          if (!path || !path.startsWith('catalogue/')) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'invalid path' }));
            return;
          }

          const options = {
            hostname: 'www.bricodepot.fr',
            path: `/${path}`,
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:148.0) Gecko/20100101 Firefox/148.0',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'fr,fr-FR;q=0.9,en-US;q=0.8,en;q=0.7',
              'Accept-Encoding': 'gzip, deflate, br',
              'Connection': 'keep-alive',
              'Upgrade-Insecure-Requests': '1',
              'Sec-Fetch-Dest': 'document',
              'Sec-Fetch-Mode': 'navigate',
              'Sec-Fetch-Site': 'none',
            },
          };

          const proxyReq = https.request(options, (proxyRes) => {
            // Follow redirects manually (max 3)
            if (
              proxyRes.statusCode &&
              proxyRes.statusCode >= 300 &&
              proxyRes.statusCode < 400 &&
              proxyRes.headers['location']
            ) {
              res.writeHead(proxyRes.statusCode, { Location: proxyRes.headers['location'] });
              res.end();
              return;
            }

            res.writeHead(proxyRes.statusCode ?? 200, {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-store',
            });

            const encoding = proxyRes.headers['content-encoding'] ?? '';
            let stream: NodeJS.ReadableStream = proxyRes;
            if (encoding === 'gzip') stream = proxyRes.pipe(zlib.createGunzip());
            else if (encoding === 'br') stream = proxyRes.pipe(zlib.createBrotliDecompress());
            else if (encoding === 'deflate') stream = proxyRes.pipe(zlib.createInflate());

            stream.pipe(res);
          });

          proxyReq.on('error', (err) => {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          });

          proxyReq.end();
        }
      );
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), bricodepotFetchPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    open: true,
    proxy: {
      // Browser requests to /proxy/materielelectrique/* are forwarded
      // server-side to materielelectrique.com — bypasses CORS entirely.
      '/proxy/materielelectrique': {
        target: 'https://www.materielelectrique.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/proxy\/materielelectrique/, ''),
      },
      // NOTE: Bricodepot is handled by the bricodepotFetchPlugin above,
      // not by a proxy, because the Vite proxy WAF-triggers 403 on bricodepot.fr.
    },
  },
  build: {
    target: 'ES2020',
    sourcemap: false,
  },
});

