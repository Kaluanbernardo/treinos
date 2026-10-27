import { useEffect, useId, useState, type ReactNode } from 'react'
import { ArrowDownRight, ArrowRight, ArrowUpRight, Check, X } from 'lucide-react'
import { capitalize, signed, wdShort } from '../lib/format'

/**
 * Primitivas visuais em SVG inline (sem libs): sparkline, barra com meta, anéis concêntricos,
 * delta com seta + palavra, número protagonista e faixa da semana.
 */

// ---------------------------------------------------------------- sparkline
/** Linha de 2 px na cor da métrica, área a 15 %, último ponto marcado. Nunca desenha com < 2 pontos. */
export function Spark({ values, color, width = 132, height = 40, label, className = '' }: {
  values: number[]; color: string; width?: number; height?: number; label: string; className?: string
}) {
  const gid = useId().replace(/:/g, '')
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pad = 4
  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2)
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2)
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`)
  const lx = x(values.length - 1)
  const ly = y(values[values.length - 1])
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className={`shrink-0 overflow-visible ${className}`}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.15} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`M${pts[0]} L${pts.slice(1).join(' L')} L${lx},${height} L${pad},${height} Z`} fill={`url(#${gid})`} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r={3.5} fill={color} stroke="var(--color-card)" strokeWidth={2} />
    </svg>
  )
}

// ---------------------------------------------------------------- barra de progresso
/**
 * Barra arredondada com o preenchimento na proporção real. `target` vira um tique de 2 px;
 * `band` pinta a faixa da meta (mín–máx). Acima de `max`, a ponta passa para âmbar.
 */
