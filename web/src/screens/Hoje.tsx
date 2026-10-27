import { useEffect, useState } from 'react'
import {
  Ban, Check, ChevronRight, Clock, Dumbbell, Flame, Hourglass, Moon, NotebookText, PencilLine, Play, SlidersHorizontal, Timer, Trophy, X,
} from 'lucide-react'
import {
  useActiveSession, useBodyMetrics, useDailyNutrition, useDeleteSession, useExerciseSessions, useMarkSession, useNotes,
  useNutritionTargets, usePrs, useRecomposition, useStartSession, useStreaks, useTemplates, useToday, useToggleCreatine, useWeek,
  useWeightTrend,
} from '../lib/api'
import { go } from '../lib/router'
import type { PlanItem, Template } from '../lib/types'
import { capitalize, dMon, hhmm, intFmt, kgFmt, num, todaySP, wdShort, addDays, weekStart } from '../lib/format'
import { weekDays } from '../lib/week'
import { Badge, Button, Card, ErrorState, IconButton, Skeleton, haptic, toast } from '../components/ui'
import { READING_TONE, Triad, readingLine } from '../components/Triad'
import { ModalityDot } from '../components/modality'
import { SummaryCard } from '../components/SummaryCard'
import { FichaSheet } from '../components/FichaSheet'
import { CreatineButton } from './Nutricao'
import { Big, DateTile, Delta, Rings, Spark, WeekStrip } from '../components/viz'

const LOGGED = new Set(['feito', 'parcial', 'faltou'])

export function Hoje() {
  const today = useToday()
  const week = useWeek()
  const active = useActiveSession()
  const notes = useNotes()
  const templates = useTemplates()
  const now = useNow()
  const [ficha, setFicha] = useState<Template | null>(null)
  const openFicha = (templateId: string | null) => {
    const t = templates.data?.find((x) => x.id === templateId)
    if (t) setFicha(t); else toast('Ficha ainda carregando. Tente de novo.', { tone: 'err' })
  }

  const items = today.data ?? []
  const pending = items.filter((i) => i.active && !LOGGED.has(i.session_status ?? '') && Date.parse(i.ends_at) > now)
  const hero = pending[0]
  const todayIso = todaySP()
  const next = (week.data ?? []).find((i) => i.active && !i.session_status && i.date > todayIso)
  const lastSeenNote = Number(localStorage.getItem('notes_seen_at') ?? 0)
  const unread = (notes.data ?? []).filter((n) => Date.parse(n.created_at) > lastSeenNote).length
  // musculação de hoje fora do cartão principal (ex.: o horário das 6h já passou): ainda dá para registrar as cargas
  const strengthToday = active.data ? undefined
    : items.find((i) => i.active && i.modality === 'musculacao' && i.template_id && i.session_status !== 'faltou' && (!hero || key(i) !== key(hero)))

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3 pt-1">
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em]">
          {capitalize(wdShort(todayIso))}, <span className="text-muted">{dMon(todayIso)}</span>
        </h1>
        <div className="-mr-2 flex shrink-0 items-center">
          <IconButton label={unread ? `Notas do assistente (${unread} novas)` : 'Notas do assistente'} onClick={() => go('notas')}>
            <NotebookText size={24} />
            {unread > 0 && <span className="absolute top-2 right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full action-fill px-1 text-[11px] font-bold" aria-hidden="true">{unread}</span>}
          </IconButton>
          <IconButton label="Configurações" onClick={() => go('config')}><SlidersHorizontal size={24} /></IconButton>
        </div>
      </header>

      {today.isError ? (
        <ErrorState what="o seu dia" message={(today.error as Error).message} onRetry={() => today.refetch()} />
      ) : today.isPending || active.isPending ? (
        <Skeleton className="h-56" />
      ) : active.data ? (
        <ActiveSessionCard id={active.data.id} title={active.data.title} sets={active.data.n_sets} startedAt={active.data.started_at}
          onFicha={active.data.template_id ? () => openFicha(active.data!.template_id) : undefined} />
      ) : hero ? (
        <AgoraCard item={hero} now={now} onFicha={() => openFicha(hero.template_id)} />
      ) : (
        <DayDoneCard next={next} />
      )}
      {strengthToday && <FichaHojeCard item={strengthToday} onFicha={() => openFicha(strengthToday.template_id)} />}

      <EvolucaoCard />
      <SummaryCard />
      <DiaCard />
      <SemanaCard items={items} now={now} heroKey={hero ? key(hero) : null} next={next} />
      <FichaSheet template={ficha} onClose={() => setFicha(null)} />
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

