import { CalendarDays, NotebookText, SlidersHorizontal, type LucideIcon } from 'lucide-react'
import { useNotes } from '../lib/api'
import { go } from '../lib/router'
import { TABS, type Tab } from './BottomNav'
import { WeekGoalMini } from './training'

// Barra lateral do desktop (lg+): as mesmas abas da barra de baixo + Agenda, Notas e Configurações,
// que no celular abrem pelo Hoje. Embaixo, o contador da meta semanal (sempre à vista no desktop).
export type NavId = Tab | 'agenda' | 'notas' | 'config'

const EXTRA: { id: NavId; label: string; Icon: LucideIcon }[] = [
  { id: 'agenda', label: 'Agenda', Icon: CalendarDays },
]
const CONFIG = { id: 'config' as const, label: 'Configurações', Icon: SlidersHorizontal }

export function SideNav({ active }: { active: NavId | null }) {
  const notes = useNotes()
  const seen = Number(localStorage.getItem('notes_seen_at') ?? 0)
  const unread = (notes.data ?? []).filter((n) => Date.parse(n.created_at) > seen).length
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
        <Item id="notas" label="Notas" Icon={NotebookText} on={active === 'notas'} badge={unread} />
      </ul>
      <div className="mt-auto flex flex-col gap-3">
        <WeekGoalMini onOpen={() => go('treino')} />
        <ul className="flex flex-col gap-1 border-t border-line pt-3">
          <Item {...CONFIG} on={active === 'config'} />
        </ul>
      </div>
    </nav>
  )
}

function Item({ id, label, Icon, on, badge = 0 }: { id: NavId; label: string; Icon: LucideIcon; on: boolean; badge?: number }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => go(id)}
        aria-current={on ? 'page' : undefined}
        aria-label={badge ? `${label} (${badge} novas)` : undefined}
        className={`flex h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-medium transition-colors duration-150 ${
          on ? 'bg-lime/15 text-fg' : 'text-muted hover:bg-card hover:text-fg'}`}
      >
        <Icon size={22} strokeWidth={on ? 2.4 : 2} className={on ? 'text-lime' : ''} aria-hidden="true" />
        <span className="flex-1">{label}</span>
        {badge > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full action-fill px-1.5 text-[11px] font-bold tabular-nums" aria-hidden="true">{badge}</span>}
      </button>
    </li>
  )
}
