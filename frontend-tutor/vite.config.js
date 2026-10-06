import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // vueDevTools() removed for tests compatibility
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'DevOps Mentor',
        short_name: 'DevOps Mentor',
        description: 'Ton mentor DevOps senior : des réponses recherchées, vérifiées et sourcées.',
        lang: 'fr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#06080c',
        background_color: '#06080c',
        categories: ['education', 'developer', 'productivity'],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        screenshots: [
          { src: 'screenshots/wide.png', sizes: '1440x900', type: 'image/png', form_factor: 'wide', label: 'DevOps Mentor sur ordinateur' },
          { src: 'screenshots/narrow.png', sizes: '390x844', type: 'image/png', form_factor: 'narrow', label: 'DevOps Mentor sur téléphone' },
        ],
        shortcuts: [
          { name: 'Nouvelle question', short_name: 'Question', url: '/?new=1', icons: [{ src: 'pwa-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        // Coquille de l'application précachée ; les gros modules (diagrammes) à la demande.
        globPatterns: ['index.html', 'assets/index-*.{js,css}', '*.{svg,png}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/assets/'),
            handler: 'CacheFirst',
            options: { cacheName: 'assets', expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 60 } },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            // Configuration du serveur : utile hors ligne pour afficher le modèle actif.
            urlPattern: ({ url }) => url.pathname === '/api/tutor/config',
            handler: 'NetworkFirst',
            options: { cacheName: 'api-config', networkTimeoutSeconds: 4 },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  build: {
    // Mermaid (diagrammes) est chargé à la demande : ses gros morceaux sont attendus.
    chunkSizeWarningLimit: 800,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.spec.ts',
        '**/*.spec.js',
        '**/vite.config.ts'
      ]
    }
  }
})
