export type Tab = 'hoje' | 'treino' | 'evolucao' | 'nutricao' | 'agenda'

export const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'hoje', label: 'Hoje', icon: 'M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10' },
  { id: 'treino', label: 'Treino', icon: 'M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12' },
  { id: 'evolucao', label: 'Evolução', icon: 'M3 17l6-6 4 4 8-8M15 7h6v6' },
  { id: 'nutricao', label: 'Nutrição', icon: 'M12 3a9 9 0 1 0 9 9M12 3v9h9M12 3a9 9 0 0 1 9 9' },
  { id: 'agenda', label: 'Agenda', icon: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4' },
]

export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {TABS.map((t) => {
          const active = t.id === tab
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onChange(t.id)}
                aria-current={active ? 'page' : undefined}
                className={`flex h-16 w-full flex-col items-center justify-center gap-1 text-xs transition-colors duration-150 ${
                  active ? 'text-lime' : 'text-muted'
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}
                     strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={t.icon} />
                </svg>
                {t.label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
