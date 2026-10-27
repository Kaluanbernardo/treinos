import { useEffect, useState } from 'react'
import { Ban, Check, ChevronRight, Dumbbell, NotebookText, Play, SlidersHorizontal, Trophy, X } from 'lucide-react'
import {
  useActiveSession, useBodyMetrics, useDeleteSession, useExerciseSessions, useMarkSession, useNotes, usePrs,
  useRecomposition, useStartSession, useStreaks, useToday, useWeek, useWeightTrend,
} from '../lib/api'
import { go } from '../lib/router'
import type { PlanItem } from '../lib/types'
import { capitalize, dm, hhmm, kgFmt, longDay, num, signed, todaySP, wdShort, addDays } from '../lib/format'
import { Badge, Button, Card, CardHead, Collecting, ErrorState, IconButton, ScreenHeader, Skeleton, haptic, toast } from '../components/ui'
import { READING_TONE, Triad, readingLine } from '../components/Triad'
import { ModalityDot } from '../components/modality'
import { NutritionStrip } from '../components/NutritionStrip'
import { SummaryCard } from '../components/SummaryCard'

const NAME = 'Kaluan'
const LOGGED = new Set(['feito', 'parcial', 'faltou'])

export function Hoje() {
  const today = useToday()
  const week = useWeek()
  const active = useActiveSession()
  const notes = useNotes()
  const now = useNow()

  const items = today.data ?? []
  const pending = items.filter((i) => i.active && !LOGGED.has(i.session_status ?? '') && Date.parse(i.ends_at) > now)
  const hero = pending[0]
  const todayIso = todaySP()
  const next = (week.data ?? []).find((i) => i.active && !i.session_status && i.date > todayIso)
  const lastSeenNote = Number(localStorage.getItem('notes_seen_at') ?? 0)
  const unread = (notes.data ?? []).filter((n) => Date.parse(n.created_at) > lastSeenNote).length

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeader
        title={`Olá, ${NAME}`}
        sub={capitalize(longDay(todayIso))}
        actions={
          <>
            <IconButton label={unread ? `Notas do assistente (${unread} novas)` : 'Notas do assistente'} onClick={() => go('notas')}>
              <NotebookText size={24} />
              {unread > 0 && <span className="absolute top-2.5 right-2.5 h-2.5 w-2.5 rounded-full bg-lime ring-2 ring-bg" aria-hidden="true" />}
            </IconButton>
            <IconButton label="Configurações" onClick={() => go('config')}><SlidersHorizontal size={24} /></IconButton>
          </>
        }
      />

      {today.isError ? (
        <ErrorState what="o seu dia" message={(today.error as Error).message} onRetry={() => today.refetch()} />
      ) : today.isPending || active.isPending ? (
        <Skeleton className="h-60" />
      ) : active.data ? (
        <ActiveSessionCard id={active.data.id} title={active.data.title} sets={active.data.n_sets} startedAt={active.data.started_at} />
      ) : (
        <AgoraCard item={hero} now={now} next={next} />
      )}

      <EvolucaoCard />
      <SummaryCard />
      <NutritionStrip />
      <SeuDia items={items} now={now} heroKey={hero ? key(hero) : null} next={next} loading={today.isPending} />
    </div>
  )
}

const key = (i: PlanItem) => `${i.date}-${i.start_time}-${i.title}`

function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

function startsIn(item: PlanItem, now: number) {
  const start = Date.parse(item.starts_at)
  if (start <= now) return 'agora'
  const min = Math.round((start - now) / 60_000)
  if (min < 60) return `em ${min} min`
  const h = Math.floor(min / 60)
  return `em ${h} h${min % 60 >= 10 ? ` ${min % 60} min` : ''}`
}

const kindBadge = (kind: PlanItem['plan_kind']) =>
  kind === 'substituido' ? <Badge tone="warn">exceção</Badge>
    : kind === 'adicionado' ? <Badge tone="lime">remarcado</Badge>
      : null

