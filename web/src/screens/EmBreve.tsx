import { TABS, type Tab } from '../components/BottomNav'

export function EmBreve({ tab }: { tab: Tab }) {
  const label = TABS.find((t) => t.id === tab)?.label
  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center gap-2 text-center">
      <h1 className="text-2xl font-semibold">{label}</h1>
      <p className="text-muted">Em breve (F1)</p>
    </section>
  )
}
