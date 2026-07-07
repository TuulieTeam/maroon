import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Production is served from https://tuulieteam.github.io/maroon/ (GitHub Pages project page);
  // dev stays at / so localhost:3001 and the preview tooling keep working unchanged.
  base: command === 'build' ? '/maroon/' : '/',
  // The build stamp shown in the hub footer — the antidote to a service worker pinning a stale
  // build during the weekly drop cadence ("is my mate on the new version?" answered at a glance).
  define: {
    __BUILD_STAMP__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')),
  },
  plugins: [
    react(),
    // The Daily is a ritual, and rituals live on the phone home screen. autoUpdate keeps mates on
    // the newest drop without an update prompt; everything is precached (fully offline-capable —
    // the whole game is client-side and deterministic).
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Maroon · State of Origin',
        short_name: 'Maroon',
        description: 'The text-broadcast State of Origin dynasty game. Unapologetically Queensland.',
        theme_color: '#6a0f2b',
        background_color: '#120308',
        display: 'standalone',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: {
    // Honour an externally assigned port (e.g. preview tooling) but default to 3001.
    port: Number(process.env.PORT) || 3001,
    strictPort: false,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // The calibration / causal-chain / color suites are Monte-Carlo: each runs hundreds of full
    // 80-minute match simulations. The Pass-1 kicking game makes every match richer (more kick +
    // outcome events per set), so per-sim cost rose; under parallel load the old 5s default tipped
    // a couple of these heavy statistical tests over. A generous per-test timeout keeps them green
    // without weakening any sample size or assertion.
    testTimeout: 30000,
  },
}))
