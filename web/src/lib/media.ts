import { useSyncExternalStore } from 'react'

/** true enquanto a media query casa (ex.: '(min-width: 1024px)' = desktop lg). */
export function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => { const m = window.matchMedia(query); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb) },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
