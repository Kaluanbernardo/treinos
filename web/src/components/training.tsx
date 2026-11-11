import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, Ban, Check, ChevronLeft, ChevronRight, Flame, Hourglass, Play, X } from 'lucide-react'
import { useAllSessions, useTrainingWeeks } from '../lib/api'
import { addDays, capitalize, diffDays, dm, intFmt, monthShort, todaySP, wdShort, weekStart } from '../lib/format'
import {
  type HeatDay, type HistoryStatus, type TypeCount, aggregateDays, countByType, countLevel, heatmapWeeks,
  monthMarks, weekReading, weekStatus,
} from '../lib/training'
import type { TrainingWeek } from '../lib/types'
import { Badge, Card, CardHead, Collecting, ErrorState, IconButton, Segmented, Skeleton } from './ui'
import { MODALITY } from './modality'
import { SaldoAcumulado } from './SaldoAcumulado'

/**
 * Treinos: status de cada atividade, meta semanal (faixa 4–9), calendário em mapa de calor e
 * contagem por ficha. Regras em lib/training.ts (mesma conta de v_training_weeks).
 */

// ---------------------------------------------------------------- status de uma atividade
/** Meio círculo: "parcial" (feito em parte). Traço de 2,4 como os ícones lucide ao lado. */
function HalfIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17Z" fill="currentColor" stroke="none" />
    </svg>
  )
}

export const STATUS: Record<HistoryStatus, { label: string; text: string; bg: string; icon: (s: number) => ReactNode }> = {
  feito: { label: 'feito', text: 'text-ok', bg: 'bg-ok/15', icon: (s) => <Check size={s} strokeWidth={3} aria-hidden="true" /> },
  parcial: { label: 'parcial', text: 'text-ok', bg: 'bg-ok/15', icon: (s) => <HalfIcon size={s} /> },
  faltou: { label: 'faltou', text: 'text-err', bg: 'bg-err/12', icon: (s) => <X size={s} strokeWidth={3} aria-hidden="true" /> },
  pulado: { label: 'pulado', text: 'text-warn', bg: 'bg-warn/12', icon: (s) => <Ban size={s} strokeWidth={2.4} aria-hidden="true" /> },
  em_andamento: { label: 'em andamento', text: 'text-lime', bg: 'bg-lime/15', icon: (s) => <Play size={s} fill="currentColor" aria-hidden="true" /> },
}

