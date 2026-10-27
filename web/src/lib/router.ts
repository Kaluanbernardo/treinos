import { useSyncExternalStore } from 'react'

/** Roteamento por hash (#/treino, #/sessao/<id>): funciona no GitHub Pages sem 404 e no PWA. */
export type Route =
  | { name: 'hoje' }
  | { name: 'treino' }
  | { name: 'sessao'; id: string }
  | { name: 'evolucao' }
  | { name: 'nutricao' }
  | { name: 'agenda' }
  | { name: 'notas' }
  | { name: 'config' }

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

export function parse(hash: string): Route {
  const [name, id] = hash.replace(/^#\/?/, '').split('/')
  switch (name) {
    case 'treino':
    case 'evolucao':
    case 'nutricao':
    case 'agenda':
    case 'notas':
    case 'config':
      return { name }
    case 'sessao':
      return id ? { name: 'sessao', id } : { name: 'treino' }
    default:
      return { name: 'hoje' }
  }
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return parse(hash)
}

export function go(path: string, opts: { replace?: boolean } = {}) {
  const target = `#/${path.replace(/^\/?/, '')}`
  if (opts.replace) window.location.replace(target)
  else window.location.hash = target
  window.scrollTo({ top: 0 })
}
