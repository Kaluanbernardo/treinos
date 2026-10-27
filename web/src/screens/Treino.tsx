import { useState } from 'react'
import { ChevronRight, Dumbbell, Flame, Play, Timer, Trophy } from 'lucide-react'
import {
  useActiveSession, useExerciseSessions, useSessions, useStartSession, useStreaks, useTemplates, useToday, useWeeklySummary,
} from '../lib/api'
import { go } from '../lib/router'
import type { SessionRow, Template } from '../lib/types'
import { capitalize, diffDays, dm, intFmt, todaySP, wdShort, weekStart } from '../lib/format'
import { Badge, Button, Card, ErrorState, Sheet, Skeleton, haptic, toast } from '../components/ui'
import { FichaDetail, historyByExercise } from '../components/Ficha'
import { MODALITY } from '../components/modality'
import { Big, PlanBars } from '../components/viz'

const monogram = (name: string) => name.replace(/^(\w)\w+ (\w)$/, '$1$2')

export function Treino() {
  const templates = useTemplates()
  const sessions = useSessions(40)
  const today = useToday()
  const active = useActiveSession()
  const start = useStartSession()
  const exHist = useExerciseSessions()
  const [open, setOpen] = useState<Template | null>(null)
  const [all, setAll] = useState(false)

  const lastBy = new Map<string, string>()
  for (const s of sessions.data ?? []) if (s.template_id && !lastBy.has(s.template_id) && s.status !== 'faltou') lastBy.set(s.template_id, s.date)
  const todayStrength = (today.data ?? []).find((i) => i.active && i.template_id && i.modality === 'musculacao' && !i.session_status)
  const history = (sessions.data ?? []).filter((s) => s.status !== 'em_andamento')
  const shown = all ? history : history.slice(0, 8)

  async function begin(t: Template) {
    haptic(15)
    if (active.data) { go(`sessao/${active.data.id}`); return }
    const plan = todayStrength?.template_id === t.id ? todayStrength : null
    try {
      const id = await start.mutateAsync({ template_id: t.id, modality: t.modality, slot_id: plan?.slot_id, override_id: plan?.override_id })
      go(`sessao/${id}`)
    } catch (e) {
      toast(`Não deu para iniciar: ${(e as Error).message}`, { tone: 'err' })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="pt-1 text-[28px] font-bold leading-tight tracking-[-0.02em]">Treino</h1>

      {active.data && (
        <Card tone="raised" className="ring-1 ring-lime/40">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Badge tone="lime"><span className="live-dot h-1.5 w-1.5 rounded-full bg-lime" aria-hidden="true" /> em andamento</Badge>
              <p className="mt-2 truncate text-2xl font-bold">{active.data.title}</p>
            </div>
            <Big size="md" value={active.data.n_sets} unit={active.data.n_sets === 1 ? 'série' : 'séries'} />
          </div>
          <Button variant="primary" size="xl" className="mt-4 w-full" onClick={() => go(`sessao/${active.data!.id}`)}>
            <Dumbbell size={22} aria-hidden="true" /> Continuar treino
          </Button>
        </Card>
      )}

      <FrequencyCard />

      {templates.isError ? (
        <ErrorState what="as fichas" onRetry={() => templates.refetch()} />
      ) : templates.isPending ? (
        <Skeleton className="h-72" />
      ) : (
        <section aria-labelledby="fichas-title">
          <h2 id="fichas-title" className="sr-only">Fichas</h2>
          <ul className="grid grid-cols-2 gap-3" aria-label="Fichas">
            {templates.data!.map((t) => {
              const isToday = todayStrength?.template_id === t.id
              const last = lastBy.get(t.id)
              const ago = last ? diffDays(todaySP(), last) : null
              return (
                <li key={t.id}>
                  <button
                    type="button" onClick={() => setOpen(t)}
                    className={`flex h-full min-h-[148px] w-full flex-col rounded-[var(--radius-card)] p-4 text-left transition-colors duration-150 ${isToday ? 'bg-card-2 ring-1 ring-lime/50' : 'bg-card hover:bg-card-2'}`}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className={`flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold ${isToday ? 'bg-lime text-bg' : 'bg-card-2 text-fg'}`} aria-hidden="true">
                        {monogram(t.name)}
                      </span>
                      {isToday && <Badge tone="lime">hoje</Badge>}
                    </span>
                    <span className="mt-auto pt-3 text-lg font-semibold leading-tight">{t.name}</span>
                    <span className="mt-1 flex items-center gap-3 text-sm tabular-nums text-muted">
                      <span className="flex items-center gap-1"><Dumbbell size={14} aria-hidden="true" />{t.template_exercises.length}</span>
                      <span className="flex items-center gap-1"><Timer size={14} aria-hidden="true" />{t.est_minutes ?? 60} min</span>
                    </span>
                    <span className={`mt-1 text-sm ${ago == null ? 'text-muted' : ago > 7 ? 'text-warn' : 'text-muted'}`}>
                      {ago == null ? 'ainda não feito' : ago === 0 ? 'feito hoje' : `há ${ago} ${ago === 1 ? 'dia' : 'dias'}`}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="hist-title">
        <div className="mt-2 flex items-baseline justify-between px-1">
          <h2 id="hist-title" className="text-xl font-semibold">Histórico</h2>
          {history.length > 0 && <span className="text-sm tabular-nums text-muted">{history.length} sessões</span>}
        </div>
        <div className="mt-3">
          {sessions.isError ? (
            <ErrorState what="o histórico" onRetry={() => sessions.refetch()} />
          ) : sessions.isPending ? (
            <Skeleton className="h-40" />
          ) : history.length === 0 ? (
            <Card><p className="text-muted">Nenhuma sessão ainda. Cada treino finalizado aparece aqui.</p></Card>
          ) : (
            <Card className="py-1">
              <ul className="divide-y divide-line">{shown.map((s) => <HistoryRow key={s.id} s={s} />)}</ul>
              {history.length > shown.length && (
                <Button variant="ghost" className="w-full" onClick={() => setAll(true)}>Ver todas ({history.length})</Button>
              )}
            </Card>
          )}
        </div>
      </section>

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.name ?? ''}>
        {open && (
          <>
            <dl className="grid grid-cols-3 divide-x divide-line rounded-2xl bg-bg/60 py-3 ring-1 ring-line">
              {[
                { l: 'exercícios', v: open.template_exercises.length },
                { l: 'séries', v: open.template_exercises.reduce((n, te) => n + te.sets, 0) },
                { l: 'minutos', v: `~${open.est_minutes ?? 60}` },
              ].map((x) => (
                <div key={x.l} className="px-3 text-center">
                  <dd className="text-2xl font-bold tabular-nums">{x.v}</dd>
                  <dt className="text-[13px] text-muted">{x.l}</dt>
                </div>
              ))}
            </dl>
            <div className="mt-3"><FichaDetail template={open} history={historyByExercise(exHist.data)} /></div>
            <div className="sticky -bottom-5 -mx-5 mt-2 border-t border-line bg-card px-5 pt-4 pb-5">
              <Button variant="primary" size="xl" className="w-full" onClick={() => begin(open)} disabled={start.isPending}>
                <Play size={22} fill="currentColor" aria-hidden="true" />
                {active.data ? 'Continuar treino em andamento' : `Iniciar ${open.name}`}
              </Button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  )
}

/** Musculação por semana: feito × planejado nas últimas 8 semanas. */
function FrequencyCard() {
  const weekly = useWeeklySummary()
  const streaks = useStreaks()
  if (weekly.isPending || streaks.isPending) return <Skeleton className="h-44" />
  if (weekly.isError) return null
  const cw = weekStart(todaySP())
  const weeks = (weekly.data ?? []).slice(-8)
  const s = (streaks.data ?? []).find((x) => x.modality === 'musculacao')
  const done = s?.this_week_done ?? 0
  const planned = s?.this_week_planned ?? 0
  return (
    <Card aria-labelledby="freq-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="freq-title" className="text-[13px] text-muted">Musculação esta semana</h2>
          <Big size="lg" className="mt-1" value={done} unit={`/${planned}`} />
        </div>
        {s && s.current_streak_weeks > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-kcal/12 px-3 py-1.5 text-sm font-semibold text-kcal">
            <Flame size={16} aria-hidden="true" /> {s.current_streak_weeks} {s.current_streak_weeks === 1 ? 'semana' : 'semanas'}
          </span>
        )}
      </div>
      {weeks.length >= 2 && (
        <div className="mt-4">
          <PlanBars color="var(--color-lime)" label="Treinos de musculação por semana: feitos sobre planejados"
            data={weeks.map((w) => ({ key: w.period_start, label: dm(w.period_start).slice(0, 5), done: w.by_modality?.musculacao?.done ?? 0, planned: w.by_modality?.musculacao?.planned ?? 0, current: w.period_start === cw }))} />
        </div>
      )}
    </Card>
  )
}

function HistoryRow({ s }: { s: SessionRow }) {
  const strength = s.modality === 'musculacao' && s.n_sets > 0
  const content = (
    <>
      <span className="w-11 shrink-0 text-center">
        <span className="block text-xs text-muted">{capitalize(wdShort(s.date))}</span>
        <span className="block text-lg font-bold leading-tight tabular-nums">{Number(s.date.slice(8))}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${MODALITY[s.modality].bg}`} aria-hidden="true" />
          <span className={`truncate font-medium ${s.status === 'faltou' ? 'text-muted' : ''}`}>{s.title}</span>
        </span>
        <span className="mt-0.5 block truncate text-sm text-muted">
          {s.status === 'faltou' ? 'faltou' : strength
            ? `${s.n_sets} séries${s.duration_min ? ` · ${s.duration_min} min` : ''}`
            : s.status === 'parcial' ? 'parcial' : 'feito'}
          {s.source === 'bot' && ' · chat'}
        </span>
      </span>
      {s.n_prs > 0 && <Badge tone="lime"><Trophy size={13} aria-hidden="true" /> {s.n_prs}<span className="sr-only"> recordes</span></Badge>}
      {strength && (
        <span className="shrink-0 text-right">
          <span className="block font-semibold tabular-nums">{intFmt(s.volume_kg)}</span>
          <span className="block text-xs text-muted">kg vol.</span>
        </span>
      )}
      {strength && <ChevronRight size={18} className="-ml-1 shrink-0 text-muted" aria-hidden="true" />}
    </>
  )
  return (
    <li>
      {strength ? (
        <button type="button" onClick={() => go(`sessao/${s.id}`)} className="flex min-h-14 w-full items-center gap-3 py-2.5 text-left">{content}</button>
      ) : (
        <div className="flex min-h-14 items-center gap-3 py-2.5">{content}</div>
      )}
    </li>
  )
}