/** Linha de metadados com ícones (hora · exercícios · duração). */
function MetaRow({ parts }: { parts: { icon: React.ReactNode; text: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[17px] text-muted">
      {parts.map((p) => (
        <li key={p.text} className="flex items-center gap-1.5 tabular-nums">{p.icon}<span className="text-fg">{p.text}</span></li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------- Agora
function AgoraCard({ item, now, onFicha }: { item: PlanItem; now: number; onFicha: () => void }) {
  const start = useStartSession()
  const mark = useMarkSession()
  const del = useDeleteSession()

  const strength = item.modality === 'musculacao' && !!item.template_id
  const isNow = Date.parse(item.starts_at) <= now
  const parts = [
    { icon: <Clock size={18} aria-hidden="true" />, text: hhmm(item.start_time) },
    strength
      ? { icon: <Dumbbell size={18} aria-hidden="true" />, text: `${item.exercise_count} exercícios` }
      : { icon: <ModalityDot modality={item.modality} />, text: item.modality_label },
    { icon: <Timer size={18} aria-hidden="true" />, text: `${item.est_minutes ?? item.duration_min} min` },
  ]

  async function onStart() {
    haptic(15)
    try {
      const id = await start.mutateAsync({ template_id: item.template_id, modality: item.modality, slot_id: item.slot_id, override_id: item.override_id })
      go(`sessao/${id}`)
    } catch (e) {
      toast(`Não deu para iniciar: ${(e as Error).message}`, { tone: 'err' })
    }
  }

  async function onMark(status: 'feito' | 'faltou') {
    haptic(15)
    try {
      const id = await mark.mutateAsync({ item, status })
      toast(status === 'feito' ? `${item.title}: feito.` : `${item.title}: falta registrada.`, {
        tone: status === 'feito' ? 'lime' : undefined,
        action: { label: 'Desfazer', run: () => del.mutate(id) },
      })
    } catch (e) {
      toast(`Não salvou: ${(e as Error).message}`, { tone: 'err' })
    }
  }

  return (
    <Card tone="raised" className={isNow ? 'ring-1 ring-lime/40' : ''} aria-labelledby="agora-title">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={isNow ? 'lime' : 'muted'}>
          {isNow && <span className="live-dot h-1.5 w-1.5 rounded-full bg-lime" aria-hidden="true" />}
          {isNow ? 'agora' : startsIn(item, now)}
        </Badge>
        {kindBadge(item.plan_kind)}
      </div>
      <h2 id="agora-title" className="mt-3 text-[36px] font-bold leading-[1.05] tracking-[-0.02em] [text-wrap:balance]">{item.title}</h2>
      <div className="mt-3"><MetaRow parts={parts} /></div>
      {item.motivo && <p className="mt-2 line-clamp-2 text-[15px] text-muted">{item.motivo}</p>}

      {strength ? (
        <div className="mt-5 flex flex-col gap-3">
          <Button variant="primary" size="xl" onClick={onStart} disabled={start.isPending}>
            <Play size={22} fill="currentColor" aria-hidden="true" /> {start.isPending ? 'Abrindo…' : 'Iniciar treino'}
          </Button>
          <Button size="lg" onClick={onFicha}>
            <PencilLine size={20} aria-hidden="true" /> Registrar cargas na ficha
          </Button>
        </div>
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

function DayDoneCard({ next }: { next?: PlanItem }) {
  return (
    <Card tone="raised" aria-labelledby="agora-title">
      <div className="flex items-center gap-3">
        <Moon size={22} className="shrink-0 text-muted" aria-hidden="true" />
        <h2 id="agora-title" className="text-xl font-semibold">Dia encerrado</h2>
      </div>
      {next ? (
        <button type="button" onClick={() => go('agenda')} className="mt-4 flex w-full items-center gap-4 rounded-2xl bg-bg/60 p-3 text-left ring-1 ring-line hover:ring-muted/50">
          <DateTile iso={next.date} />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] text-muted">Próximo</span>
            <span className="block truncate text-xl font-semibold">{next.title}</span>
            <span className="block text-[15px] tabular-nums text-muted">{hhmm(next.start_time)}{next.plan_kind === 'adicionado' && <span className="text-warn"> · remarcado</span>}</span>
          </span>
          <ChevronRight size={20} className="shrink-0 text-muted" aria-hidden="true" />
        </button>
      ) : (
        <p className="mt-2 text-muted">Nada mais nesta semana.</p>
      )}
    </Card>
  )
}

function ActiveSessionCard({ id, title, sets, startedAt, onFicha }: {
  id: string; title: string; sets: number; startedAt: string | null; onFicha?: () => void
}) {
  const min = startedAt ? Math.max(0, Math.round((Date.now() - Date.parse(startedAt)) / 60_000)) : null
  return (
    <Card tone="raised" className="ring-1 ring-lime/40">
      <Badge tone="lime"><span className="live-dot h-1.5 w-1.5 rounded-full bg-lime" aria-hidden="true" /> em andamento</Badge>
      <h2 className="mt-3 text-[36px] font-bold leading-[1.05] tracking-[-0.02em]">{title}</h2>
      <div className="mt-3">
        <MetaRow parts={[
          { icon: <Check size={18} aria-hidden="true" />, text: sets === 1 ? '1 série' : `${sets} séries` },
          ...(min != null ? [{ icon: <Timer size={18} aria-hidden="true" />, text: `${min} min` }] : []),
        ]} />
      </div>
      <div className="mt-5 flex flex-col gap-3">
        <Button variant="primary" size="xl" onClick={() => go(`sessao/${id}`)}>
          <Dumbbell size={22} aria-hidden="true" /> Continuar treino
        </Button>
        {onFicha && (
          <Button size="lg" onClick={onFicha}>
            <PencilLine size={20} aria-hidden="true" /> Registrar cargas na ficha
          </Button>
        )}
      </div>
    </Card>
  )
}

/** Musculação de hoje que não está no cartão principal: entrada direta para registrar cargas na ficha. */
function FichaHojeCard({ item, onFicha }: { item: PlanItem; onFicha: () => void }) {
  const logged = item.session_status === 'feito' || item.session_status === 'parcial'
  return (
    <Card className="flex items-center gap-3 py-4">
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${logged ? 'bg-ok/15 text-ok' : 'action-fill'}`} aria-hidden="true">
        {logged ? <Check size={24} strokeWidth={3} /> : <Dumbbell size={22} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-semibold leading-tight">{item.title}</p>
        <p className="text-[15px] tabular-nums text-muted">
          {logged ? (item.session_status === 'parcial' ? 'parcial' : 'feito') : `${hhmm(item.start_time)} · ${item.exercise_count} exercícios`}
        </p>
      </div>
      {logged && item.session_id ? (
        <Button onClick={() => go(`sessao/${item.session_id}`)}>Resumo <ChevronRight size={18} aria-hidden="true" /></Button>
      ) : (
        <Button variant="primary" onClick={onFicha}><PencilLine size={18} aria-hidden="true" /> Registrar cargas</Button>
      )}
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
  const spark = w.filter((p) => p.date >= addDays(todaySP(), -28)).map((p) => Number(p.avg_7d))
  const pr = (prs.data ?? []).find((p) => p.date >= addDays(todaySP(), -7))

  return (
    <Card as="article" aria-labelledby="evo-title" className="relative">
      <button type="button" onClick={() => go('evolucao')} className="absolute inset-0 z-0 rounded-[var(--radius-card)]" aria-label="Abrir Evolução" />
      <div className="pointer-events-none relative">
        <div className="flex items-center justify-between">
          <h2 id="evo-title" className="text-lg font-semibold">Evolução</h2>
          <ChevronRight size={22} className="text-muted" aria-hidden="true" />
        </div>

        {!last ? (
          <p className="mt-3 flex items-center gap-2 text-[15px] text-muted">
            <Hourglass size={18} aria-hidden="true" /> Sem pesagem ainda: mande o peso no chat.
          </p>
        ) : (
          <div className="mt-2 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <Big size="xl" value={num(avgReady ? last.avg_7d : last.peso_kg)} unit="kg" />
              <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[15px] text-muted">
                {avgReady ? (
                  <>{last.delta_7d != null && <Delta value={last.delta_7d} unit="kg" good="down" />}<span>média 7 dias</span></>
                ) : (
                  <span className="flex items-center gap-1.5"><Hourglass size={15} aria-hidden="true" /> pesagem · média com {fresh ? last.n_7d : 0}/3</span>
                )}
              </p>
            </div>
            {spark.length >= 3 && <Spark values={spark} color="var(--color-lime)" width={120} height={52} label="Média de 7 dias nas últimas 4 semanas" />}
          </div>
        )}

        <div className="mt-4">
          <Triad data={recomp.data} ready={{ firstWeight: w[0]?.date, firstWaist, firstStrength }} />
        </div>

        {(reading || pr) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {reading && (
              <span className={`inline-flex items-center gap-1.5 text-[15px] font-semibold ${READING_TONE[recomp.data!.reading]}`}>
                {recomp.data!.reading === 'no_rumo' ? <Check size={18} strokeWidth={3} aria-hidden="true" /> : null}{reading}
              </span>
            )}
            {pr && (
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-lime/12 px-3 py-1.5 text-sm font-semibold text-lime">
                <Trophy size={15} aria-hidden="true" /> {pr.exercise_name.split(' ')[0]} {kgFmt(pr.kg)}×{pr.reps}
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------- Dia: anéis
function DiaCard() {
  const daily = useDailyNutrition()
  const targets = useNutritionTargets()
  const streaks = useStreaks()
  const toggle = useToggleCreatine()
  const date = todaySP()
  if (daily.isPending || targets.isPending || streaks.isPending) return <Skeleton className="h-52" />
  const d = daily.data?.find((x) => x.date === date)
  const t = targets.data
  const total = (streaks.data ?? []).find((s) => s.modality === 'total')
  const kcal = d?.kcal ?? 0
  const p = d?.protein_g ?? 0
  const creatine = d?.creatine ?? false
  const done = total?.this_week_done ?? 0
  const planned = total?.this_week_planned ?? 0

  const rows = [
    { label: 'Treinos na semana', value: `${done}`, of: `/${planned}`, color: 'var(--color-lime)', to: 'agenda' },
    { label: 'Calorias', value: intFmt(kcal), of: t?.kcal_target ? `/${intFmt(t.kcal_target)}` : ' kcal', color: 'var(--color-kcal)', to: 'nutricao' },
    { label: 'Proteína', value: intFmt(p), of: t?.protein_min_g ? `/${t.protein_min_g} g` : ' g', color: 'var(--color-protein)', to: 'nutricao' },
  ]

  return (
    <Card aria-label="Semana e nutrição de hoje">
      <div className="flex items-center gap-5">
        <Rings size={136} stroke={13} gap={4} rings={[
          { value: done, target: planned || null, color: 'var(--color-lime)', label: `Treinos: ${done} de ${planned}` },
          { value: kcal, target: t?.kcal_target ?? null, color: 'var(--color-kcal)', label: `Calorias: ${intFmt(kcal)}${t?.kcal_target ? ` de ${intFmt(t.kcal_target)}` : ''}` },
          { value: p, target: t?.protein_min_g ?? null, color: 'var(--color-protein)', label: `Proteína: ${intFmt(p)} g${t?.protein_min_g ? ` de ${t.protein_min_g} g` : ''}` },
        ]} />
        <ul className="min-w-0 flex-1 divide-y divide-line">
          {rows.map((r) => (
            <li key={r.label}>
              <button type="button" onClick={() => go(r.to)} className="flex min-h-12 w-full flex-col justify-center py-1.5 text-left">
                <span className="flex items-center gap-1.5 text-[13px] text-muted">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.color }} aria-hidden="true" />{r.label}
                </span>
                <span className="text-[22px] font-bold leading-tight tabular-nums">{r.value}<span className="text-[15px] font-medium text-muted">{r.of}</span></span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-4">
        <CreatineButton on={creatine} onToggle={() => {
          haptic(15)
          toggle.mutate({ date, value: !creatine }, { onError: () => toast('Não salvou a creatina. Tente de novo.', { tone: 'err' }) })
        }} />
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------- Semana + o resto do dia
function SemanaCard({ items, now, heroKey, next }: { items: PlanItem[]; now: number; heroKey: string | null; next?: PlanItem }) {
  const week = useWeek()
  const streaks = useStreaks()
  const mark = useMarkSession()
  const del = useDeleteSession()
  const today = todaySP()
  if (week.isPending) return <Skeleton className="h-44" />
  const days = weekDays(weekStart(today), week.data ?? [], today)
  const total = (streaks.data ?? []).find((s) => s.modality === 'total')
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
    <Card aria-labelledby="sem-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="sem-title" className="text-lg font-semibold">Semana</h2>
        {total && total.current_streak_weeks > 0 && (
          <span className="inline-flex items-center gap-1 text-[15px] font-semibold tabular-nums">
            <Flame size={18} className="text-kcal" aria-hidden="true" />{total.current_streak_weeks}
            <span className="font-normal text-muted">{total.current_streak_weeks === 1 ? 'semana seguida' : 'semanas seguidas'}</span>
          </span>
        )}
      </div>
      <div className="-mx-2 mt-3"><WeekStrip days={days} onPick={() => go('agenda')} /></div>

      {rest.length > 0 && (
        <ul className="mt-3 divide-y divide-line border-t border-line">
          {rest.map((i) => {
            const unlogged = i.active && !i.session_status && Date.parse(i.ends_at) <= now
            return (
              <li key={key(i)} className="py-3">
                <div className="flex items-center gap-3">
                  <span className="w-12 shrink-0 text-[15px] font-medium tabular-nums text-muted">{hhmm(i.start_time)}</span>
                  <ModalityDot modality={i.modality} />
                  <p className={`min-w-0 flex-1 truncate font-medium ${!i.active ? 'text-muted line-through' : ''}`}>{i.title}</p>
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
      {next && heroKey && (
        <p className="mt-1 flex items-center gap-2 border-t border-line pt-3 text-[15px] text-muted">
          Depois <span className="truncate font-medium text-fg">{capitalize(wdShort(next.date))} {hhmm(next.start_time)} · {next.title}</span>
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
