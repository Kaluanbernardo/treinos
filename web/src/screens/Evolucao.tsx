import { useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, Dumbbell, Ruler, Scale, Trophy } from 'lucide-react'
import {
  useBodyMetrics, useExerciseSessions, usePrs, useRecomposition, useWeightTrend,
} from '../lib/api'
import type { BodyMetric, MetricKey } from '../lib/types'
import { addDays, dm, kgFmt, num, signed, todaySP, intFmt } from '../lib/format'
import { Button, Card, CardHead, Collecting, ErrorState, Segmented, Skeleton } from '../components/ui'
import { Big, Delta, Meter } from '../components/viz'
import { READING_TONE, Triad } from '../components/Triad'
import { Bars, TrendChart } from '../components/charts'
import { EvolucaoV2Blocks } from './EvolucaoV2'

export type Period = '4s' | '3m' | 'tudo'
export const cutoffFor = (p: Period) => (p === '4s' ? addDays(todaySP(), -27) : p === '3m' ? addDays(todaySP(), -90) : '0000-01-01')

export function Evolucao() {
  const [period, setPeriod] = useState<Period>(() => (localStorage.getItem('evo_period') as Period) || '4s')
  const choose = (p: Period) => { setPeriod(p); localStorage.setItem('evo_period', p) }
  return (
    // desktop: blocos em duas colunas, alturas casadas por linha (ordem do celular intacta)
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:gap-5">
      <h1 className="pt-1 text-[28px] font-bold leading-tight tracking-[-0.02em] lg:col-span-2">Evolução</h1>
      <div className="sticky top-0 z-10 -mx-4 bg-bg/92 px-4 pt-[env(safe-area-inset-top)] pb-2 backdrop-blur-md lg:col-span-2 lg:-mx-8 lg:px-8 lg:py-2">
        <div className="lg:max-w-md"><Segmented label="Período" value={period} onChange={choose}
          options={[{ value: '4s', label: '4 sem' }, { value: '3m', label: '3 meses' }, { value: 'tudo', label: 'Tudo' }]} /></div>
      </div>
      <RecompBlock />
      <EvolucaoV2Blocks period={period} slot="resumo" />
      <CorpoBlock period={period} />
      <ForcaBlock period={period} />
      <EvolucaoV2Blocks period={period} slot="fim" />
    </div>
  )
}

export function Block({ id, title, sub, aside, children }: { id: string; title: string; sub?: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <Card as="section" aria-labelledby={id}>
      <CardHead id={id} title={title} sub={sub} aside={aside} />
      <div className="mt-4">{children}</div>
    </Card>
  )
}

