import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'
import pkg from './package.json' with { type: 'json' }

const sha = (() => { try { return execSync('git rev-parse --short HEAD').toString().trim() } catch { return 'dev' } })()

export default defineConfig({
  base: '/treinos/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_SHA__: JSON.stringify(process.env.GITHUB_SHA?.slice(0, 7) ?? sha),
    __BUILD_DATE__: JSON.stringify(new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })),
  },
  build: {
    rollupOptions: { output: { manualChunks: (id: string) => (id.includes('recharts') || id.includes('d3-') ? 'charts' : id.includes('@supabase') ? 'supabase' : undefined) } },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Fitness Kaluan',
        short_name: 'Fitness',
        description: 'Painel pessoal de treino, nutrição e evolução.',
        lang: 'pt-BR',
        start_url: '/treinos/',
        scope: '/treinos/',
        display: 'standalone',
        orientation: 'portrait',
        // cores do splash/barra antes do JS: claro como base e escuro via user_preferences.color_scheme_dark
        // (manifest incubations, Chromium). Depois do load, as metas theme-color do index.html mandam.
        theme_color: '#E8ECF1',
        background_color: '#E8ECF1',
        ...({ user_preferences: { color_scheme_dark: { theme_color: '#0E1116', background_color: '#0E1116' } } } as object),
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      scope: '/treinos/',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        // dados do Supabase nunca vão para o cache do service worker
        navigateFallbackDenylist: [/^\/auth/, /^\/rest/, /^\/storage/],
      },
    }),
  ],
})
