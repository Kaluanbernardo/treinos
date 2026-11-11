import { useEffect, useId, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, MessageCircle, UserRound } from 'lucide-react'
import {
  Area, Bar, ComposedChart, CartesianGrid, Line, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis,
  type TooltipContentProps,
} from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { useDayTargets } from '../lib/api'
import {
  type BalanceDayState, type CumulativeKind, type CumulativePoint, type CumulativeSummary, KCAL_PER_KG_FAT, clipToData, cumulativeBalance,
  cumulativeRange, signedInt,
} from '../lib/balance'
import { capitalize, dm, intFmt, monthLabel, num, plural, todaySP, wdShort } from '../lib/format'
import { useMedia } from '../lib/media'
import { go } from '../lib/router'
import type { DayTarget } from '../lib/types'
import { Badge, Button, Collecting, ErrorState, IconButton, Segmented, Skeleton } from './ui'
import { Big } from './viz'

/**
 * Saldo calórico acumulado (modo Kcal do calendário). Duas linhas no mesmo eixo, a mesma unidade (kcal):
 *   real = Σ (comida − gasto) dia a dia; zero = manutenção; abaixo = déficit (verde), acima = superávit (âmbar)
 *   meta = Σ saldo-alvo (−300) nos MESMOS dias; tracejada e neutra
 * Embaixo, alinhadas no mesmo eixo de datas, as barras do saldo de cada dia (escala própria: outro painel).
 * Dias fora da conta (hoje, diário incompleto, sem refeição, sem basal) não somam em nenhuma das linhas:
 * elas ficam paradas e o dia ganha um anel vazio nas barras. Regra em docs/calorias.md, contas em lib/balance.ts.
 */

const AXIS = { stroke: 'var(--color-muted)', fontSize: 12, tickLine: false, axisLine: false } as const
const Y_W = 52
const MIN_DAYS = 2

const KINDS: { value: CumulativeKind; label: string }[] = [
  { value: 'semana', label: 'Semana' }, { value: 'mes', label: 'Mês' }, { value: '90d', label: '90 dias' }, { value: 'tudo', label: 'Tudo' },
]

const OUT_NOTE: Record<Exclude<BalanceDayState, 'counted'>, string> = {
  today: 'hoje, em andamento', incomplete: 'diário incompleto', no_food: 'sem refeição registrada', no_bmr: 'sem basal', future: 'ainda por vir',
}

/** Passo "redondo" do eixo e domínio que inclui o zero. */
function niceDomain(lo: number, hi: number): { domain: [number, number]; ticks: number[] } {
  const span = Math.max(hi - lo, 1)
  const step = [100, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 50000].find((s) => span / s <= 4) ?? 100000
  const d0 = Math.floor(Math.min(lo, 0) / step) * step
  const d1 = Math.ceil(Math.max(hi, 0) / step) * step
  const domain: [number, number] = [d0 === d1 ? d0 - step : d0, d1]
  return { domain, ticks: Array.from({ length: Math.round((domain[1] - domain[0]) / step) + 1 }, (_, i) => domain[0] + i * step) }
}

/** Rótulos do eixo num formato só: em "mil" quando o eixo passa de 10 mil, senão o número cheio. */
const tickFor = (domain: [number, number]) => {
  const big = Math.max(Math.abs(domain[0]), Math.abs(domain[1])) >= 10000
  return (v: number) => (v === 0 ? '0' : `${v > 0 ? '+' : '−'}${big ? `${num(Math.abs(v) / 1000, Math.abs(v) % 1000 ? 1 : 0)} mil` : intFmt(Math.abs(v))}`)
}
const wdDm = (iso: string) => `${capitalize(wdShort(iso)).slice(0, 3)} ${dm(iso)}`

function rangeTitle(kind: CumulativeKind, from: string, offset: number) {
  if (kind === 'mes') return offset === 0 ? 'Este mês' : offset === -1 ? 'Mês passado' : capitalize(monthLabel(from))
  if (kind === 'semana') return offset === 0 ? 'Esta semana' : offset === -1 ? 'Semana passada' : `Há ${-offset} semanas`
  return kind === '90d' ? 'Últimos 90 dias' : 'Desde o primeiro registro'
}

