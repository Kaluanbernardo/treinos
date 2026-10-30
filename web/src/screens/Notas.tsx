import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowLeft, CalendarClock, Dumbbell, FileText, Lightbulb, MessageSquareText, type LucideIcon } from 'lucide-react'
import { useNotes } from '../lib/api'
import { go } from '../lib/router'
import type { BotNote } from '../lib/types'
import { capitalize, dm, longDay, todaySP, addDays, TZ } from '../lib/format'
import { Card, ErrorState, IconButton, Skeleton } from '../components/ui'

const KIND: Record<BotNote['kind'], { label: string; Icon: LucideIcon; cls: string }> = {
  decisao: { label: 'Decisão', Icon: Lightbulb, cls: 'bg-lime/15 text-lime' },
  carga: { label: 'Carga', Icon: Dumbbell, cls: 'bg-protein/15 text-protein' },
  remarcacao: { label: 'Remarcação', Icon: CalendarClock, cls: 'bg-fat/15 text-fat' },
  alerta: { label: 'Alerta', Icon: AlertTriangle, cls: 'bg-warn/15 text-warn' },
  resumo: { label: 'Resumo', Icon: FileText, cls: 'bg-ok/15 text-ok' },
  nota: { label: 'Nota', Icon: MessageSquareText, cls: 'bg-line text-muted' },
}

const dayOf = (ts: string) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(ts))
const timeOf = (ts: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(ts))

export function Notas(_: { email: string }) {
  const notes = useNotes()
  const [kind, setKind] = useState<BotNote['kind'] | null>(null)
  useEffect(() => { localStorage.setItem('notes_seen_at', String(Date.now())) }, [notes.data])

  const all = notes.data ?? []
  const counts = new Map<BotNote['kind'], number>()
  for (const n of all) counts.set(n.kind, (counts.get(n.kind) ?? 0) + 1)
  const groups = new Map<string, BotNote[]>()
  for (const n of all.filter((x) => !kind || x.kind === kind)) {
    const d = dayOf(n.created_at)
    groups.set(d, [...(groups.get(d) ?? []), n])
  }
  const today = todaySP()
  const label = (d: string) => (d === today ? 'Hoje' : d === addDays(today, -1) ? 'Ontem' : capitalize(longDay(d)))

  return (
    <div className="flex flex-col gap-4 lg:mx-auto lg:w-full lg:max-w-2xl">
      <header className="flex items-center gap-1 pt-1">
        <IconButton label="Voltar" onClick={() => (history.length > 1 ? history.back() : go('hoje'))}><ArrowLeft size={24} /></IconButton>
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em]">Notas</h1>
        {all.length > 0 && <span className="ml-auto pr-1 text-sm tabular-nums text-muted">{all.length}</span>}
      </header>

      {counts.size > 1 && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="radiogroup" aria-label="Tipo de nota">
          <Chip on={!kind} onClick={() => setKind(null)}>Todas</Chip>
          {(Object.keys(KIND) as BotNote['kind'][]).filter((k) => counts.has(k)).map((k) => {
            const K = KIND[k]
            return <Chip key={k} on={kind === k} onClick={() => setKind(kind === k ? null : k)}><K.Icon size={15} aria-hidden="true" />{K.label}<span className="opacity-60">{counts.get(k)}</span></Chip>
          })}
        </div>
      )}

      {notes.isError ? <ErrorState what="as notas" onRetry={() => notes.refetch()} /> : notes.isPending ? <Skeleton className="h-64" /> : groups.size === 0 ? (
        <Card className="flex items-center gap-3">
          <MessageSquareText size={24} className="shrink-0 text-muted" aria-hidden="true" />
          <p className="text-muted"><span className="font-medium text-fg">Nenhuma nota ainda.</span> Ajustes de carga, remarcações e resumos do assistente aparecem aqui.</p>
        </Card>
      ) : (
        [...groups.entries()].map(([d, list]) => (
          <section key={d} aria-label={label(d)}>
            <h2 className="px-1 text-sm font-semibold text-muted">{label(d)}{d === today || d === addDays(today, -1) ? ` · ${dm(d)}` : ''}</h2>
            <ol className="mt-2">
              {list.map((n, idx) => {
                const k = KIND[n.kind] ?? KIND.nota
                return (
                  <li key={n.id} className="relative flex gap-3 pb-3">
                    {idx < list.length - 1 && <span className="absolute top-11 bottom-0 left-[19px] w-0.5 rounded-full bg-line" aria-hidden="true" />}
                    <span className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${k.cls}`} aria-hidden="true"><k.Icon size={18} /></span>
                    <div className="min-w-0 flex-1 rounded-[var(--radius-card)] bg-card px-4 py-3">
                      <p className="flex items-baseline justify-between gap-2 text-sm">
                        <span className={`font-semibold ${k.cls.split(' ').find((c) => c.startsWith('text-'))}`}>{k.label}</span>
                        <span className="tabular-nums text-muted">{timeOf(n.created_at)}</span>
                      </p>
                      <p className="mt-1 whitespace-pre-line text-[16px] leading-relaxed">{n.text}</p>
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>
        ))
      )}
    </div>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onClick}
      className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors duration-150 ${on ? 'bg-fg text-bg' : 'bg-card-2 text-muted hover:text-fg'}`}>
      {children}
    </button>
  )
}