// ---------------------------------------------------------------- 1. recomposição
function RecompBlock() {
  const r = useRecomposition()
  const trend = useWeightTrend()
  const body = useBodyMetrics()
  const ex = useExerciseSessions()
  if (r.isPending) return <Skeleton className="h-52" />
  if (r.isError) return <ErrorState what="a recomposição" onRetry={() => r.refetch()} />
  const d = r.data
  const ready = {
    firstWeight: trend.data?.[0]?.date,
    firstWaist: body.data?.find((b) => b.cintura_cm != null)?.date,
    firstStrength: ex.data?.find((e) => e.main_lift)?.date,
  }
  const collecting = !d || d.reading === 'coletando_dados'
  return (
    <Block id="b-recomp" title="Recomposição" sub="4 semanas vs 4 anteriores">
      <Triad data={d} ready={ready} size="lg" />
      {collecting ? (
        <p className="mt-3 text-[15px] text-muted">No rumo = peso ↓ ou estável, cintura ↓, força ↑.</p>
      ) : (
        <p className={`mt-3 text-lg font-semibold leading-snug ${READING_TONE[d!.reading]}`}>{d!.reading_text}</p>
      )}
      {d && (d.weight_now_kg != null || d.waist_now_cm != null) && !collecting && (
        <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 border-t border-line pt-4">
          {d.weight_prev_kg != null && <Pair label="Peso (média 7d)" value={`${num(d.weight_prev_kg)} → ${num(d.weight_now_kg)} kg`} />}
          {d.waist_prev_cm != null && <Pair label="Cintura" value={`${num(d.waist_prev_cm)} → ${num(d.waist_now_cm)} cm`} />}
          {d.weight_pace_pct_week != null && <Pair label="Ritmo (4 sem)" value={`${signed(d.weight_pace_pct_week, 2)}%/sem`} />}
          {d.strength_n_exercises ? <Pair label="Força (mediana)" value={`${d.strength_n_exercises} exercícios`} /> : null}
        </dl>
      )}
    </Block>
  )
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

// ---------------------------------------------------------------- 3. corpo
const MEASURES: { key: MetricKey; label: string; unit: string }[] = [
  { key: 'cintura_cm', label: 'Cintura', unit: 'cm' },
  { key: 'abdomen_cm', label: 'Abdômen', unit: 'cm' },
  { key: 'quadril_cm', label: 'Quadril', unit: 'cm' },
  { key: 'peito_cm', label: 'Peito', unit: 'cm' },
  { key: 'braco_cm', label: 'Braço', unit: 'cm' },
  { key: 'coxa_cm', label: 'Coxa', unit: 'cm' },
  { key: 'gordura_pct', label: '% gordura', unit: '%' },
]

function CorpoBlock({ period }: { period: Period }) {
  const trend = useWeightTrend()
  const body = useBodyMetrics()
  const [measure, setMeasure] = useState<MetricKey>('cintura_cm')
  const cut = cutoffFor(period)

  if (trend.isPending || body.isPending) return <Skeleton className="h-96" />
  if (trend.isError || body.isError) return <ErrorState what="as medidas" onRetry={() => { trend.refetch(); body.refetch() }} />

  const all = trend.data!
  const pts = all.filter((p) => p.date >= cut)
  const last = all[all.length - 1]
  const m = MEASURES.find((x) => x.key === measure)!

  return (
    <Block id="b-corpo" title="Corpo">
      {all.length < 3 ? (
        <Collecting title="Coletando pesagens" icon={<Scale size={20} />} progress={{ have: all.length, need: 3, unit: 'pesagens' }}>
          {last ? <>Última: <span className="font-semibold text-fg">{num(last.peso_kg)} kg</span> em {dm(last.date)}. </> : null}
          Pese ao acordar e mande no chat.
        </Collecting>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
            <div>
              <p className="text-[13px] text-muted">Peso · média 7 dias</p>
              <Big size="lg" value={num(last.avg_7d)} unit="kg" />
            </div>
            {last.delta_28d != null && <p className="flex items-center gap-1.5 pb-1 text-sm text-muted"><Delta value={last.delta_28d} unit="kg" good="down" /> 4 sem</p>}
          </div>
          <PaceLine pace4={last.pace_pct_week_28d} pace1={last.pace_pct_week} cap={last.max_loss_pct_week} />
          <div className="mt-3">
            {pts.length >= 2 ? (
              <TrendChart ariaLabel="Peso diário e média de 7 dias" color="var(--color-lime)" unit="kg"
                data={pts.map((p) => ({ date: p.date, value: p.peso_kg, avg: p.avg_7d }))} valueName="Pesagem" />
            ) : <p className="text-sm text-muted">Sem pesagens neste período.</p>}
          </div>
          <Legend items={[{ swatch: 'dot', label: 'pesagem' }, { swatch: 'line', label: 'média 7 dias', color: 'var(--color-lime)' }]} />
        </>
      )}

      <div className="mt-6 border-t border-line pt-5">
        <h3 className="flex items-center gap-2 font-semibold"><Ruler size={18} className="text-muted" aria-hidden="true" /> Medidas</h3>
        <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5" role="tablist" aria-label="Medida">
          {MEASURES.map((x) => {
            const n = body.data!.filter((b) => b[x.key] != null).length
            const on = x.key === measure
            return (
              <button key={x.key} type="button" role="tab" aria-selected={on} onClick={() => setMeasure(x.key)}
                className={`h-10 shrink-0 rounded-full px-4 text-sm font-medium transition-colors duration-150 ${on ? 'bg-fg text-bg' : 'bg-card-2 text-muted hover:text-fg'}`}>
                {x.label}{n > 0 && <span className={on ? 'text-bg/60' : 'text-muted/70'}> · {n}</span>}
              </button>
            )
          })}
        </div>
        <MeasureView rows={body.data!} m={m} cut={cut} />
      </div>
    </Block>
  )
}

function PaceLine({ pace4, pace1, cap }: { pace4: number | null; pace1: number | null; cap: number | null }) {
  const pace = pace4 ?? pace1
  if (pace == null) return <p className="mt-2 text-sm text-muted">Ritmo semanal: com 2 semanas de pesagens.</p>
  const lim = cap ?? 0.5
  const loss = Math.max(0, -pace)
  const above = loss > lim
  return (
    <div className="mt-3">
      <div className={`flex items-baseline justify-between gap-2 text-sm ${above ? 'text-warn' : 'text-muted'}`}>
        <span className="flex items-center gap-1.5">{above && <AlertTriangle size={15} aria-hidden="true" />}Ritmo {pace4 != null ? '4 sem' : '1 sem'}</span>
        <span className="tabular-nums"><b className="text-base font-bold text-fg">{signed(pace, 2)}%</b>/sem · teto {num(lim, 1)}%{above && ' (acima)'}</span>
      </div>
      <Meter className="mt-2" value={loss} max={lim * 1.5} target={lim} color={above ? 'var(--color-warn)' : 'var(--color-ok)'}
        label={`Ritmo de perda ${num(loss, 2)}% por semana; teto ${num(lim, 1)}%`} />
    </div>
  )
}

function MeasureView({ rows, m, cut }: { rows: BodyMetric[]; m: (typeof MEASURES)[number]; cut: string }) {
  const series = rows.filter((b) => b[m.key] != null).map((b) => ({ date: b.date, value: Number(b[m.key]) }))
  if (series.length < 2) {
    const hint = m.key === 'cintura_cm'
      ? 'Semanal, na altura do umbigo ("cintura 98" no chat).'
      : m.key === 'gordura_pct'
        ? 'Só bioimpedância, sempre no mesmo aparelho.'
        : 'A cada 4 semanas, junto com as fotos.'
    return (
      <div className="mt-3">
        <Collecting title={series.length ? `1 medida de ${m.label.toLowerCase()}` : `Sem medida de ${m.label.toLowerCase()} ainda`}
          progress={{ have: series.length, need: 2, unit: 'medidas' }}>
          {series.length ? <>Primeira: <span className="font-semibold text-fg">{num(series[0].value)} {m.unit}</span> em {dm(series[0].date)}. </> : null}
          {hint}
        </Collecting>
      </div>
    )
  }
  const last = series[series.length - 1]
  const first = series[0]
  const ref4 = [...series].reverse().find((s) => s.date <= addDays(last.date, -21))
  const inPeriod = series.filter((s) => s.date >= cut)
  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-end gap-x-5 gap-y-1">
        <Big size="md" value={num(last.value)} unit={m.unit} />
        <span className="flex items-center gap-1 pb-0.5 text-sm text-muted"><Delta value={last.value - first.value} unit={m.unit} good={m.key === 'braco_cm' || m.key === 'peito_cm' ? 'up' : 'down'} /> início</span>
        {ref4 && <span className="flex items-center gap-1 pb-0.5 text-sm text-muted"><Delta value={last.value - ref4.value} unit={m.unit} good={m.key === 'braco_cm' || m.key === 'peito_cm' ? 'up' : 'down'} /> 4 sem</span>}
      </div>
      <div className="mt-2">
        {inPeriod.length >= 2
          ? <TrendChart ariaLabel={`${m.label} ao longo do tempo`} color={m.key === 'gordura_pct' ? 'var(--color-fat)' : 'var(--color-fg)'} unit={m.unit} line="value" dots={false} data={inPeriod} valueName={m.label} height={170} />
          : <p className="text-sm text-muted">Menos de 2 medidas neste período.</p>}
      </div>
    </div>
  )
}

