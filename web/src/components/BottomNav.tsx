import { CalendarDays, Dumbbell, Home, PieChart, TrendingUp, type LucideIcon } from 'lucide-react'
import { go } from '../lib/router'

export type Tab = 'hoje' | 'treino' | 'evolucao' | 'nutricao' | 'agenda'

export const TABS: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: 'hoje', label: 'Hoje', Icon: Home },
  { id: 'treino', label: 'Treino', Icon: Dumbbell },
  { id: 'evolucao', label: 'Evolução', Icon: TrendingUp },
  { id: 'nutricao', label: 'Nutrição', Icon: PieChart },
  { id: 'agenda', label: 'Agenda', Icon: CalendarDays },
]

export function BottomNav({ tab }: { tab: Tab | null }) {
  return (
    <nav
      aria-label="Navegação principal"
      className="sticky bottom-0 z-20 border-t border-line bg-bg/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {TABS.map(({ id, label, Icon }) => {
          const active = id === tab
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => go(id)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex h-16 w-full flex-col items-center justify-center gap-1 text-xs font-medium transition-colors duration-150 ${
                  active ? 'text-lime' : 'text-muted hover:text-fg'
                }`}
              >
                {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-lime" aria-hidden="true" />}
                <Icon size={24} strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
                {label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
