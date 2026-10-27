import { useEffect } from 'react'
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
  useEffect(() => { localStorage.setItem('notes_seen_at', String(Date.now())) }, [notes.data])

  const groups = new Map<string, BotNote[]>()
  for (const n of notes.data ?? []) {
    const d = dayOf(n.created_at)
    groups.set(d, [...(groups.get(d) ?? []), n])
  }
  const today = todaySP()
  const label = (d: string) => (d === today ? 'Hoje' : d === addDays(today, -1) ? 'Ontem' : capitalize(longDay(d)))

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-1 pt-1">
        <IconButton label="Voltar" onClick={() => (history.length > 1 ? history.back() : go('hoje'))}><ArrowLeft size={24} /></IconButton>
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em]">Notas do assistente</h1>
        </div>
      </header>
      <p className="-mt-2 px-1 text-[15px] text-muted">Decisões, ajustes de carga, remarcações e alertas registrados pelo chat.</p>

      {notes.isError ? <ErrorState what="as notas" onRetry={() => notes.refetch()} /> : notes.isPending ? <Skeleton className="h-64" /> : groups.size === 0 ? (
        <Card>
          <MessageSquareText size={28} className="text-muted" aria-hidden="true" />
          <p className="mt-3 text-lg font-semibold">Nenhuma nota ainda</p>
          <p className="mt-1 text-[15px] leading-relaxed text-muted">
            Quando o assistente ajustar uma carga, remarcar um treino, tomar uma decisão sobre o plano ou mandar o resumo
            da semana, o registro aparece aqui, do mais novo para o mais antigo.
          </p>
        </Card>
      ) : (
        [...groups.entries()].map(([d, list]) => (
          <section key={d} aria-label={label(d)}>
            <h2 className="px-1 text-sm font-semibold text-muted">{label(d)}{d !== today && d !== addDays(today, -1) ? '' : ` · ${dm(d)}`}</h2>
            <ul className="mt-2 flex flex-col gap-2">
              {list.map((n) => {
                const k = KIND[n.kind] ?? KIND.nota
                return (
                  <li key={n.id} className="rounded-[var(--radius-card)] bg-card p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${k.cls}`}>
                        <k.Icon size={14} aria-hidden="true" /> {k.label}
                      </span>
                      <span className="text-sm tabular-nums text-muted">{timeOf(n.created_at)}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-line text-[16px] leading-relaxed">{n.text}</p>
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