// ---------------------------------------------------------------- Agora
function AgoraCard({ item, now, next }: { item?: PlanItem; now: number; next?: PlanItem }) {
  const start = useStartSession()
  const mark = useMarkSession()
  const del = useDeleteSession()

  if (!item) {
    return (
      <Card tone="raised">
        <CardHead title="Dia encerrado" aside={<Badge tone="ok"><Check size={14} aria-hidden="true" /> livre</Badge>} />
        <p className="mt-3 text-[28px] font-bold leading-tight">Recupere bem.</p>
        {next ? (
          <p className="mt-2 text-muted">
            Próximo: <span className="text-fg">{capitalize(wdShort(next.date))} · {hhmm(next.start_time)} · {next.title}</span>
          </p>
        ) : (
          <p className="mt-2 text-muted">Nada mais planejado nesta semana.</p>
        )}
      </Card>
    )
  }

  const strength = item.modality === 'musculacao' && !!item.template_id
  const meta = [
    hhmm(item.start_time),
    strength ? `${item.exercise_count} exercícios` : item.modality_label !== item.title ? item.modality_label : null,
    `~${item.est_minutes ?? item.duration_min} min`,
  ].filter(Boolean)
  const isNow = Date.parse(item.starts_at) <= now

  async function onStart() {
    haptic(15)
    try {
      const id = await start.mutateAsync({ template_id: item!.template_id, modality: item!.modality, slot_id: item!.slot_id, override_id: item!.override_id })
      go(`sessao/${id}`)
    } catch (e) {
      toast(`Não deu para iniciar: ${(e as Error).message}`, { tone: 'err' })
    }
  }

  async function onMark(status: 'feito' | 'faltou') {
    haptic(15)
    try {
      const id = await mark.mutateAsync({ item: item!, status })
      toast(status === 'feito' ? `${item!.title}: feito.` : `${item!.title}: falta registrada.`, {
        tone: status === 'feito' ? 'lime' : undefined,
        action: { label: 'Desfazer', run: () => del.mutate(id) },
      })
    } catch (e) {
      toast(`Não salvou: ${(e as Error).message}`, { tone: 'err' })
    }
  }

  return (
    <Card tone="raised" aria-labelledby="agora-title">
      <h2 id="agora-title" className="text-[36px] font-bold leading-[1.05] tracking-[-0.02em] [text-wrap:balance]">{item.title}</h2>
      <p className="mt-2 text-lg text-muted">{meta.join(' · ')}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge tone={isNow ? 'lime' : 'muted'}>
          {isNow && <span className="live-dot h-1.5 w-1.5 rounded-full bg-lime" aria-hidden="true" />}
          {isNow ? 'agora' : startsIn(item, now)}
        </Badge>
        {kindBadge(item.plan_kind)}
      </div>
      {item.motivo && <p className="mt-2 text-[15px] leading-relaxed text-muted">{item.motivo}</p>}

      {strength ? (
        <Button variant="primary" size="xl" className="mt-5 w-full" onClick={onStart} disabled={start.isPending}>
          <Play size={22} fill="currentColor" aria-hidden="true" /> {start.isPending ? 'Abrindo…' : 'Iniciar treino'}
        </Button>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button variant="primary" size="xl" onClick={() => onMark('feito')} disabled={mark.isPending}>
            <Check size={24} aria-hidden="true" /> Feito
          </Button>
          <Button size="xl" onClick={() => onMark('faltou')} disabled={mark.isPending}>
            <X size={22} aria-hidden="true" /> Faltei
          </Button>
        </div>
      )}
    </Card>
  )
}