/** Ícone redondo do status (cor + forma; a palavra vem ao lado). */
export function StatusIcon({ status, size = 36 }: { status: HistoryStatus; size?: number }) {
  const m = STATUS[status]
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full ${m.bg} ${m.text}`} style={{ width: size, height: size }} aria-hidden="true">
      {m.icon(Math.round(size * 0.5))}
    </span>
  )
}

// ---------------------------------------------------------------- meta semanal
/** Selo da leitura da semana: ícone + palavra, nunca só a cor. */
export function WeekGoalChip({ w, className = '' }: { w: Pick<TrainingWeek, 'done' | 'goal_min' | 'goal_max' | 'is_current'>; className?: string }) {
  const st = weekStatus(w.done, w.goal_min, w.goal_max)
  const text = weekReading(w.done, w.goal_min, w.goal_max, w.is_current)
  if (st === 'na_faixa') return <Badge tone="ok" className={className}><Check size={13} strokeWidth={3} aria-hidden="true" /> {text}</Badge>
  if (st === 'acima') return <Badge tone="warn" className={className}><AlertTriangle size={13} aria-hidden="true" /> {text}</Badge>
  return <Badge tone="muted" className={className}><Hourglass size={13} aria-hidden="true" /> {text}</Badge>
}

/** Semanas seguidas com o mínimo da meta. `compact`: só "N semanas seguidas" (cabeçalho do Hoje). */
export function StreakLine({ n, compact = false, className = '' }: { n: number; compact?: boolean; className?: string }) {
  if (n <= 0) return null
  const word = compact ? (n === 1 ? 'semana no mínimo' : 'semanas seguidas') : (n === 1 ? 'semana com o mínimo' : 'semanas seguidas com o mínimo')
  return (
    <span className={`inline-flex items-center gap-1 text-[15px] font-semibold tabular-nums ${className}`}
      title={compact ? `${n} ${n === 1 ? 'semana' : 'semanas seguidas'} com o mínimo da meta semanal` : undefined}>
      <Flame size={18} className="shrink-0 text-kcal" aria-hidden="true" />{n}
      <span className="truncate font-normal text-muted">{word}</span>
    </span>
  )
}

/**
 * Colunas por semana com a faixa da meta ao fundo (mínimo–máximo). Número em cima de cada coluna;
 * semana atual em limão, semanas no mínimo em `fg`, abaixo dele apagadas, acima do máximo em âmbar.
 */
export function GoalBars({ weeks, height = 104, label, fill = false }: { weeks: TrainingWeek[]; height?: number; label: string; fill?: boolean }) {
  if (weeks.length === 0) return null
  const min = weeks[weeks.length - 1].goal_min
  const max = weeks[weeks.length - 1].goal_max
  const top = Math.max(max + 1, ...weeks.map((w) => w.done))
  const y = (v: number) => `${(v / top) * 100}%`
  return (
    <figure aria-label={label} className={fill ? 'flex h-full flex-col' : ''}>
      <div className={`flex gap-2 ${fill ? 'flex-1' : ''}`} style={{ minHeight: height }}>
        <div className="relative flex-1" style={fill ? undefined : { height }} role="img"
          aria-label={weeks.map((w) => `semana de ${dm(w.week_start)}: ${w.done} ${w.done === 1 ? 'treino' : 'treinos'}`).join('; ')}>
          {/* faixa da meta */}
          <div className="absolute inset-x-0 rounded-[4px] bg-ok/10" style={{ bottom: y(min), height: `calc(${y(max)} - ${y(min)})` }} aria-hidden="true" />
          <div className="absolute inset-x-0 border-t border-dashed border-ok/60" style={{ bottom: y(min) }} aria-hidden="true" />
          <div className="absolute inset-x-0 border-t border-dashed border-ok/30" style={{ bottom: y(max) }} aria-hidden="true" />
          <div className="absolute inset-0 flex items-end gap-1.5">
            {weeks.map((w) => {
              const st = weekStatus(w.done, w.goal_min, w.goal_max)
              const color = w.is_current ? 'bg-lime' : st === 'acima' ? 'bg-warn' : st === 'na_faixa' ? 'bg-muted/75' : 'bg-muted/30'
              return (
                <div key={w.week_start} className="relative flex h-full flex-1 flex-col items-center justify-end">
                  <span className={`mb-1 text-[12px] font-semibold leading-none tabular-nums ${w.is_current ? 'text-fg' : 'text-muted'}`}>{w.done}</span>
                  <div className={`meter-fill w-full max-w-9 rounded-t-[4px] ${color}`} style={{ height: w.done ? y(w.done) : 2, opacity: w.done ? 1 : 0.6 }} />
                </div>
              )
            })}
          </div>
        </div>
        <div className="relative w-5 shrink-0 text-[11px] tabular-nums text-ok" style={fill ? undefined : { height }} aria-hidden="true">
          <span className="absolute right-0 translate-y-1/2" style={{ bottom: y(max) }}>{max}</span>
          <span className="absolute right-0 translate-y-1/2" style={{ bottom: y(min) }}>{min}</span>
        </div>
      </div>
      <figcaption className="mt-1.5 mr-7 flex gap-1.5 text-[11px] tabular-nums text-muted" aria-hidden="true">
        {weeks.map((w) => <span key={w.week_start} className={`flex-1 text-center ${w.is_current ? 'font-semibold text-fg' : ''}`}>{w.is_current ? 'esta' : dm(w.week_start).slice(0, 5)}</span>)}
      </figcaption>
    </figure>
  )
}

/** Card da meta semanal (Treino): contador, leitura, sequência e as últimas semanas. */
export function WeekGoalCard({ nWeeks = 8, fill = false, barHeight = 104 }: { nWeeks?: number; fill?: boolean; barHeight?: number }) {
  const q = useTrainingWeeks()
  if (q.isPending) return <Skeleton className="h-64" />
  if (q.isError) return <ErrorState what="a meta semanal" onRetry={() => q.refetch()} />
  const weeks = q.data ?? []
  const cur = weeks.find((w) => w.is_current) ?? weeks[weeks.length - 1]
  if (!cur) return null
  const shown = weeks.slice(-nWeeks)
  return (
    <Card aria-labelledby="goal-title" className={fill ? 'flex flex-col' : ''}>
      <CardHead id="goal-title" title="Meta semanal" sub={`faixa ${cur.goal_min}–${cur.goal_max} · qualquer atividade conta`} />
      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <p className="inline-flex items-baseline gap-1 font-bold leading-none tabular-nums">
          <span className="text-[56px] tracking-[-0.03em]">{cur.done}</span>
          <span className="text-xl font-medium tracking-normal text-muted">/{cur.goal_min}</span>
          <span className="sr-only"> treinos esta semana, faixa {cur.goal_min} a {cur.goal_max}</span>
        </p>
        <div className="flex flex-col items-end gap-1.5 pb-1">
          <WeekGoalChip w={cur} />
          {cur.missed > 0 && <span className="text-[13px] tabular-nums text-muted">{cur.missed} {cur.missed === 1 ? 'falta' : 'faltas'} na semana</span>}
        </div>
      </div>
      <div className="mt-2"><StreakLine n={cur.streak_weeks} /></div>
      {shown.length >= 2 ? (
        <div className={`mt-4 ${fill ? 'flex-1' : ''}`}><GoalBars weeks={shown} fill={fill} height={barHeight} label="Treinos feitos por semana contra a faixa da meta" /></div>
      ) : (
        <p className="mt-4 text-[15px] text-muted">As colunas por semana aparecem a partir da 2ª semana.</p>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------- calendário (mapa de calor)
const LABEL_W = 30
const GAP = 4
/** célula-alvo: 20 px no celular; em cards largos (desktop) 30 px, com menos semanas e mais legíveis */
const cellTarget = (w: number) => (w > 900 ? 30 : w > 560 ? 26 : 20)
const ROWS = ['seg', '', 'qua', '', 'sex', '', 'dom']

/** Largura do elemento (callback ref: funciona mesmo quando ele só aparece depois do carregamento). */
function useWidth<T extends HTMLElement>() {
  const [w, setW] = useState(0)
  const ro = useRef<ResizeObserver | null>(null)
  const ref = useCallback((el: T | null) => {
    ro.current?.disconnect()
    if (!el) return
    setW(Math.round(el.getBoundingClientRect().width))
    ro.current = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.current.observe(el)
  }, [])
  useEffect(() => () => ro.current?.disconnect(), [])
  return [ref, w] as const
}

/** Treinos = mapa de calor; Kcal = saldo calórico acumulado (components/SaldoAcumulado.tsx). */
type CalMode = 'treinos' | 'kcal'

const COUNT_BG = ['', 'bg-lime/30', 'bg-lime/55', 'bg-lime/80', 'bg-lime']

/**
 * Mapa de calor estilo "contributions": colunas = semanas, linhas = seg–dom. Intensidade = treinos feitos
 * no dia. Falta = ✕ desenhado (dia só com falta) ou ponto coral no canto (falta + treino).
 * Dias antes do primeiro registro ficam apagados: não são "zero treino", são "sem registro".
 * O modo Kcal troca o mapa pelo gráfico de saldo acumulado; o mapa de treinos não muda.
 */
export function TrainingCalendar({ maxWeeks = 53 }: { maxWeeks?: number }) {
  const today = todaySP()
  const [box, width] = useWidth<HTMLDivElement>()
  const n = width ? Math.max(8, Math.min(maxWeeks, Math.floor((width - LABEL_W + GAP) / (cellTarget(width) + GAP)))) : 13
  const [back, setBack] = useState(0)      // semanas para trás a partir da semana atual
  const [mode, setMode] = useState<CalMode>('treinos')
  const endWs = addDays(weekStart(today), -7 * back)
  const from = addDays(endWs, -7 * (n - 1))
  const to = addDays(endWs, 6)
  const sessions = useAllSessions()
  const weeksQ = useTrainingWeeks()
  const [sel, setSel] = useState<string>(today)

  const firstDate = sessions.data?.[0]?.date ?? null
  const weeks = useMemo(() => {
    const list = (sessions.data ?? []).filter((s) => s.date >= from && s.date <= to)
    return heatmapWeeks(aggregateDays(list), from, to, today)
  }, [sessions.data, from, to, today])

  if (sessions.isPending) return <Skeleton className="h-72" />
  if (sessions.isError) return <ErrorState what="o calendário" onRetry={() => sessions.refetch()} />

  const all = weeks.flat()
  const visible = all.filter((d) => !d.future && (!firstDate || d.date >= firstDate))
  const done = visible.reduce((s, d) => s + d.done, 0)
  const missed = visible.reduce((s, d) => s + d.missed, 0)
  const goalWeeks = (weeksQ.data ?? []).filter((w) => w.week_start >= from && w.week_start <= endWs && !w.is_current)
  const met = goalWeeks.filter((w) => w.met).length
  const step = n >= 26 ? 13 : 4
  const marks = monthMarks(weeks)
  const selDay = all.find((d) => d.date === sel)
  const rangeLabel = from.slice(0, 7) === to.slice(0, 7) ? monthShort(from)
    : `${monthShort(from)}${from.slice(0, 4) !== to.slice(0, 4) ? ` ${from.slice(0, 4)}` : ''} – ${monthShort(to)} ${to.slice(0, 4)}`

  return (
    <Card aria-labelledby="cal-title">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        {mode === 'kcal'
          ? <CardHead id="cal-title" title="Saldo acumulado" sub="comida − gasto, somado dia a dia · tracejado = meta" />
          : <CardHead id="cal-title" title="Calendário" sub={firstDate ? `registro desde ${dm(firstDate)}` : undefined} />}
        <div className="w-full sm:w-44"><Segmented size="sm" label="Mostrar no calendário" value={mode} onChange={setMode}
          options={[{ value: 'treinos', label: 'Treinos' }, { value: 'kcal', label: 'Kcal' }]} /></div>
      </div>

      {mode === 'kcal' ? <SaldoAcumulado /> : !firstDate ? (
        <div className="mt-4"><Collecting title="Nenhuma atividade registrada">Cada treino feito ou faltado pinta um dia aqui.</Collecting></div>
      ) : (
        <>
          <div className="mt-3 flex items-center justify-between gap-2">
            <IconButton label={`${step} semanas antes`} onClick={() => setBack(back + step)} className="-ml-2"><ChevronLeft size={22} /></IconButton>
            <p className="min-w-0 text-center">
              <span className="block font-semibold">{capitalize(rangeLabel)}</span>
              <span className="block text-[13px] tabular-nums text-muted">{n} semanas</span>
            </p>
            <IconButton label={`${step} semanas depois`} onClick={() => setBack(Math.max(0, back - step))} disabled={back === 0} className="-mr-2 disabled:opacity-30">
              <ChevronRight size={22} />
            </IconButton>
          </div>

          <div ref={box} className="mt-2">
            <div className="grid" role="grid" aria-label={`Treinos por dia, ${rangeLabel}`}
              style={{ gridTemplateColumns: `${LABEL_W}px repeat(${weeks.length}, minmax(0, 1fr))`, columnGap: GAP, rowGap: GAP }}>
              <span aria-hidden="true" />
              {weeks.map((_, i) => {
                const m = marks.find((x) => x.index === i)
                return <span key={`m${i}`} aria-hidden="true" className="h-4 overflow-visible whitespace-nowrap text-[11px] leading-4 text-muted">{m ? monthShort(`${m.month}-01`) : ''}</span>
              })}
              {ROWS.map((r, row) => (
                <Row key={row} label={r} cells={weeks.map((w) => w[row])} firstDate={firstDate} today={today} sel={sel} onPick={setSel} />
              ))}
            </div>
          </div>

          <HeatLegend />

          <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4">
            <Stat label="Treinos" value={intFmt(done)} />
            <Stat label="Faltas" value={intFmt(missed)} />
            <Stat label="No mínimo" value={goalWeeks.length ? `${met}/${goalWeeks.length}` : '—'} unit={goalWeeks.length ? 'sem.' : undefined} />
          </dl>

          {selDay && <DayDetail d={selDay} before={!!firstDate && sel < firstDate} />}
        </>
      )}
    </Card>
  )
}

function Row({ label, cells, firstDate, today, sel, onPick }: {
  label: string; cells: HeatDay[]; firstDate: string | null; today: string; sel: string; onPick: (d: string) => void
}) {
  return (
    <>
      <span className="flex items-center text-[11px] leading-none text-muted" aria-hidden="true">{label}</span>
      {cells.map((d) => <Cell key={d.date} d={d} before={!!firstDate && d.date < firstDate} today={d.date === today} selected={d.date === sel} onPick={onPick} />)}
    </>
  )
}

function cellAria(d: HeatDay, before: boolean) {
  const day = `${wdShort(d.date)} ${dm(d.date)}`
  if (d.future) return `${day}: ainda não chegou`
  if (before) return `${day}: antes do registro`
  const parts = [d.done ? `${d.done} ${d.done === 1 ? 'treino' : 'treinos'}` : 'sem treino']
  if (d.missed) parts.push(`${d.missed} ${d.missed === 1 ? 'falta' : 'faltas'}`)
  return `${day}: ${parts.join(', ')}`
}

function Cell({ d, before, today, selected, onPick }: { d: HeatDay; before: boolean; today: boolean; selected: boolean; onPick: (d: string) => void }) {
  const level = countLevel(d.done)
  const fill = d.future ? 'bg-transparent ring-1 ring-inset ring-line/70'
    : before ? 'bg-line/25 ring-1 ring-inset ring-line/40'
      : level ? COUNT_BG[level] : 'bg-line'
  const ring = selected ? 'outline-2 outline-offset-1 outline-fg' : today ? 'outline-1 outline-offset-1 outline-lime/70' : ''
  return (
    <button type="button" role="gridcell" aria-label={cellAria(d, before)} aria-selected={selected} disabled={d.future}
      onClick={() => onPick(d.date)}
      className={`relative aspect-square min-w-0 rounded-[4px] outline-solid transition-[outline-color] duration-150 ${fill} ${ring} ${selected || today ? '' : 'outline-0'}`}>
      {d.missed > 0 && !d.future && !before && (d.done === 0
        ? <X className="absolute inset-0 m-auto h-[62%] w-[62%] text-err" strokeWidth={3.5} aria-hidden="true" />
        : <span className="absolute -top-0.5 -right-0.5 h-[38%] w-[38%] rounded-full bg-err ring-2 ring-card" aria-hidden="true" />)}
    </button>
  )
}

function HeatLegend() {
  const steps = ['0', '1', '2', '3', '4+']
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[12px] text-muted">
      <span className="flex items-center gap-1.5">
        treinos/dia
        {steps.map((s, i) => (
          <span key={s} className="flex flex-col items-center gap-0.5">
            <span className={`h-3.5 w-3.5 rounded-[3px] ${i ? COUNT_BG[i] : 'bg-line'}`} aria-hidden="true" />
          </span>
        ))}
        <span className="tabular-nums">{steps[0]}–{steps[4]}</span>
      </span>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex items-center gap-1"><X size={13} strokeWidth={3.5} className="text-err" aria-hidden="true" /> faltou</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-err" aria-hidden="true" /> treino + falta</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-[3px] bg-line/25 ring-1 ring-inset ring-line/40" aria-hidden="true" /> antes do registro</span>
      </span>
    </div>
  )
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[13px] text-muted">{label}</dt>
      <dd className="mt-0.5 text-xl font-bold tabular-nums">{value}{unit && <span className="ml-1 text-sm font-medium text-muted">{unit}</span>}</dd>
    </div>
  )
}

function DayDetail({ d, before }: { d: HeatDay; before: boolean }) {
  return (
    <div className="mt-4 rounded-2xl bg-bg/60 p-4 ring-1 ring-line" aria-live="polite">
      <p className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">{capitalize(wdShort(d.date))}, {dm(d.date)}</span>
      </p>
      {d.items.length === 0 ? (
        <p className="mt-1 text-[15px] text-muted">{before ? 'Antes do primeiro registro.' : d.future ? 'Ainda não chegou.' : 'Sem treino registrado.'}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {d.items.map((i) => (
            <li key={i.id} className="flex items-center gap-3">
              <StatusIcon status={i.status} size={28} />
              <span className="min-w-0 flex-1 truncate font-medium">{i.title}</span>
              <span className={`text-sm ${STATUS[i.status].text}`}>{STATUS[i.status].label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- contagem por ficha / tipo
type CountPeriod = '30' | '90' | 'tudo'

/** Quantas vezes cada ficha (e cada aula) foi feita: no período escolhido e no total. */
export function TypeCountsCard() {
  const q = useAllSessions()
  const [p, setP] = useState<CountPeriod>('30')
  const today = todaySP()
  const since = p === 'tudo' ? null : addDays(today, -(Number(p) - 1))
  const list = useMemo(() => countByType(q.data ?? [], since), [q.data, since])
  if (q.isPending) return <Skeleton className="h-72" />
  if (q.isError) return <ErrorState what="a contagem por treino" onRetry={() => q.refetch()} />
  const max = Math.max(1, ...list.map((c) => (p === 'tudo' ? c.total : c.inPeriod)))
  const first = q.data?.[0]?.date
  const span = first && since && first > since ? diffDays(today, first) + 1 : null
  return (
    <Card aria-labelledby="types-title">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <CardHead id="types-title" title="Quantas vezes" sub={p === 'tudo' ? 'cada ficha e aula, desde o primeiro registro' : span ? `cada ficha e aula · últimos ${p} dias (registro há ${span})` : `cada ficha e aula · últimos ${p} dias`} />
        <div className="w-full sm:w-52"><Segmented size="sm" label="Período da contagem" value={p} onChange={setP}
          options={[{ value: '30', label: '30 dias' }, { value: '90', label: '90 dias' }, { value: 'tudo', label: 'Tudo' }]} /></div>
      </div>
      {list.length === 0 ? (
        <div className="mt-4"><Collecting title="Nenhum treino feito ainda" /></div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3.5">
          {list.map((c) => <TypeRow key={c.key} c={c} max={max} all={p === 'tudo'} />)}
        </ul>
      )}
    </Card>
  )
}

function TypeRow({ c, max, all }: { c: TypeCount; max: number; all: boolean }) {
  const v = all ? c.total : c.inPeriod
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 font-medium">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${MODALITY[c.modality].bg}`} aria-hidden="true" />
          <span className="truncate">{c.title}</span>
        </span>
        <span className="shrink-0 tabular-nums text-muted">
          <b className="text-lg font-bold text-fg">{v}×</b>
          {!all && <span className="ml-2 text-sm">total {c.total}</span>}
        </span>
      </div>
      <div className="mt-1.5 h-2 rounded-full bg-line" aria-hidden="true">
        <div className="meter-fill h-2 rounded-full" style={{ width: `${(v / max) * 100}%`, background: MODALITY[c.modality].color, opacity: v ? 1 : 0 }} />
      </div>
      <p className="mt-1 text-[13px] tabular-nums text-muted">
        {c.last ? `último ${dm(c.last)}` : 'ainda não feito'}
        {c.missedInPeriod > 0 && ` · ${c.missedInPeriod} ${c.missedInPeriod === 1 ? 'falta' : 'faltas'}${all ? '' : ' no período'}`}
      </p>
    </li>
  )
}