export function Legend({ items }: { items: { swatch: 'dot' | 'line' | 'bar' | 'band'; label: string; color?: string }[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          {i.swatch === 'dot' && <span className="h-2 w-2 rounded-full bg-muted" aria-hidden="true" />}
          {i.swatch === 'line' && <span className="h-0.5 w-4 rounded" style={{ background: i.color }} aria-hidden="true" />}
          {i.swatch === 'bar' && <span className="h-3 w-2 rounded-sm" style={{ background: i.color }} aria-hidden="true" />}
          {i.swatch === 'band' && <span className="h-3 w-4 rounded-sm bg-ok/25" aria-hidden="true" />}
          {i.label}
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------- 4. força
function ForcaBlock({ period }: { period: Period }) {
  const ex = useExerciseSessions()
  const prs = usePrs()
  const [sel, setSel] = useState<string | null>(null)
  const cut = cutoffFor(period)

  const exercises = useMemo(() => {
    const map = new Map<string, { id: string; name: string; main: boolean; n: number; last: string; loaded: boolean }>()
    for (const r of ex.data ?? []) {
      const cur = map.get(r.exercise_id) ?? { id: r.exercise_id, name: r.exercise_name, main: r.main_lift, n: 0, last: r.date, loaded: false }
      cur.n += 1; if (r.top_e1rm != null) cur.loaded = true; if (r.date > cur.last) cur.last = r.date
      map.set(r.exercise_id, cur)
    }
    return [...map.values()].sort((a, b) => Number(b.loaded) - Number(a.loaded) || Number(b.main) - Number(a.main) || b.n - a.n || a.name.localeCompare(b.name))
  }, [ex.data])

  if (ex.isPending) return <Skeleton className="h-96" />
  if (ex.isError) return <ErrorState what="a força" onRetry={() => ex.refetch()} />

  if (exercises.length === 0) {
    return (
      <Block id="b-forca" title="Força" sub="1RM estimado (Epley)">
        <Collecting title="Nenhuma série com carga ainda" icon={<Dumbbell size={20} />}>
          A curva de cada exercício aparece a partir da 2ª sessão.
        </Collecting>
      </Block>
    )
  }

  const cur = exercises.find((e) => e.id === sel) ?? exercises[0]
  const rows = (ex.data ?? []).filter((r) => r.exercise_id === cur.id)
  const inPeriod = rows.filter((r) => r.date >= cut)
  const last = rows[rows.length - 1]
  const firstE = rows.find((r) => r.top_e1rm != null)?.top_e1rm

  return (
    <Block id="b-forca" title="Força" sub="1RM estimado (Epley)">
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5" role="tablist" aria-label="Exercício">
        {exercises.map((e) => {
          const on = e.id === cur.id
          return (
            <button key={e.id} type="button" role="tab" aria-selected={on} onClick={() => setSel(e.id)}
              className={`h-10 shrink-0 rounded-full px-4 text-sm font-medium transition-colors duration-150 ${on ? 'bg-fg text-bg' : 'bg-card-2 text-muted hover:text-fg'}`}>
              {e.name}
            </button>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <Big size="lg" value={last.top_e1rm ? kgFmt(Math.round(last.top_e1rm * 10) / 10) : '—'} unit="kg" />
        {firstE && last.top_e1rm && rows.length > 1 && (
          <span className="flex items-center gap-1 pb-1 text-sm text-muted"><Delta value={((last.top_e1rm - firstE) / firstE) * 100} unit="%" good="up" /> início</span>
        )}
      </div>
      <p className="mt-1.5 text-sm tabular-nums text-muted">
        {dm(last.date)} · melhor <b className="text-fg">{last.top_kg ? `${kgFmt(last.top_kg)}×${last.top_reps}` : '—'}</b> · {intFmt(last.volume_kg)} kg vol.
      </p>

      {!cur.loaded ? (
        <p className="mt-4 text-[15px] text-muted">Peso do corpo: sem 1RM. Veja as repetições no histórico.</p>
      ) : rows.length < 2 ? (
        <div className="mt-4">
          <Collecting title="1 sessão registrada" progress={{ have: 1, need: 2, unit: 'sessões' }}>
            A curva aparece na próxima sessão.
          </Collecting>
        </div>
      ) : inPeriod.length < 2 ? (
        <p className="mt-4 text-sm text-muted">Menos de 2 sessões neste período.</p>
      ) : (
        <>
          <h3 className="mt-5 text-sm font-medium text-muted">1RM estimado por sessão</h3>
          <TrendChart ariaLabel={`1RM estimado de ${cur.name}`} color="var(--color-lime)" unit="kg" line="value" dots={false} height={180}
            data={inPeriod.filter((r) => r.top_e1rm != null).map((r) => ({ date: r.date, value: r.top_e1rm, label: r.top_kg ? `melhor série ${kgFmt(r.top_kg)} kg × ${r.top_reps}` : undefined }))}
            valueName="1RM est." />
          <h3 className="mt-4 text-sm font-medium text-muted">Volume por sessão (kg)</h3>
          <Bars ariaLabel={`Volume por sessão de ${cur.name}`} color="var(--color-muted)" unit="kg" height={130}
            data={inPeriod.map((r) => ({ key: r.session_id, label: dm(r.date), value: Number(r.volume_kg), sub: `${r.n_sets} séries${r.is_volume_pr ? ' · recorde de volume' : ''}` }))} />
        </>
      )}

      <div className="mt-6 border-t border-line pt-5">
        <h3 className="flex items-center gap-2 font-semibold"><Trophy size={18} className="text-lime" aria-hidden="true" /> Recordes</h3>
        <PrList prs={prs.data ?? []} />
      </div>
    </Block>
  )
}

function PrList({ prs }: { prs: { set_id: string; date: string; exercise_name: string; kg: number; reps: number; is_load_pr: boolean; is_e1rm_pr: boolean; session_id: string; exercise_id: string }[] }) {
  const [all, setAll] = useState(false)
  // 1 linha por exercício × sessão (a melhor série que bateu recorde)
  const seen = new Set<string>()
  const list = prs.filter((p) => { const k = `${p.session_id}:${p.exercise_id}`; if (seen.has(k)) return false; seen.add(k); return true }).slice(0, 12)
  if (list.length === 0) {
    return <p className="mt-2 text-[15px] text-muted">Ainda sem recordes: a 1ª sessão vira a referência.</p>
  }
  return (
    <>
      <ul className="mt-2 divide-y divide-line">
        {(all ? list : list.slice(0, 5)).map((p) => (
          <li key={p.set_id} className="flex items-center gap-3 py-3">
            <span className="w-11 shrink-0 text-sm tabular-nums text-muted">{dm(p.date)}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{p.exercise_name}</span>
              <span className="block text-[13px] text-muted">{p.is_load_pr ? 'carga' : '1RM est.'}</span>
            </span>
            <span className="shrink-0 text-lg font-bold tabular-nums">{kgFmt(p.kg)}×{p.reps}</span>
          </li>
        ))}
      </ul>
      {list.length > 5 && !all && <Button variant="ghost" className="w-full" onClick={() => setAll(true)}>Ver todos ({list.length})</Button>}
    </>
  )
}
