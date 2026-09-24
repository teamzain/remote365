import { defineConfig, loadEnv } from 'vite';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import react from '@vitejs/plugin-react';

// Single source of truth for the backend: VITE_SERVER_HOST in .env.<mode>
//   .env.prod        -> remote365.ai
//   .env.preprod     -> pp.remote365.ai
//   .env.development -> pp.remote365.ai  (npm run dev)
// API origin, signaling WSS and the auto-update feed are all derived from it.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const host = env.VITE_SERVER_HOST || 'pp.remote365.ai';
  const usesPlainProtocol = /^(localhost|\d{1,3}(?:\.\d{1,3}){3})(:\d+)?$/i.test(host);
  const devProxyTarget = `${usesPlainProtocol ? 'http' : 'https'}://${host}`;

  return {
    server: {
      port: 5173,
      host: '127.0.0.1',
      proxy: {
        '/api': { target: devProxyTarget, changeOrigin: true },
        '/devices': { target: devProxyTarget, changeOrigin: true },
      },
    },
    plugins: [
      react(),
      // VITE_RENDERER_ONLY=1 serves just the renderer (no dev Electron) so a
      // page can be checked in an ordinary browser tab.
      process.env.VITE_RENDERER_ONLY === '1' ? null : electron([
        {
          entry: 'src/main/index.ts',
          vite: {
            build: {
              outDir: 'dist-electron/main',
              rollupOptions: {
                external: ['ws', 'bufferutil', 'utf-8-validate', 'node-datachannel', '@remotelink/native-capture', '@remotelink/native-input']
              }
            },
          },
        },
        {
          entry: 'src/preload/index.ts',
          onstart(options) {
            options.reload()
          },
          vite: {
            build: {
              outDir: 'dist-electron/preload'
            },
          },
        },
        {
          // Stream utilityProcess (capture/encode/WebRTC/input decoupling — see
          // docs/capture-service-decoupling.md). Built but only forked when
          // CONNECT_X_STREAM_WORKER=1, so default builds are unaffected.
          entry: 'src/main/hostStream.worker.ts',
          vite: {
            build: {
              outDir: 'dist-electron/stream',
              rollupOptions: {
                external: ['ws', 'bufferutil', 'utf-8-validate', 'node-datachannel', '@remotelink/native-capture', '@remotelink/native-input']
              }
            },
          },
        },
      ]),
      renderer({
        nodeIntegration: true,
      }),
    ],
  };
});
