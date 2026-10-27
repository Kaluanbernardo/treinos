import { useSyncExternalStore } from 'react'

/**
 * Tema claro / escuro / sistema. A escolha fica no localStorage; o script inline do index.html aplica a
 * mesma regra antes do primeiro paint (sem flash). Mantenha KEY e as cores de THEME_COLOR iguais às de lá.
 */
export type ThemePref = 'light' | 'dark' | 'system'
export type Theme = 'light' | 'dark'

const KEY = 'theme'
/** cor da barra do sistema = fundo do app em cada tema */
export const THEME_COLOR: Record<Theme, string> = { light: '#E8ECF1', dark: '#0E1116' }

const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: light)') : null
const listeners = new Set<() => void>()

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch { return 'system' }
}

let pref = readPref()

const resolve = (p: ThemePref): Theme => (p === 'system' ? (media?.matches ? 'light' : 'dark') : p)

function apply() {
  const theme = resolve(pref)
  const root = document.documentElement
  root.dataset.theme = theme
  // com escolha manual, as duas metas (por media query) recebem a cor do tema escolhido
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    const scheme: Theme = m.media.includes('light') ? 'light' : 'dark'
    m.content = THEME_COLOR[pref === 'system' ? scheme : theme]
  })
  document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
    ?.setAttribute('content', theme === 'light' ? 'default' : 'black-translucent')
}

media?.addEventListener('change', () => {
  if (pref !== 'system') return
  apply()
  listeners.forEach((l) => l())
})

export function setThemePref(next: ThemePref) {
  pref = next
  try {
    if (next === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, next)
  } catch { /* modo privado: vale só nesta aba */ }
  apply()
  listeners.forEach((l) => l())
}

const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb) } }

/** escolha atual + tema efetivo (o que está na tela) */
export function useTheme() {
  const p = useSyncExternalStore(subscribe, () => pref)
  const theme = useSyncExternalStore(subscribe, () => resolve(pref))
  return { pref: p, theme, setPref: setThemePref }
}
