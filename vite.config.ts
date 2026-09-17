import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Build stamp so the running app can tell whether it is on the newest code.
const BUILD_ID = new Date().toISOString()

export default defineConfig({
  base: './',
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['sprites/**/*', 'bg/**/*', 'items/**/*', 'misc/**/*', 'audio/**/*'],
      manifest: {
        name: 'Kit Nugget Klimt',
        short_name: 'Kit Nugget',
        description: 'Tafels oefenen met Kit Nugget',
        lang: 'nl',
        start_url: './index.html',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#1b1430',
        theme_color: '#1b1430',
        icons: [
          { src: 'misc/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'misc/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'misc/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Fresh code wins: the SW takes over immediately on every new build.
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,webp,png,svg,json,m4a,mp3,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // Never serve a stale shell: try the network first, fall back to cache offline.
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: { cacheName: 'kn-pages', networkTimeoutSeconds: 4 },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
} as any)
