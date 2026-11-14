import { useState } from 'react'
import { CalendarClock, ChevronRight, Dumbbell, MessageCircle, Timer, Trophy } from 'lucide-react'
import { useActiveSession, usePlan, useSessions, useTemplates, useToday } from '../lib/api'
import { go } from '../lib/router'
import { useMedia } from '../lib/media'
import type { Template } from '../lib/types'
import { capitalize, diffDays, intFmt, todaySP, wdShort } from '../lib/format'
import { type HistoryRow as Row, historyRows } from '../lib/training'
import { Badge, Button, Card, ErrorState, Skeleton } from '../components/ui'
import { FichaSheet } from '../components/FichaSheet'
import { MODALITY } from '../components/modality'
import { Big } from '../components/viz'
import { STATUS, StatusIcon, TrainingCalendar, TypeCountsCard, WeekGoalCard } from '../components/training'

/** "A — Ombros, braços e core" → letra "A" no selo e "Ombros, braços e core" no título (o nome não se repete). */
function fichaLabel(name: string) {
  const m = name.match(/^(\S{1,3}) — (.+)$/)
  if (m) return { mark: m[1], title: m[2] }
  const two = name.match(/^(\p{L})\p{L}* (\p{L})$/u)
  return { mark: two ? `${two[1]}${two[2]}` : name.slice(0, 1).toUpperCase(), title: name }
}

/**
 * Celular: meta semanal → calendário → fichas → quantas vezes → histórico (uma coluna).
 * Desktop (lg+): grade de 12 colunas; meta | quantas vezes, calendário na largura toda, fichas | histórico.
 */