export function Meter({ value, max, color, target, band, height = 8, label, className = '' }: {
  value: number; max: number; color: string; target?: number | null; band?: [number, number] | null
  height?: number; label: string; className?: string
}) {
  const [shown, setShown] = useState(0)
  useEffect(() => { const t = requestAnimationFrame(() => setShown(value)); return () => cancelAnimationFrame(t) }, [value])
  const scale = Math.max(max, value, target ?? 0, band?.[1] ?? 0) || 1
  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / scale) * 100))}%`
  const over = target != null && value > target
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={Math.round(scale)} aria-valuenow={Math.round(value)}
      className={`relative w-full rounded-full bg-line ${className}`} style={{ height }}>
      {band && <div className="absolute inset-y-0 rounded-full bg-ok/25" style={{ left: pct(band[0]), width: `calc(${pct(band[1])} - ${pct(band[0])})` }} aria-hidden="true" />}
      <div className="meter-fill absolute inset-y-0 left-0 rounded-full" style={{ width: pct(shown), background: color }} aria-hidden="true" />
      {over && target != null && (
        <div className="absolute inset-y-0 rounded-r-full bg-warn" style={{ left: pct(target), width: `calc(${pct(shown)} - ${pct(target)})` }} aria-hidden="true" />
      )}
      {target != null && (
        <div className="absolute -inset-y-1 w-0.5 rounded-full bg-fg" style={{ left: `calc(${pct(target)} - 1px)` }} aria-hidden="true" />
      )}
    </div>
  )
}

// ---------------------------------------------------------------- anéis concêntricos
export interface RingSpec { value: number; target: number | null; color: string; label: string }

/** Anéis concêntricos (fora → dentro), trilho `line`, arco arredondado na cor da métrica. Cresce ao abrir. */
export function Rings({ rings, size = 148, stroke = 13, gap = 4, children }: {
  rings: RingSpec[]; size?: number; stroke?: number; gap?: number; children?: ReactNode
}) {
  const [on, setOn] = useState(false)
  useEffect(() => { const t = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(t) }, [])
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={rings.map((r) => r.label).join('; ')}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        {rings.map((r, i) => {
          const rad = size / 2 - stroke / 2 - i * (stroke + gap)
          const c = 2 * Math.PI * rad
          const frac = r.target ? Math.min(1, r.value / r.target) : 0
          return (
            <g key={i}>
              <circle cx={size / 2} cy={size / 2} r={rad} fill="none" stroke={r.color} strokeOpacity={0.16} strokeWidth={stroke} />
              {frac > 0 && (
                <circle className="ring-arc" cx={size / 2} cy={size / 2} r={rad} fill="none" stroke={r.color} strokeWidth={stroke}
                  strokeLinecap="round" strokeDasharray={c} strokeDashoffset={on ? c * (1 - frac) : c} />
              )}
            </g>
          )
        })}
      </svg>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>}
    </div>
  )
}

// ---------------------------------------------------------------- delta
const WORD = { down: 'caindo', flat: 'estável', up: 'subindo' } as const

/** Seta desenhada + valor com sinal (+ palavra opcional). Cor diz bom/ruim, nunca só a cor. */
export function Delta({ value, unit, digits = 1, good, word = false, className = '' }: {
  value: number | null | undefined; unit: string; digits?: number; good: 'down' | 'up'; word?: boolean; className?: string
}) {
  if (value == null) return null
  const r = Number(value.toFixed(digits))
  const dir = r > 0 ? 'up' : r < 0 ? 'down' : 'flat'
  const tone = dir === 'flat' ? 'text-muted' : dir === good ? 'text-ok' : 'text-warn'
  const Icon = dir === 'up' ? ArrowUpRight : dir === 'down' ? ArrowDownRight : ArrowRight
  return (
    <span className={`inline-flex items-center gap-1 font-semibold tabular-nums ${tone} ${className}`}>
      <Icon size={18} strokeWidth={2.5} aria-hidden="true" />
      {signed(r, digits)}{unit && <span className="font-medium">{unit === '%' ? '%' : ` ${unit}`}</span>}
      {word && <span className="sr-only"> ({WORD[dir]})</span>}
    </span>
  )
}

// ---------------------------------------------------------------- número protagonista
export function Big({ value, unit, size = 'lg', className = '' }: {
  value: ReactNode; unit?: ReactNode; size?: 'xl' | 'lg' | 'md' | 'sm'; className?: string
}) {
  const s = { xl: 'text-[56px] tracking-[-0.03em]', lg: 'text-[44px] tracking-[-0.02em]', md: 'text-[32px] tracking-[-0.02em]', sm: 'text-2xl' }[size]
  const u = { xl: 'text-xl', lg: 'text-lg', md: 'text-base', sm: 'text-sm' }[size]
  return (
    <span className={`inline-flex items-baseline gap-1 font-bold leading-none tabular-nums ${s} ${className}`}>
      {value}
      {unit != null && <span className={`font-medium tracking-normal text-muted ${u}`}>{unit}</span>}
    </span>
  )
}

// ---------------------------------------------------------------- faixa da semana
export type DayMark = 'done' | 'missed' | 'pending' | 'skipped'
export interface WeekDay { date: string; label: string; marks: DayMark[]; today: boolean; future: boolean }

/** 7 colunas: dia, número e um ponto por atividade (✓ feito, ✕ faltou, anel = a fazer). */
export function WeekStrip({ days, onPick }: { days: WeekDay[]; onPick?: (date: string) => void }) {
  return (
    <ol className="grid grid-cols-7 gap-1" aria-label="Semana">
      {days.map((d) => {
        const done = d.marks.filter((m) => m === 'done').length
        const total = d.marks.filter((m) => m !== 'skipped').length
        const inner = (
          <>
            <span className={`text-xs font-medium ${d.today ? 'text-lime' : 'text-muted'}`}>{d.label}</span>
            <span className={`mt-1 flex h-9 w-9 items-center justify-center rounded-full text-[15px] font-semibold tabular-nums ${
              d.today ? 'action-fill' : total && done === total ? 'bg-ok/15 text-ok' : 'text-fg'}`}>
              {total > 0 && done === total && !d.today ? <Check size={18} strokeWidth={3} aria-hidden="true" /> : Number(d.date.slice(8))}
            </span>
            <span className="mt-1.5 flex h-2 items-center gap-0.5" aria-hidden="true">
              {d.marks.map((m, i) => <Pip key={i} m={m} />)}
            </span>
          </>
        )
        const aria = `${d.label} ${Number(d.date.slice(8))}: ${total ? `${done} de ${total} feitas` : 'folga'}`
        return (
          <li key={d.date}>
            {onPick ? (
              <button type="button" onClick={() => onPick(d.date)} aria-label={aria}
                className="flex min-h-[72px] w-full flex-col items-center rounded-2xl py-1.5 transition-colors duration-150 hover:bg-card-2">{inner}</button>
            ) : (
              <div className="flex min-h-[72px] flex-col items-center py-1.5" aria-label={aria}>{inner}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

function Pip({ m }: { m: DayMark }) {
  if (m === 'done') return <span className="h-1.5 w-1.5 rounded-full bg-ok" />
  if (m === 'missed') return <X size={9} strokeWidth={4} className="text-muted" />
  if (m === 'skipped') return <span className="h-0.5 w-1.5 rounded-full bg-line" />
  return <span className="h-1.5 w-1.5 rounded-full ring-[1.5px] ring-muted ring-inset" />
}

// ---------------------------------------------------------------- colunas feito × planejado
export interface PlanBar { key: string; label: string; done: number; planned: number; current?: boolean }

/** Colunas por período: trilho = planejado, preenchimento = feito. A coluna atual ganha a cor cheia. */
export function PlanBars({ data, color, height = 72, label }: { data: PlanBar[]; color: string; height?: number; label: string }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.done, d.planned)))
  return (
    <figure aria-label={label}>
      <div className="flex items-end gap-1.5" style={{ height }} role="img"
        aria-label={data.map((d) => `${d.label}: ${d.done} de ${d.planned}`).join('; ')}>
        {data.map((d) => (
          <div key={d.key} className="relative flex h-full flex-1 flex-col justify-end">
            <div className="relative w-full rounded-[4px] bg-line" style={{ height: `${(Math.max(d.planned, d.done) / max) * 100}%`, minHeight: d.planned ? 4 : 0 }}>
              <div className="meter-fill absolute inset-x-0 bottom-0 rounded-[4px]"
                style={{ height: `${d.planned ? Math.min(1, d.done / Math.max(d.planned, d.done)) * 100 : d.done ? 100 : 0}%`, background: d.current ? color : 'var(--color-muted)', opacity: d.current ? 1 : 0.6 }} />
            </div>
          </div>
        ))}
      </div>
      <figcaption className="mt-1.5 flex gap-1.5 text-[11px] tabular-nums text-muted" aria-hidden="true">
        {data.map((d) => <span key={d.key} className={`flex-1 text-center ${d.current ? 'font-semibold text-fg' : ''}`}>{d.label}</span>)}
      </figcaption>
    </figure>
  )
}

// ---------------------------------------------------------------- data
/** Quadradinho "Qua / 28" (lime quando é hoje). */
export function DateTile({ iso, active = false }: { iso: string; active?: boolean }) {
  return (
    <span className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl ${active ? 'action-fill' : 'bg-card-2'}`} aria-hidden="true">
      <span className={`text-xs font-medium ${active ? 'text-on-action/80' : 'text-muted'}`}>{capitalize(wdShort(iso)).slice(0, 3)}</span>
      <span className="text-xl font-bold leading-none tabular-nums">{Number(iso.slice(8))}</span>
    </span>
  )
}
