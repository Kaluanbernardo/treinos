import { useId, type ReactNode } from 'react'
import {
  Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer,
  Scatter, Tooltip, XAxis, YAxis, type TooltipContentProps,
} from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { dm, num } from '../lib/format'

const AXIS = { stroke: 'var(--color-muted)', fontSize: 12, tickLine: false, axisLine: false } as const
const GRID = 'rgb(42 49 64 / 0.55)'
const ts = (iso: string) => Date.parse(`${iso}T12:00:00Z`)
const fromTs = (t: number) => new Date(t).toISOString().slice(0, 10)

export interface TrendPoint { date: string; value?: number | null; avg?: number | null; label?: string }

function TipBox({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-line bg-card-2 px-3 py-2 text-sm shadow-[0_8px_20px_-8px_rgb(0_0_0/0.7)]">{children}</div>
}

/**
 * Linha de tendência: pontos discretos (valor do dia) + linha principal (média/valor) com área a 15 %.
 * Um eixo só; último valor rotulado; faixa/linha de meta opcional.
 */
export function TrendChart({ data, color, unit, digits = 1, height = 200, dots = true, line = 'avg', band, refLine, ariaLabel, valueName = 'Dia', avgName = 'Média 7d' }: {
  data: TrendPoint[]; color: string; unit: string; digits?: number; height?: number; dots?: boolean
  line?: 'avg' | 'value'; band?: [number, number] | null; refLine?: number | null; ariaLabel: string
  valueName?: string; avgName?: string
}) {
  const gid = useId().replace(/:/g, '')
  const pts = data.map((d) => ({ t: ts(d.date), value: d.value ?? null, avg: line === 'avg' ? d.avg ?? null : d.value ?? null, label: d.label }))
  const key = 'avg'
  const vals = pts.flatMap((p) => [p.value, p.avg]).filter((v): v is number => v != null)
  if (band) vals.push(...band)
  if (refLine != null) vals.push(refLine)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const pad = Math.max((max - min) * 0.15, unit === 'kg' || unit === 'cm' ? 0.5 : 1)
  const domain: [number, number] = [Math.floor((min - pad) * 2) / 2, Math.ceil((max + pad) * 2) / 2]
  const last = [...pts].reverse().find((p) => p[key] != null)
  const span = pts.length > 1 ? pts[pts.length - 1].t - pts[0].t : 0

  return (
    <figure aria-label={ariaLabel} className="-mx-1">
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={pts} margin={{ top: 22, right: 44, bottom: 0, left: -12 }}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.15} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} {...AXIS}
              tickFormatter={(t: number) => dm(fromTs(t))} minTickGap={28} padding={{ left: 8, right: 8 }}
              ticks={span ? undefined : [pts[0]?.t]} />
            <YAxis domain={domain} {...AXIS} width={44} tickCount={4} tickFormatter={(v: number) => num(v, v % 1 ? 1 : 0)} />
            {band && <ReferenceArea y1={band[0]} y2={band[1]} fill="var(--color-ok)" fillOpacity={0.08} stroke="none" ifOverflow="extendDomain" />}
            {refLine != null && <ReferenceLine y={refLine} stroke="var(--color-muted)" strokeDasharray="4 4" strokeOpacity={0.7} />}
            <Area type="monotone" dataKey={key} stroke="none" fill={`url(#${gid})`} connectNulls isAnimationActive={false} />
            {dots && line === 'avg' && (
              <Scatter dataKey="value" fill="var(--color-muted)" fillOpacity={0.9} shape={(p: { cx?: number; cy?: number }) =>
                p.cx == null || p.cy == null ? <g /> : <circle cx={p.cx} cy={p.cy} r={3} fill="var(--color-muted)" stroke="var(--color-card)" strokeWidth={1.5} />} />
            )}
            <Line type="monotone" dataKey={key} stroke={color} strokeWidth={2} connectNulls animationDuration={500}
              dot={line === 'value' && pts.length <= 16 ? { r: 3.5, fill: color, stroke: 'var(--color-card)', strokeWidth: 2 } : false}
              activeDot={{ r: 5, fill: color, stroke: 'var(--color-card)', strokeWidth: 2 }}
              label={(p: { x?: number | string; y?: number | string; index?: number }) =>
                last && p.index === pts.indexOf(last) && p.x != null && p.y != null
                  ? <text x={Number(p.x) + 8} y={Number(p.y) + 4} fill="var(--color-fg)" fontSize={13} fontWeight={700}>{num(last[key], digits)}</text>
                  : <g />} />
            <Tooltip
              cursor={{ stroke: 'var(--color-muted)', strokeDasharray: '3 3' }}
              content={(p: TooltipContentProps<ValueType, NameType>) => {
                const row = p.payload?.[0]?.payload as (typeof pts)[number] | undefined
                if (!p.active || !row) return null
                return (
                  <TipBox>
                    <p className="text-muted">{dm(fromTs(row.t))}</p>
                    {line === 'avg' && row.value != null && <p>{valueName}: <b className="tabular-nums">{num(row.value, digits)} {unit}</b></p>}
                    {row.avg != null && <p>{line === 'avg' ? avgName : valueName}: <b className="tabular-nums">{num(row.avg, digits)} {unit}</b></p>}
                    {row.label && <p className="text-muted">{row.label}</p>}
                  </TipBox>
                )
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}

export interface BarPoint { key: string; label: string; value: number; sub?: string; highlight?: boolean }

/** Barras de uma série só (volume por sessão, volume semanal). */
export function Bars({ data, color, unit, height = 150, ariaLabel, digits = 0, band, refLine }: {
  data: BarPoint[]; color: string; unit: string; height?: number; ariaLabel: string; digits?: number
  band?: [number, number] | null; refLine?: number | null
}) {
  return (
    <figure aria-label={ariaLabel} className="-mx-1">
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" minTickGap={12} />
            <YAxis {...AXIS} width={44} tickCount={4} tickFormatter={(v: number) => (v >= 10000 ? `${Math.round(v / 1000)}k` : num(v, 0))} />
            {band && <ReferenceArea y1={band[0]} y2={band[1]} fill="var(--color-ok)" fillOpacity={0.1} stroke="none" ifOverflow="extendDomain" />}
            {refLine != null && <ReferenceLine y={refLine} stroke="var(--color-muted)" strokeDasharray="4 4" ifOverflow="extendDomain" />}
            <Bar dataKey="value" radius={[4, 4, 0, 0]} animationDuration={500}
              shape={(p: { x?: number; y?: number; width?: number; height?: number; payload?: BarPoint }) => {
                const { x = 0, y = 0, width = 0, height: h = 0 } = p
                const r = Math.min(4, width / 2, h)
                return <path d={`M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + h} Z`}
                  fill={color} fillOpacity={p.payload?.highlight === false ? 0.45 : 1} />
              }} />
            <Tooltip
              cursor={{ fill: 'rgb(255 255 255 / 0.04)' }}
              content={(p: TooltipContentProps<ValueType, NameType>) => {
                const row = p.payload?.[0]?.payload as BarPoint | undefined
                if (!p.active || !row) return null
                return (
                  <TipBox>
                    <p className="text-muted">{row.label}</p>
                    <p><b className="tabular-nums">{num(row.value, digits)} {unit}</b></p>
                    {row.sub && <p className="text-muted">{row.sub}</p>}
                  </TipBox>
                )
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
