import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import https from 'node:https';
import zlib from 'node:zlib';
// ── Bricodepot server-side fetch plugin ───────────────────────────────────────
// The Vite proxy approach sends a Host header that Bricodepot's WAF blocks (403).
// This plugin handles /api/bricodepot-page?path=<url-path> entirely in Node,
// which works reliably (proven by probe: no cookies needed, 200 every time).
function bricodepotFetchPlugin() {
    return {
        name: 'bricodepot-fetch',
        configureServer: function (server) {
            server.middlewares.use('/api/bricodepot-page', function (req, res) {
                var _a, _b;
                var qs = new URL((_a = req.url) !== null && _a !== void 0 ? _a : '', 'http://localhost').searchParams;
                var path = (_b = qs.get('path')) !== null && _b !== void 0 ? _b : '';
                if (!path || !path.startsWith('catalogue/')) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'invalid path' }));
                    return;
                }
                var options = {
                    hostname: 'www.bricodepot.fr',
                    path: "/".concat(path),
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
                var proxyReq = https.request(options, function (proxyRes) {
                    var _a, _b;
                    // Follow redirects manually (max 3)
                    if (proxyRes.statusCode &&
                        proxyRes.statusCode >= 300 &&
                        proxyRes.statusCode < 400 &&
                        proxyRes.headers['location']) {
                        res.writeHead(proxyRes.statusCode, { Location: proxyRes.headers['location'] });
                        res.end();
                        return;
                    }
                    res.writeHead((_a = proxyRes.statusCode) !== null && _a !== void 0 ? _a : 200, {
                        'Content-Type': 'text/html; charset=utf-8',
                        'Cache-Control': 'no-store',
                    });
                    var encoding = (_b = proxyRes.headers['content-encoding']) !== null && _b !== void 0 ? _b : '';
                    var stream = proxyRes;
                    if (encoding === 'gzip')
                        stream = proxyRes.pipe(zlib.createGunzip());
                    else if (encoding === 'br')
                        stream = proxyRes.pipe(zlib.createBrotliDecompress());
                    else if (encoding === 'deflate')
                        stream = proxyRes.pipe(zlib.createInflate());
                    stream.pipe(res);
                });
                proxyReq.on('error', function (err) {
                    res.writeHead(502, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                });
                proxyReq.end();
            });
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
                rewrite: function (path) { return path.replace(/^\/proxy\/materielelectrique/, ''); },
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