// ---------------------------------------------------------------- mini (barra lateral)
/** Contador compacto da semana para a barra lateral do desktop. */
export function WeekGoalMini({ onOpen }: { onOpen: () => void }) {
  const q = useTrainingWeeks()
  const cur = q.data?.find((w) => w.is_current)
  if (!cur) return null
  const st = weekStatus(cur.done, cur.goal_min, cur.goal_max)
  const pct = Math.min(1, cur.done / Math.max(1, cur.goal_max))
  return (
    <button type="button" onClick={onOpen} className="w-full rounded-2xl bg-card p-3 text-left transition-colors duration-150 hover:bg-card-2"
      aria-label={`Meta semanal: ${cur.done} de ${cur.goal_min}, faixa ${cur.goal_min} a ${cur.goal_max}. ${weekReading(cur.done, cur.goal_min, cur.goal_max, true)}`}>
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] text-muted">Semana</span>
        <span className="text-xl font-bold leading-none tabular-nums">{cur.done}<span className="text-sm font-medium text-muted">/{cur.goal_min}</span></span>
      </span>
      <span className="relative mt-2 block h-1.5 rounded-full bg-line" aria-hidden="true">
        <span className="absolute inset-y-0 rounded-full bg-ok/25" style={{ left: `${(cur.goal_min / cur.goal_max) * 100}%`, right: 0 }} />
        <span className={`meter-fill absolute inset-y-0 left-0 rounded-full ${st === 'acima' ? 'bg-warn' : 'bg-lime'}`} style={{ width: `${pct * 100}%` }} />
      </span>
      <span className={`mt-1.5 block text-[12px] ${st === 'na_faixa' ? 'text-ok' : st === 'acima' ? 'text-warn' : 'text-muted'}`}>
        faixa {cur.goal_min}–{cur.goal_max} · {weekReading(cur.done, cur.goal_min, cur.goal_max, true)}
      </span>
    </button>
  )
}