export function SaldoAcumulado() {
  const today = todaySP()
  const desk = useMedia('(min-width: 1024px)')
  const hover = useMedia('(hover: hover)')
  const [kind, setKind] = useState<CumulativeKind>('mes')
  const [offset, setOffset] = useState(0)
  // "Tudo": lê desde o começo e o período começa no 1º dia que a view tem
  const ask = kind === 'tudo' ? { from: '2000-01-01', to: today } : cumulativeRange(kind, today, offset)
  const q = useDayTargets(ask.from, ask.to < today ? ask.to : today)
  // o período começa no 1º dia com dados (antes do registro não é "sem refeição")
  const range = clipToData(kind === 'tudo' ? cumulativeRange('tudo', today, 0, q.data?.[0]?.date ?? null) : ask, q.data ?? [])
  const c = useMemo(() => cumulativeBalance<DayTarget>(q.data ?? [], range, today), [q.data, range.from, range.to, today])   // eslint-disable-line react-hooks/exhaustive-deps
  const lastCounted = [...c.points].reverse().find((p) => p.state === 'counted')?.date ?? null
  const [sel, setSel] = useState<string | null>(null)
  useEffect(() => { setSel(null) }, [kind, offset])
  const selected = c.points.find((p) => p.date === (sel ?? lastCounted)) ?? null
  const noBmr = (q.data ?? []).some((r) => r.food_logged && r.bmr_kcal == null) && c.counted === 0

  return (
    <div className="mt-3">
      <Segmented size="sm" label="Período do saldo acumulado" value={kind} onChange={(v) => { setKind(v); setOffset(0) }} options={KINDS} track="bg-bg/70 ring-1 ring-line" />
      <div className="mt-2 flex min-h-12 items-center justify-between gap-2">
        {kind === 'semana' || kind === 'mes' ? (
          <IconButton label={kind === 'semana' ? 'Semana anterior' : 'Mês anterior'} onClick={() => setOffset(offset - 1)} className="-ml-2"><ChevronLeft size={22} /></IconButton>
        ) : <span className="w-10" aria-hidden="true" />}
        <p className="min-w-0 text-center" aria-live="polite">
          <span className="block font-semibold">{rangeTitle(kind, range.from, offset)}</span>
          <span className="block text-[13px] tabular-nums text-muted">{dm(range.from)} a {dm(range.to)}{range.clipped && ' · início do registro'}</span>
        </p>
        {kind === 'semana' || kind === 'mes' ? (
          <IconButton label={kind === 'semana' ? 'Próxima semana' : 'Próximo mês'} onClick={() => setOffset(Math.min(0, offset + 1))} disabled={offset >= 0} className="-mr-2 disabled:opacity-30">
            <ChevronRight size={22} />
          </IconButton>
        ) : <span className="w-10" aria-hidden="true" />}
      </div>

      {q.isError ? (
        <div className="mt-3"><ErrorState what="o saldo acumulado" message={q.error?.message} onRetry={() => q.refetch()} /></div>
      ) : q.isPending ? (
        <Skeleton className="mt-3 h-80" />
      ) : noBmr ? (
        <div className="mt-3">
          <Collecting title="Sem basal, sem saldo" icon={<UserRound size={20} />}>
            Complete altura, nascimento e sexo para calcular o gasto.
            <Button className="mt-3 w-full" onClick={() => go('config/perfil')}>Completar em Configurações</Button>
          </Collecting>
        </div>
      ) : c.counted < MIN_DAYS ? (
        <div className="mt-3 flex flex-col gap-3">
          <Collecting title="Coletando dados" icon={<MessageCircle size={20} />} progress={{ have: c.counted, need: MIN_DAYS, unit: 'dias na conta' }}>
            O acumulado aparece com {MIN_DAYS} dias fechados com refeição registrada no período.
          </Collecting>
          <OutOfCount c={c} />
        </div>
      ) : (
        <>
          <Hero c={c} />
          {/* key: remonta o Recharts a cada período (o número de dias muda e o layout recomeça limpo) */}
          <CumulativeChart key={`${kind}:${range.from}:${range.to}`} c={c} kind={kind} desk={desk} hover={hover} selected={selected?.date ?? null} onPick={setSel} />
          <Legend />
          <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
            <DayReadout p={selected} />
            <OutOfCount c={c} />
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4">
            <Stat label="Dias em déficit" value={intFmt(c.deficitDays)} />
            <Stat label="Em superávit" value={intFmt(c.surplusDays)} />
            <Stat label="Média por dia" value={signedInt(Math.round(c.total! / c.counted))} unit="kcal" />
          </dl>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- número principal
function Hero({ c }: { c: CumulativeSummary<DayTarget> }) {
  const total = Math.round(c.total!)
  const target = Math.round(c.target!)
  const vs = Math.round(c.vsTarget!)
  const deficit = total < 0
  return (
    <div className="mt-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] text-muted">Saldo real acumulado · {plural(c.counted, 'dia', 'dias')} na conta</p>
          <Big size="lg" className="mt-1" value={signedInt(total)} unit="kcal" />
        </div>
        <Badge tone={total > 0 ? 'warn' : 'ok'} className="mt-1">
          {deficit ? <ArrowDownRight size={14} strokeWidth={2.5} aria-hidden="true" /> : <ArrowUpRight size={14} strokeWidth={2.5} aria-hidden="true" />}
          {total > 0 ? 'superávit' : total < 0 ? 'déficit' : 'empate'}
        </Badge>
      </div>
      <p className="mt-1.5 text-[15px] leading-snug tabular-nums text-muted">
        Meta no período <b className="font-semibold text-fg">{signedInt(target)}</b> ({plural(c.counted, 'dia', 'dias')} × {signedInt(Math.round(target / c.counted))})
        {' · '}{vs === 0 ? 'em cima da meta' : vs > 0 ? <><b className="font-semibold text-fg">{intFmt(vs)}</b> kcal acima da meta</> : <><b className="font-semibold text-fg">{intFmt(-vs)}</b> kcal além da meta</>}
        {' · '}≈ {num(Math.abs(total) / KCAL_PER_KG_FAT, 2)} kg de gordura {total > 0 ? 'a mais' : 'a menos'}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------- gráfico
/** `excl`: 0 nos dias fora da conta (anel vazio na linha do zero das barras), null nos outros. */
interface Row extends CumulativePoint { excl: number | null }

function CumulativeChart({ c, kind, desk, hover, selected, onPick }: {
  c: CumulativeSummary<DayTarget>; kind: CumulativeKind; desk: boolean; hover: boolean; selected: string | null; onPick: (d: string) => void
}) {
  const gid = useId().replace(/:/g, '')
  const data: Row[] = c.points.map((p) => ({ ...p, excl: p.state !== 'counted' && p.state !== 'future' ? 0 : null }))
  const totals = c.points.map((p) => p.total).filter((v): v is number => v != null)
  const lo = Math.min(...totals)
  const hi = Math.max(...totals)
  const { domain, ticks } = niceDomain(c.lo, c.hi)
  const tick = tickFor(domain)
  const days = c.points.map((p) => p.day).filter((v): v is number => v != null)
  const bars = niceDomain(Math.min(0, ...days), Math.max(0, ...days))
  const barTick = tickFor(bars.domain)
  // gradiente na caixa do traço (min..max do acumulado) e na da área (até o zero): o corte cai no zero
  const strokeCut = hi <= 0 ? 0 : lo >= 0 ? 1 : hi / (hi - lo)
  const fillHi = Math.max(hi, 0)
  const fillLo = Math.min(lo, 0)
  const fillCut = fillHi === fillLo ? 0 : fillHi / (fillHi - fillLo)
  // só usa o gradiente quando a linha cruza o zero (senão a ponta arredondada sai da caixa e pega a outra cor)
  const crosses = lo < 0 && hi > 0
  const lineColor = crosses ? `url(#${gid}-s)` : hi > 0 ? 'var(--color-warn)' : 'var(--color-ok)'
  const lastIdx = data.reduce((k, p, i) => (p.total != null ? i : k), -1)
  // rótulos do fim: o de cima sobe, o de baixo desce (não encavalam quando as linhas terminam perto)
  const H = desk ? 248 : 208
  const HB = desk ? 120 : 104
  const M = { top: 14, bottom: 12 }
  const gapPx = (Math.abs(c.total! - c.target!) / (domain[1] - domain[0])) * (H - M.top - M.bottom)
  const realAbove = c.total! >= c.target!
  const dyReal = gapPx >= 16 ? 4 : realAbove ? -2 : 13
  const dyMeta = gapPx >= 16 ? 4 : realAbove ? 13 : -2
  const label = (iso: string) => (kind === 'semana' ? capitalize(wdShort(iso)).slice(0, 3) : dm(iso))
  const many = data.length > 45
  const pick = (s: { activeLabel?: string | number } | null) => { const d = s?.activeLabel; if (typeof d === 'string') onPick(d) }

  return (
    <figure className="-mx-1 mt-4" aria-label={`Saldo real acumulado de ${dm(c.points[0].date)} a ${dm(c.points.at(-1)!.date)}: ${signedInt(Math.round(c.total!))} kcal; meta acumulada ${signedInt(Math.round(c.target!))} kcal`}>
      <div style={{ height: H }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} syncId="saldo-acumulado" margin={{ top: M.top, right: 56, bottom: M.bottom, left: 0 }} onClick={pick}>
            <defs>
              <linearGradient id={`${gid}-s`} x1="0" y1="0" x2="0" y2="1">
                <stop offset={0} stopColor="var(--color-warn)" />
                <stop offset={strokeCut} stopColor="var(--color-warn)" />
                <stop offset={strokeCut} stopColor="var(--color-ok)" />
                <stop offset={1} stopColor="var(--color-ok)" />
              </linearGradient>
              <linearGradient id={`${gid}-f`} x1="0" y1="0" x2="0" y2="1">
                <stop offset={0} stopColor="var(--color-warn)" stopOpacity={0.16} />
                <stop offset={fillCut} stopColor="var(--color-warn)" stopOpacity={0.04} />
                <stop offset={fillCut} stopColor="var(--color-ok)" stopOpacity={0.04} />
                <stop offset={1} stopColor="var(--color-ok)" stopOpacity={0.16} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--color-grid)" />
            <XAxis dataKey="date" hide />
            <YAxis {...AXIS} width={Y_W} domain={domain} ticks={ticks} tickFormatter={tick} interval={0} />
            <ReferenceLine y={0} stroke="var(--color-muted)" strokeOpacity={0.75} />
            <Area type="linear" dataKey="total" baseValue={0} stroke="none" fill={`url(#${gid}-f)`} isAnimationActive={false} connectNulls={false} />
            <Line type="linear" dataKey="target" stroke="var(--color-fg)" strokeOpacity={0.6} strokeWidth={1.5} strokeDasharray="5 4" dot={false}
              activeDot={false} isAnimationActive={false}
              label={(p: { x?: number | string; y?: number | string; index?: number }) =>
                p.index === lastIdx && p.x != null && p.y != null
                  ? <text x={Number(p.x) + 6} y={Number(p.y) + dyMeta} fill="var(--color-muted)" fontSize={12}>meta</text> : <g />} />
            <Line type="linear" dataKey="total" stroke={lineColor} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" animationDuration={500}
              dot={false} activeDot={{ r: 4.5, fill: 'var(--color-fg)', stroke: 'var(--color-card)', strokeWidth: 2 }}
              label={(p: { x?: number | string; y?: number | string; index?: number }) =>
                p.index === lastIdx && p.x != null && p.y != null
                  ? <text x={Number(p.x) + 6} y={Number(p.y) + dyReal} fill="var(--color-fg)" fontSize={13} fontWeight={700}>{signedInt(Math.round(c.total!))}</text> : <g />} />
            {hover && <Tooltip cursor={{ stroke: 'var(--color-muted)', strokeDasharray: '3 3' }} content={(p: TooltipContentProps<ValueType, NameType>) => <Tip p={p} />} />}
            {!hover && <Tooltip cursor={{ stroke: 'var(--color-muted)', strokeDasharray: '3 3' }} content={() => null} />}
            {selected && <ReferenceLine x={selected} stroke="var(--color-fg)" strokeOpacity={0.35} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 pl-[52px] text-[12px] text-muted" aria-hidden="true">Saldo de cada dia</p>
      <div style={{ height: HB }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} syncId="saldo-acumulado" margin={{ top: 10, right: 56, bottom: 0, left: 0 }} barCategoryGap={many ? '10%' : '16%'} onClick={pick}>
            <CartesianGrid vertical={false} stroke="var(--color-grid)" />
            <XAxis dataKey="date" {...AXIS} tickFormatter={label} interval="preserveStartEnd" minTickGap={many ? 24 : 12} />
            <YAxis {...AXIS} width={Y_W} domain={bars.domain} ticks={bars.ticks.length > 3 ? [bars.domain[0], 0, bars.domain[1]] : bars.ticks} tickFormatter={barTick} interval={0} />
            <ReferenceLine y={0} stroke="var(--color-muted)" strokeOpacity={0.75} />
            <Bar dataKey="day" isAnimationActive={false} cursor="pointer"
              shape={(p: { x?: number; y?: number; width?: number; height?: number; payload?: Row }) => {
                const { x = 0, width = 0 } = p
                let { y = 0, height: h = 0 } = p
                if (h < 0) { y += h; h = -h }
                if (!h || p.payload?.day == null) return <g />
                const w = Math.min(width, 24)
                const x0 = x + (width - w) / 2
                const r = Math.min(4, w / 2, h)
                const down = p.payload.day < 0
                const d = down
                  ? `M${x0},${y} V${y + h - r} Q${x0},${y + h} ${x0 + r},${y + h} H${x0 + w - r} Q${x0 + w},${y + h} ${x0 + w},${y + h - r} V${y} Z`
                  : `M${x0},${y + h} V${y + r} Q${x0},${y} ${x0 + r},${y} H${x0 + w - r} Q${x0 + w},${y} ${x0 + w},${y + r} V${y + h} Z`
                const on = !selected || p.payload.date === selected
                return <path d={d} fill={down ? 'var(--color-ok)' : 'var(--color-warn)'} fillOpacity={on ? 1 : 0.72} />
              }} />
            <Scatter dataKey="excl" isAnimationActive={false}
              shape={(p: { cx?: number; cy?: number; payload?: Row }) => p.cx == null || p.cy == null || p.payload?.excl == null ? <g />
                : <circle cx={p.cx} cy={p.cy} r={many ? 2.5 : 3.5} fill="var(--color-card)" stroke="var(--color-muted)" strokeWidth={1.5} />} />
            <Tooltip cursor={{ fill: 'var(--color-fg)', fillOpacity: 0.05 }} content={() => null} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <DataTable c={c} />
    </figure>
  )
}

function Tip({ p }: { p: TooltipContentProps<ValueType, NameType> }) {
  const row = p.payload?.[0]?.payload as Row | undefined
  if (!p.active || !row) return null
  return (
    <div className="rounded-xl border border-line bg-card-2 px-3 py-2 text-sm shadow-[var(--shadow-tip)]">
      <p className="text-muted">{wdDm(row.date)}</p>
      <ReadoutLines p={row} />
    </div>
  )
}

function ReadoutLines({ p }: { p: CumulativePoint }) {
  if (p.state !== 'counted') {
    return <p>{OUT_NOTE[p.state]}{p.state !== 'future' && p.state !== 'today' ? ': fora da conta' : ''}</p>
  }
  return (
    <>
      <p className="tabular-nums">Dia <b>{signedInt(Math.round(p.day!))}</b> {p.day! < 0 ? 'déficit' : p.day! > 0 ? 'superávit' : ''}</p>
      <p className="tabular-nums">Acumulado <b>{signedInt(Math.round(p.total!))}</b> · meta {signedInt(Math.round(p.target!))}</p>
      {p.food != null && p.out != null && <p className="tabular-nums text-muted">comida {intFmt(p.food)} · gasto {intFmt(p.out)}</p>}
    </>
  )
}

/** Leitura do dia tocado (padrão: o último dia na conta). No celular substitui a dica flutuante. */
function DayReadout({ p }: { p: CumulativePoint | null }) {
  if (!p) return null
  const counted = p.state === 'counted'
  return (
    <div className="mt-3 rounded-2xl bg-bg/60 px-4 py-3 ring-1 ring-line" aria-live="polite">
      <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="font-semibold">{wdDm(p.date)}</span>
        {counted
          ? <span className={`text-[15px] font-semibold tabular-nums ${p.day! > 0 ? 'text-warn' : 'text-ok'}`}>{signedInt(Math.round(p.day!))} kcal no dia</span>
          : <span className="text-[15px] text-muted">{OUT_NOTE[p.state as Exclude<BalanceDayState, 'counted'>]}</span>}
      </p>
      {counted ? (
        <p className="mt-1 text-[15px] tabular-nums text-muted">
          Acumulado <b className="font-semibold text-fg">{signedInt(Math.round(p.total!))}</b> · meta {signedInt(Math.round(p.target!))}
          {p.food != null && p.out != null && <> · comida {intFmt(p.food)} de {intFmt(p.out)} gastas</>}
        </p>
      ) : p.state !== 'future' && (
        <p className="mt-1 text-[15px] text-muted">Fora da conta: não soma no saldo real nem na meta.</p>
      )}
    </div>
  )
}

function Legend() {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-muted">
      <li className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full bg-ok" aria-hidden="true" />déficit acumulado</li>
      <li className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full bg-warn" aria-hidden="true" />superávit acumulado</li>
      <li className="flex items-center gap-1.5">
        <svg width="16" height="4" aria-hidden="true"><line x1="0" y1="2" x2="16" y2="2" stroke="var(--color-fg)" strokeOpacity="0.6" strokeWidth="1.5" strokeDasharray="5 3" /></svg>
        meta −300/dia, acumulada
      </li>
      <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-muted" aria-hidden="true" />fora da conta</li>
      <li>0 = manutenção (comida = basal + atividades)</li>
    </ul>
  )
}

/** O que não entrou no total e por quê. Decisão: dia com diário incompleto fica FORA (não soma em nenhuma linha). */
function OutOfCount({ c }: { c: CumulativeSummary<DayTarget> }) {
  const s = c.summary
  const list = (dates: string[]) => (dates.length <= 4 ? dates.map(dm).join(', ') : plural(dates.length, 'dia', 'dias'))
  const rows = [
    s.hasToday && { k: 'Hoje (em andamento)', v: 'soma ao fechar' },
    s.incomplete.length > 0 && { k: 'Diário incompleto', v: list(s.incomplete) },
    s.noFood.length > 0 && { k: 'Sem refeição', v: list(s.noFood) },
    s.noBmr.length > 0 && { k: 'Sem basal', v: list(s.noBmr) },
  ].filter(Boolean) as { k: string; v: string }[]
  if (rows.length === 0) return null
  return (
    <div className="mt-3">
      <h3 className="text-[15px] font-semibold">Fora da conta</h3>
      <p className="text-[13px] text-muted">Não somam no saldo real nem na meta: um dia sem tudo registrado inventaria déficit.</p>
      <dl className="mt-1 flex flex-col gap-1 text-[15px]">
        {rows.map((r) => (
          <div key={r.k} className="flex items-baseline justify-between gap-4">
            <dt className="shrink-0 text-muted">{r.k}</dt>
            <dd className="text-right tabular-nums">{r.v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** Tabela equivalente ao gráfico para leitor de tela. */
function DataTable({ c }: { c: CumulativeSummary<DayTarget> }) {
  return (
    // sr-only numa <table> não prende a largura (a tabela transborda a página): o recorte fica numa div
    <div className="sr-only"><table>
      <caption>Saldo por dia, acumulado real e meta acumulada</caption>
      <thead><tr><th>Dia</th><th>Saldo do dia</th><th>Acumulado</th><th>Meta acumulada</th></tr></thead>
      <tbody>
        {c.points.filter((p) => p.state !== 'future').map((p) => (
          <tr key={p.date}>
            <td>{dm(p.date)}</td>
            <td>{p.day != null ? `${signedInt(Math.round(p.day))} kcal` : OUT_NOTE[p.state as Exclude<BalanceDayState, 'counted'>]}</td>
            <td>{p.total != null ? signedInt(Math.round(p.total)) : '—'}</td>
            <td>{p.target != null ? signedInt(Math.round(p.target)) : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table></div>
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