export function Treino() {
  const templates = useTemplates()
  const sessions = useSessions(60)
  const today = useToday()
  const active = useActiveSession()
  const [open, setOpen] = useState<Template | null>(null)
  const wide = useMedia('(min-width: 1024px)')

  const lastBy = new Map<string, string>()
  // pelo nome da ficha: conta também as versões aposentadas com o mesmo nome (B curta → B, C+ → C)
  for (const s of sessions.data ?? []) if (s.template_id && !lastBy.has(s.title) && (s.status === 'feito' || s.status === 'parcial')) lastBy.set(s.title, s.date)
  const todayStrength = (today.data ?? []).find((i) => i.active && i.template_id && i.modality === 'musculacao' && !i.session_status)

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
      <h1 className="pt-1 text-[28px] font-bold leading-tight tracking-[-0.02em] lg:col-span-12">Treino</h1>

      {active.data && (
        <Card tone="raised" className="ring-1 ring-lime/40 lg:col-span-12">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Badge tone="lime"><span className="live-dot h-1.5 w-1.5 rounded-full bg-lime" aria-hidden="true" /> em andamento</Badge>
              <p className="mt-2 truncate text-2xl font-bold">{active.data.title}</p>
            </div>
            <Big size="md" value={active.data.n_sets} unit={active.data.n_sets === 1 ? 'série' : 'séries'} />
          </div>
          <Button variant="primary" size="xl" className="mt-4 w-full lg:w-auto lg:min-w-80" onClick={() => go(`sessao/${active.data!.id}`)}>
            <Dumbbell size={22} aria-hidden="true" /> Continuar treino
          </Button>
        </Card>
      )}

      <div className="lg:order-1 lg:col-span-5 lg:flex lg:flex-col lg:self-stretch lg:[&>*]:flex-1"><WeekGoalCard fill={wide} nWeeks={wide ? 10 : 8} /></div>
      <div className="lg:order-3 lg:col-span-12"><TrainingCalendar /></div>

      <section aria-labelledby="fichas-title" className="lg:order-4 lg:col-span-5">
        <h2 id="fichas-title" className="mb-3 hidden text-xl font-semibold lg:block">Fichas</h2>
        {templates.isError ? (
          <ErrorState what="as fichas" onRetry={() => templates.refetch()} />
        ) : templates.isPending ? (
          <Skeleton className="h-72" />
        ) : (
          <ul className="flex flex-col gap-3" aria-label="Fichas">
            {templates.data!.filter((t) => t.active).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map((t) => {
              const isToday = todayStrength?.template_id === t.id
              const last = lastBy.get(t.name)
              const ago = last ? diffDays(todaySP(), last) : null
              const { mark, title } = fichaLabel(t.name)
              const when = ago == null ? 'ainda não feito' : ago === 0 ? 'feito hoje' : `há ${ago} ${ago === 1 ? 'dia' : 'dias'}`
              return (
                <li key={t.id}>
                  <button
                    type="button" onClick={() => setOpen(t)}
                    aria-label={`${t.name}${isToday ? ', hoje' : ''}: ${t.template_exercises.length} exercícios, ${t.est_minutes ?? 60} min, ${when}`}
                    className={`flex min-h-[88px] w-full items-center gap-4 rounded-[var(--radius-card)] p-4 text-left transition-colors duration-150 ${isToday ? 'bg-card-2 ring-1 ring-lime/50' : 'bg-card hover:bg-card-2'}`}
                  >
                    <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold ${isToday ? 'action-fill' : 'bg-card-2 text-fg'}`} aria-hidden="true">
                      {mark}
                    </span>
                    <span className="min-w-0 flex-1" aria-hidden="true">
                      <span className="block text-lg font-semibold leading-snug [text-wrap:balance]">{title}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm tabular-nums text-muted">
                        <span className="flex items-center gap-1"><Dumbbell size={14} />{t.template_exercises.length}</span>
                        <span className="flex items-center gap-1"><Timer size={14} />{t.est_minutes ?? 60} min</span>
                        <span>{when}</span>
                      </span>
                    </span>
                    {isToday ? <Badge tone="lime">hoje</Badge> : <ChevronRight size={20} className="shrink-0 text-muted" aria-hidden="true" />}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className="lg:order-2 lg:col-span-7"><TypeCountsCard /></div>

      <div className="lg:order-5 lg:col-span-7 lg:row-span-2"><History /></div>

      <FichaSheet template={open} onClose={() => setOpen(null)} />
    </div>
  )
}

// ---------------------------------------------------------------- histórico
/** Sessões feitas / parciais / faltadas + ocorrências puladas do plano, com ícone de status em cada linha. */
function History() {
  const sessions = useSessions(60)
  const list = sessions.data ?? []
  const from = list.length ? list[list.length - 1].date : todaySP()
  const plan = usePlan(from, todaySP())
  const [all, setAll] = useState(false)
  const rows = historyRows(list, plan.data ?? [])
  const shown = all ? rows : rows.slice(0, 10)
  const counts = rows.reduce((m, r) => m.set(r.status, (m.get(r.status) ?? 0) + 1), new Map<string, number>())

  return (
    <section aria-labelledby="hist-title">
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-1 lg:mt-0">
        <h2 id="hist-title" className="text-xl font-semibold">Histórico</h2>
        {rows.length > 0 && (
          <p className="flex flex-wrap gap-x-3 text-sm tabular-nums text-muted">
            {(['feito', 'parcial', 'faltou', 'pulado'] as const).filter((k) => counts.get(k)).map((k) => (
              <span key={k} className="inline-flex items-center gap-1"><span className={STATUS[k].text}>{STATUS[k].icon(13)}</span>{counts.get(k)} {PLURAL[k][counts.get(k) === 1 ? 0 : 1]}</span>
            ))}
          </p>
        )}
      </div>
      <div className="mt-3">
        {sessions.isError ? (
          <ErrorState what="o histórico" onRetry={() => sessions.refetch()} />
        ) : sessions.isPending ? (
          <Skeleton className="h-40" />
        ) : rows.length === 0 ? (
          <Card><p className="text-muted">Nenhuma sessão ainda. Cada treino feito ou faltado aparece aqui.</p></Card>
        ) : (
          <Card className="py-1">
            <ul className="divide-y divide-line">{shown.map((r) => <HistoryRow key={r.key} r={r} />)}</ul>
            {rows.length > shown.length && (
              <Button variant="ghost" className="w-full" onClick={() => setAll(true)}>Ver todas ({rows.length})</Button>
            )}
          </Card>
        )}
      </div>
    </section>
  )
}

const PLURAL: Record<'feito' | 'parcial' | 'faltou' | 'pulado', [string, string]> = {
  feito: ['feito', 'feitos'], parcial: ['parcial', 'parciais'], faltou: ['falta', 'faltas'], pulado: ['pulado', 'pulados'],
}

/**
 * Data · ícone de status (cor + forma) · título e uma linha de detalhe (status em palavra, séries, remarcado,
 * PRs, origem chat) · volume da musculação. No celular o título nunca disputa espaço com selos.
 */
function HistoryRow({ r }: { r: Row }) {
  const s = r.session
  const strength = !!s && s.modality === 'musculacao' && s.n_sets > 0
  const muted = r.status === 'faltou' || r.status === 'pulado'
  const tone = STATUS[r.status].text === 'text-ok' ? '' : STATUS[r.status].text
  const day = `${wdShort(r.date)} ${Number(r.date.slice(8))}`
  const content = (
    <>
      <span className="w-10 shrink-0 text-center">
        <span className="block text-xs text-muted">{capitalize(wdShort(r.date))}</span>
        <span className="block text-lg font-bold leading-tight tabular-nums">{Number(r.date.slice(8))}</span>
      </span>
      <StatusIcon status={r.status} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${MODALITY[r.modality].bg} ${muted ? 'opacity-50' : ''}`} aria-hidden="true" />
          <span className={`truncate font-medium ${muted ? 'text-muted' : ''} ${r.status === 'pulado' ? 'line-through decoration-muted/60' : ''}`}>{r.title}</span>
        </span>
        <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-muted">
          <span className={`shrink-0 ${tone}`}>{STATUS[r.status].label}</span>
          {strength && <span className="shrink-0 tabular-nums">· {s!.n_sets} séries</span>}
          {r.rescheduled && <span className="inline-flex shrink-0 items-center gap-0.5 font-medium text-lime">· <CalendarClock size={13} aria-hidden="true" /> remarcado</span>}
          {s && s.n_prs > 0 && <span className="inline-flex shrink-0 items-center gap-0.5 font-semibold text-lime">· <Trophy size={13} aria-hidden="true" />{s.n_prs}<span className="sr-only"> recordes</span></span>}
          {r.status === 'pulado' && r.motivo && <span className="min-w-0 max-w-full truncate">· {r.motivo}</span>}
          {s?.source === 'bot' && <span className="inline-flex shrink-0 items-center gap-0.5">· <MessageCircle size={12} className="shrink-0" aria-hidden="true" /> chat</span>}
        </span>
      </span>
      {strength && (
        <span className="shrink-0 text-right">
          <span className="block font-semibold tabular-nums">{intFmt(s!.volume_kg)}</span>
          <span className="block text-xs text-muted">kg vol.</span>
        </span>
      )}
      {strength && <ChevronRight size={18} className="-ml-1 shrink-0 text-muted" aria-hidden="true" />}
    </>
  )
  return (
    <li>
      {strength ? (
        <button type="button" onClick={() => go(`sessao/${s!.id}`)} className="flex min-h-16 w-full items-center gap-3 py-2.5 text-left"
          aria-label={`${r.title}, ${day}: ${STATUS[r.status].label}. Abrir resumo`}>{content}</button>
      ) : (
        <div className="flex min-h-16 items-center gap-3 py-2.5" aria-label={`${r.title}, ${day}: ${STATUS[r.status].label}`}>{content}</div>
      )}
    </li>
  )
}