function ActiveSessionCard({ id, title, sets, startedAt }: { id: string; title: string; sets: number; startedAt: string | null }) {
  const min = startedAt ? Math.max(0, Math.round((Date.now() - Date.parse(startedAt)) / 60_000)) : null
  return (
    <Card tone="raised">
      <h2 className="text-[36px] font-bold leading-[1.05] tracking-[-0.02em]">{title}</h2>
      <p className="mt-2 text-lg text-muted">
        {sets === 1 ? '1 série feita' : `${sets} séries feitas`}{min != null && ` · começou há ${min} min`}
      </p>
      <div className="mt-3">
        <Badge tone="lime"><span className="live-dot h-1.5 w-1.5 rounded-full bg-lime" aria-hidden="true" /> treino em andamento</Badge>
      </div>
      <Button variant="primary" size="xl" className="mt-5 w-full" onClick={() => go(`sessao/${id}`)}>
        <Dumbbell size={22} aria-hidden="true" /> Continuar treino
      </Button>
    </Card>
  )
}

// ---------------------------------------------------------------- Evolução
function EvolucaoCard() {
  const recomp = useRecomposition()
  const trend = useWeightTrend()
  const body = useBodyMetrics()
  const ex = useExerciseSessions()
  const prs = usePrs()
  const streaks = useStreaks()

  if (recomp.isPending || trend.isPending) return <Skeleton className="h-72" />
  if (recomp.isError || trend.isError) {
    return <ErrorState what="a evolução" onRetry={() => { recomp.refetch(); trend.refetch() }} />
  }

  const w = trend.data ?? []
  const last = w[w.length - 1]
  const firstWaist = (body.data ?? []).find((b) => b.cintura_cm != null)?.date
  const firstStrength = (ex.data ?? []).find((e) => e.main_lift)?.date
  const reading = readingLine(recomp.data)
  const fresh = last && last.date >= addDays(todaySP(), -7)
  const avgReady = last && fresh && last.n_7d >= 3

  const weekAgo = addDays(todaySP(), -7)
  const pr = (prs.data ?? []).find((p) => p.date >= weekAgo)
  const total = (streaks.data ?? []).find((s) => s.modality === 'total')

  return (
    <Card as="article" aria-labelledby="evo-title" className="relative">
      <button type="button" onClick={() => go('evolucao')} className="absolute inset-0 rounded-[var(--radius-card)]" aria-label="Abrir Evolução" />
      <CardHead id="evo-title" title="Evolução" aside={<ChevronRight size={22} className="text-muted" aria-hidden="true" />} />

      {!last ? (
        <div className="mt-3">
          <Collecting title="Sem pesagem ainda">
            Mande o peso no chat ao acordar, depois do banheiro. A média de 7 dias aparece com 3 pesagens na semana.
          </Collecting>
        </div>
      ) : (
        <div className="mt-2">
          <div className="flex items-baseline gap-2">
            <span className="text-[56px] font-bold leading-none tracking-[-0.03em]">{num(avgReady ? last.avg_7d : last.peso_kg)}</span>
            <span className="text-lg text-muted">kg</span>
          </div>
          <p className="mt-1.5 text-[15px] text-muted">
            {avgReady ? (
              <>média de 7 dias{last.delta_7d != null && <> · <span className="text-fg">{signed(last.delta_7d)} kg</span> na semana</>}</>
            ) : (
              <>pesagem de {dm(last.date)} · a média de 7 dias aparece com 3 pesagens na semana ({fresh ? last.n_7d : 0}/3)</>
            )}
          </p>
        </div>
      )}

      <div className="mt-4">
        <Triad data={recomp.data} ready={{ firstWeight: w[0]?.date, firstWaist, firstStrength }} />
      </div>
      <p className={`mt-3 text-[15px] leading-relaxed ${reading ? READING_TONE[recomp.data!.reading] : 'text-muted'}`}>
        {reading ?? 'As setas comparam com 4 semanas atrás e aparecem conforme os registros se acumulam.'}
      </p>

      {(pr || (total && total.this_week_planned > 0)) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          {pr && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-lime/12 px-3 py-1.5 text-sm font-semibold text-lime">
              <Trophy size={16} aria-hidden="true" /> {pr.exercise_name} {kgFmt(pr.kg)} kg × {pr.reps}
            </span>
          )}
          {total && total.this_week_planned > 0 && (
            <span className="text-sm text-muted">
              <span className="font-semibold text-fg">{total.this_week_done}/{total.this_week_planned}</span> sessões na semana
              {total.current_streak_weeks > 0 && <> · sequência de {total.current_streak_weeks} {total.current_streak_weeks === 1 ? 'semana' : 'semanas'}</>}
            </span>
          )}
        </div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------- Seu dia
function SeuDia({ items, now, heroKey, next, loading }: { items: PlanItem[]; now: number; heroKey: string | null; next?: PlanItem; loading: boolean }) {
  const mark = useMarkSession()
  const del = useDeleteSession()
  if (loading) return null
  const rest = items.filter((i) => key(i) !== heroKey)

  async function onMark(item: PlanItem, status: 'feito' | 'faltou') {
    haptic(15)
    try {
      const id = await mark.mutateAsync({ item, status })
      toast(status === 'feito' ? `${item.title}: feito.` : `${item.title}: falta registrada.`, {
        action: { label: 'Desfazer', run: () => del.mutate(id) },
      })
    } catch (e) {
      toast(`Não salvou: ${(e as Error).message}`, { tone: 'err' })
    }
  }

  return (
    <Card aria-labelledby="dia-title">
      <CardHead id="dia-title" title="Seu dia" sub={items.length === 0 ? 'Domingo de folga: nada na grade.' : undefined} />
      {rest.length > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {rest.map((i) => {
            const past = Date.parse(i.ends_at) <= now
            const unlogged = i.active && !i.session_status && past
            return (
              <li key={key(i)} className="py-3">
                <div className="flex items-center gap-3">
                  <span className="w-12 shrink-0 text-[15px] font-medium tabular-nums text-muted">{hhmm(i.start_time)}</span>
                  <ModalityDot modality={i.modality} />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate font-medium ${!i.active ? 'text-muted line-through' : ''}`}>{i.title}</p>
                    {(i.motivo && !i.active) && <p className="text-sm text-muted">{i.motivo}</p>}
                  </div>
                  <StatusPill item={i} unlogged={unlogged} />
                </div>
                {unlogged && (
                  <div className="mt-2 grid grid-cols-2 gap-2 pl-[60px]">
                    <Button size="md" onClick={() => onMark(i, 'feito')}><Check size={18} aria-hidden="true" /> Feito</Button>
                    <Button size="md" variant="ghost" className="border border-line" onClick={() => onMark(i, 'faltou')}><X size={18} aria-hidden="true" /> Faltei</Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {next && (
        <p className={`text-[15px] text-muted ${rest.length ? 'mt-1 border-t border-line pt-3' : 'mt-3'}`}>
          Depois: <span className="font-medium text-fg">{capitalize(wdShort(next.date))} · {hhmm(next.start_time)} · {next.title}</span>
          {next.plan_kind === 'adicionado' && <span className="text-lime"> (remarcado)</span>}
        </p>
      )}
    </Card>
  )
}

function StatusPill({ item, unlogged }: { item: PlanItem; unlogged: boolean }) {
  if (!item.active) return <Badge tone="warn"><Ban size={13} aria-hidden="true" /> pulado</Badge>
  switch (item.session_status) {
    case 'feito': return <Badge tone="ok"><Check size={13} aria-hidden="true" /> feito</Badge>
    case 'parcial': return <Badge tone="ok">parcial</Badge>
    case 'faltou': return <Badge tone="muted"><X size={13} aria-hidden="true" /> faltou</Badge>
    case 'em_andamento': return <Badge tone="lime">em andamento</Badge>
  }
  return unlogged ? <Badge tone="warn">sem registro</Badge> : kindBadge(item.plan_kind)
}
