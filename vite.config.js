import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
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
        },
    },
    build: {
        target: 'ES2020',
        sourcemap: false,
    },
});
