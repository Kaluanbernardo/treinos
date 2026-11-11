import type { ReactNode } from 'react'
import { BottomNav, type Tab } from './BottomNav'
import { SideNav, type NavId } from './SideNav'
import { Toaster } from './ui'

/**
 * Celular: coluna única (max-w-lg) + barra de baixo, igual sempre foi.
 * Desktop (lg+): barra lateral fixa à esquerda; conteúdo até 5xl; em telas ≥ 1400 px (`wide`) até 1320 px.
 * `fullscreen` (treino em andamento) esconde a barra de baixo e o respiro do topo; a lateral fica.
 */
export function AppShell({ active, fullscreen, children }: { active: NavId | null; fullscreen: boolean; children: ReactNode }) {
  const tab = active === 'agenda' || active === 'config' || active === 'notas' ? null : (active as Tab | null)
  return (
    <div className="min-h-[100dvh] lg:flex">
      <SideNav active={active} />
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col lg:max-w-5xl lg:min-w-0 lg:flex-1 wide:max-w-[1320px]">
        <main
          className={`flex-1 px-4 lg:px-8 ${fullscreen ? '' : 'pt-[max(env(safe-area-inset-top),16px)] pb-8 lg:pt-8 lg:pb-12'}`}
        >
          {children}
        </main>
        {!fullscreen && <BottomNav tab={tab} />}
      </div>
      <Toaster />
    </div>
  )
}
