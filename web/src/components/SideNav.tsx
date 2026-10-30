import { CalendarDays, SlidersHorizontal, type LucideIcon } from 'lucide-react'
import { go } from '../lib/router'
import { TABS, type Tab } from './BottomNav'

// Barra lateral do desktop (lg+): as mesmas abas da barra de baixo + Agenda e Configurações,
// que no celular abrem pelo Hoje.
export type NavId = Tab | 'agenda' | 'config'

const EXTRA: { id: NavId; label: string; Icon: LucideIcon }[] = [
  { id: 'agenda', label: 'Agenda', Icon: CalendarDays },
]
const CONFIG = { id: 'config' as const, label: 'Configurações', Icon: SlidersHorizontal }

export function SideNav({ active }: { active: NavId | null }) {
  return (
    <nav
      aria-label="Navegação principal"
      className="sticky top-0 hidden h-[100dvh] w-[232px] shrink-0 flex-col border-r border-line bg-bg px-3 py-6 lg:flex"
    >
      <p className="mb-6 flex items-center gap-2 px-3 text-lg font-bold tracking-[-0.02em]">
        <span className="h-2.5 w-2.5 rounded-full bg-lime" aria-hidden="true" /> Fitness
      </p>
      <ul className="flex flex-col gap-1">
        {[...TABS, ...EXTRA].map((t) => <Item key={t.id} {...t} on={t.id === active} />)}
      </ul>
      <ul className="mt-auto flex flex-col gap-1 border-t border-line pt-3">
        <Item {...CONFIG} on={active === 'config'} />
      </ul>
    </nav>
  )
}

function Item({ id, label, Icon, on }: { id: NavId; label: string; Icon: LucideIcon; on: boolean }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => go(id)}
        aria-current={on ? 'page' : undefined}
        className={`flex h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-medium transition-colors duration-150 ${
          on ? 'bg-lime/15 text-fg' : 'text-muted hover:bg-card hover:text-fg'}`}
      >
        <Icon size={22} strokeWidth={on ? 2.4 : 2} className={on ? 'text-lime' : ''} aria-hidden="true" />
        {label}
      </button>
    </li>
  )
}
