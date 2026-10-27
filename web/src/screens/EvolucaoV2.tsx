import { useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { Camera, ChevronLeft, ChevronRight, Flame, Images, Utensils } from 'lucide-react'
import {
  useMonthlySummary, useMuscleVolume, usePhotos, useSignedUrls, useStreaks, useWeeklySummary,
} from '../lib/api'
import type { Modality, PeriodSummary, ProgressPhoto } from '../lib/types'
import { capitalize, dm, intFmt, monthLabel, monthShort, todaySP, weekStart } from '../lib/format'
import { Button, Collecting, ErrorState, Segmented, Skeleton } from '../components/ui'
import { Bars } from '../components/charts'
import { MODALITIES, MODALITY } from '../components/modality'
import { SummaryStats } from '../components/SummaryCard'
import { Block, Legend, cutoffFor, type Period } from './Evolucao'

export function EvolucaoV2Blocks({ period, slot }: { period: Period; slot: 'resumo' | 'fim' }) {
  if (slot === 'resumo') return <ResumoBlock />
  return (
    <>
      <VolumeGrupoBlock period={period} />
      <AderenciaBlock period={period} />
      <NutricaoTrendBlock period={period} />
      <FotosBlock />
    </>
  )
}

// ---------------------------------------------------------------- 2. resumo semana / mês
function ResumoBlock() {
  const [unit, setUnit] = useState<'semana' | 'mes'>('semana')
  const weekly = useWeeklySummary()
  const monthly = useMonthlySummary()
  const q = unit === 'mes' ? monthly : weekly
  const list = (q.data ?? []) as PeriodSummary[]
  const [offset, setOffset] = useState(0)
  const idx = Math.max(0, list.length - 1 - offset)
  const row = list[idx]
  const label = !row ? '' : unit === 'mes' ? capitalize(monthLabel(row.period_start))
    : row.period_start === weekStart(todaySP()) ? `Esta semana · ${dm(row.period_start)} a ${dm(row.period_end)}` : `${dm(row.period_start)} a ${dm(row.period_end)}`

  return (
    <Block id="b-resumo" title="Resumo" aside={
      <div className="w-40"><Segmented size="sm" label="Período do resumo" value={unit} onChange={(v) => { setUnit(v); setOffset(0) }}
        options={[{ value: 'semana', label: 'Semana' }, { value: 'mes', label: 'Mês' }]} /></div>
    }>
      {q.isError ? <ErrorState what="o resumo" onRetry={() => q.refetch()} /> : q.isPending ? <Skeleton className="h-56" /> : !row ? (
        <Collecting title="Sem dados ainda">O resumo começa com o primeiro registro.</Collecting>
      ) : (
        <>
          <div className="-mt-1 mb-4 flex items-center justify-between gap-2">
            <button type="button" className="flex h-11 w-11 items-center justify-center rounded-xl bg-card-2 disabled:opacity-30" aria-label="Período anterior"
              disabled={idx === 0} onClick={() => setOffset(offset + 1)}><ChevronLeft size={20} aria-hidden="true" /></button>
            <p className="text-center text-[15px] font-medium">{label}</p>
            <button type="button" className="flex h-11 w-11 items-center justify-center rounded-xl bg-card-2 disabled:opacity-30" aria-label="Próximo período"
              disabled={offset === 0} onClick={() => setOffset(offset - 1)}><ChevronRight size={20} aria-hidden="true" /></button>
          </div>
          <SummaryStats row={row} prev={list[idx - 1]} />
        </>
      )}
    </Block>
  )
}

// ---------------------------------------------------------------- 4b. volume semanal por grupo
function VolumeGrupoBlock({ period }: { period: Period }) {
  const q = useMuscleVolume()
  const cut = cutoffFor(period)
  const rows = useMemo(() => {
    const cw = weekStart(todaySP())
    const data = (q.data ?? []).filter((r) => r.week_start >= weekStart(cut))
    const groups = [...new Set(data.map((r) => r.muscle_group))]
    const weeks = [...new Set(data.filter((r) => r.week_start < cw).map((r) => r.week_start))]
    return groups.map((g) => {
      const cur = data.find((r) => r.week_start === cw && r.muscle_group === g)
      const past = data.filter((r) => r.week_start < cw && r.muscle_group === g)
      const avgSets = weeks.length ? past.reduce((s, r) => s + r.n_sets, 0) / weeks.length : null
      return { g, sets: cur?.n_sets ?? 0, volume: Number(cur?.volume_kg ?? 0), avgSets }
    }).sort((a, b) => b.sets - a.sets || (b.avgSets ?? 0) - (a.avgSets ?? 0))
  }, [q.data, cut])

  if (q.isPending) return <Skeleton className="h-48" />
  if (q.isError) return <ErrorState what="o volume por grupo" onRetry={() => q.refetch()} />
  const max = Math.max(1, ...rows.map((r) => Math.max(r.sets, r.avgSets ?? 0)))

  return (
    <Block id="b-grupos" title="Volume por grupo muscular" sub="Séries válidas nesta semana; o traço é a média das semanas anteriores do período">
      {rows.length === 0 ? (
        <Collecting title="Sem séries registradas">Cada série confirmada no treino soma no grupo muscular do exercício.</Collecting>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.g}>
              <div className="flex items-baseline justify-between text-[15px]">
                <span className="font-medium">{capitalize(r.g)}</span>
                <span className="tabular-nums text-muted"><b className="text-fg">{r.sets}</b> séries{r.avgSets != null && ` · média ${r.avgSets.toFixed(1).replace('.', ',')}`}</span>
              </div>
              <div className="relative mt-1.5 h-2.5 rounded-full bg-line" aria-hidden="true">
                <div className="h-2.5 rounded-full bg-protein transition-[width] duration-500" style={{ width: `${(r.sets / max) * 100}%` }} />
                {r.avgSets != null && <div className="absolute -top-1 h-4.5 w-0.5 rounded bg-fg" style={{ left: `${(r.avgSets / max) * 100}%` }} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Block>
  )
}

// ---------------------------------------------------------------- 5. aderência
function AderenciaBlock({ period }: { period: Period }) {
  const streaks = useStreaks()
  const weekly = useWeeklySummary()
  const cut = cutoffFor(period)
  if (streaks.isPending || weekly.isPending) return <Skeleton className="h-72" />
  if (streaks.isError || weekly.isError) return <ErrorState what="a aderência" onRetry={() => { streaks.refetch(); weekly.refetch() }} />
  const weeks = (weekly.data ?? []).filter((w) => w.period_end >= cut).slice(-12)
  const total = streaks.data!.find((s) => s.modality === 'total')
  const completed = weeks.filter((w) => w.period_end < todaySP())

  return (
    <Block id="b-aderencia" title="Aderência" sub="Semanas cumprindo o planejado; remarcar não quebra a sequência">
      <div className="flex items-center gap-4 rounded-2xl bg-card-2 p-4">
        <Flame size={34} className={total?.current_streak_weeks ? 'text-kcal' : 'text-muted'} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-[28px] font-bold leading-none tabular-nums">{total?.current_streak_weeks ?? 0}<span className="ml-1.5 text-base font-medium text-muted">{total?.current_streak_weeks === 1 ? 'semana seguida' : 'semanas seguidas'}</span></p>
          <p className="mt-1 text-sm text-muted">
            melhor: {total?.best_streak_weeks ?? 0} · esta semana {total?.this_week_done ?? 0}/{total?.this_week_planned ?? 0}
            {total?.sessions_since_miss ? ` · ${total.sessions_since_miss} sessões sem faltar` : ''}
          </p>
        </div>
      </div>
      {completed.length === 0 && (
        <p className="mt-3 text-sm leading-relaxed text-muted">A primeira semana fecha no domingo; a sequência começa a contar a partir dela.</p>
      )}

      <ul className="mt-4 flex flex-col divide-y divide-line">
        {MODALITIES.map((m) => <ModalityRow key={m} m={m} weeks={weeks} s={streaks.data!.find((x) => x.modality === m)} />)}
      </ul>
      <Legend items={[{ swatch: 'bar', label: 'feito (cor da modalidade)', color: 'var(--color-muted)' }, { swatch: 'band', label: 'planejado' }]} />
    </Block>
  )
}

function ModalityRow({ m, weeks, s }: { m: Modality; weeks: PeriodSummary[]; s?: { current_streak_weeks: number; best_streak_weeks: number; this_week_done: number; this_week_planned: number } }) {
  const info = MODALITY[m]
  const any = weeks.some((w) => w.by_modality?.[m]?.planned || w.by_modality?.[m]?.done)
  if (!any && !s?.this_week_planned) return null
  return (
    <li className="py-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-2 font-medium"><span className={`h-2.5 w-2.5 rounded-full ${info.bg}`} aria-hidden="true" />{info.label}</span>
        <span className="text-sm tabular-nums text-muted">
          semana <b className="text-fg">{s?.this_week_done ?? 0}/{s?.this_week_planned ?? 0}</b>
          {s && s.current_streak_weeks > 0 && <> · <Flame size={13} className="inline text-kcal" aria-hidden="true" /> {s.current_streak_weeks}</>}
          {s && s.best_streak_weeks > 0 && <> · melhor {s.best_streak_weeks}</>}
        </span>
      </div>
      <div className="mt-2 flex h-9 items-end gap-1" role="img"
        aria-label={`${info.label}: ${weeks.map((w) => `${dm(w.period_start)} ${w.by_modality?.[m]?.done ?? 0} de ${w.by_modality?.[m]?.planned ?? 0}`).join('; ')}`}>
        {weeks.map((w) => {
          const p = w.by_modality?.[m]?.planned ?? 0
          const d = w.by_modality?.[m]?.done ?? 0
          const h = Math.max(p, d, 1)
          return (
            <div key={w.period_start} className="flex h-full flex-1 flex-col justify-end" title={`${dm(w.period_start)}: ${d}/${p}`}>
              <div className="relative w-full rounded-[4px] bg-ok/20" style={{ height: `${(p / Math.max(h, 2)) * 100}%`, minHeight: p ? 6 : 0 }}>
                <div className="absolute inset-x-0 bottom-0 rounded-[4px]" style={{ height: `${p ? Math.min(1, d / p) * 100 : d ? 100 : 0}%`, background: info.color }} />
              </div>
            </div>
          )
        })}
      </div>
    </li>
  )
}

// ---------------------------------------------------------------- 6. nutrição por semana
function NutricaoTrendBlock({ period }: { period: Period }) {
  const weekly = useWeeklySummary()
  const cut = cutoffFor(period)
  if (weekly.isPending) return <Skeleton className="h-64" />
  if (weekly.isError) return <ErrorState what="a nutrição" onRetry={() => weekly.refetch()} />
  const weeks = (weekly.data ?? []).filter((w) => w.period_end >= cut).slice(-12)
  const logged = weeks.filter((w) => w.days_logged > 0)
  const last = weeks[weeks.length - 1]

  return (
    <Block id="b-nutri" title="Nutrição por semana" sub="Médias só nos dias registrados, contra a meta (faixa verde)">
      {logged.length === 0 ? (
        <Collecting title="Nenhum dia com refeições registradas" icon={<Utensils size={20} />}>
          Conforme as refeições chegarem pelo chat, cada semana mostra a média de kcal e proteína e quantos dias foram registrados.
          Semana com poucos dias (ex.: 3/7) não deve ser levada a sério.
        </Collecting>
      ) : (
        <>
          <h3 className="text-sm font-medium text-muted">Proteína (g/dia)</h3>
          <Bars ariaLabel="Média semanal de proteína" color="var(--color-protein)" unit="g" height={140}
            band={last?.protein_target_min_g && last.protein_target_max_g ? [Number(last.protein_target_min_g), Number(last.protein_target_max_g)] : null}
            data={weeks.map((w) => ({ key: w.period_start, label: dm(w.period_start), value: Number(w.protein_avg_g ?? 0), sub: `${w.days_logged}/7 dias registrados`, highlight: w.days_logged >= 5 }))} />
          <h3 className="mt-4 text-sm font-medium text-muted">Calorias (kcal/dia)</h3>
          <Bars ariaLabel="Média semanal de calorias" color="var(--color-kcal)" unit="kcal" height={140} refLine={last?.kcal_target ?? null}
            data={weeks.map((w) => ({ key: w.period_start, label: dm(w.period_start), value: Number(w.kcal_avg ?? 0), sub: `${w.days_logged}/7 dias registrados`, highlight: w.days_logged >= 5 }))} />
          <ul className="mt-3 flex flex-col gap-1 text-sm text-muted">
            {weeks.slice(-4).reverse().map((w) => (
              <li key={w.period_start} className="flex justify-between gap-2 tabular-nums">
                <span>Semana de {dm(w.period_start)}</span>
                <span><b className={w.days_logged >= 5 ? 'text-fg' : 'text-warn'}>{w.days_logged}/7 dias</b>{w.days_logged ? ` · ${intFmt(w.kcal_avg)} kcal · ${intFmt(w.protein_avg_g)} g` : ''}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[13px] text-muted">Barras mais claras: semanas com menos de 5 dias registrados.</p>
        </>
      )}
    </Block>
  )
}

// ---------------------------------------------------------------- 7. fotos
const POSES: ProgressPhoto['pose'][] = ['frente', 'lado', 'costas']

function FotosBlock() {
  const photos = usePhotos()
  const list = photos.data ?? []
  const months = [...new Set(list.map((p) => p.date.slice(0, 7)))].sort().reverse()
  const pick = (month: string, pose: ProgressPhoto['pose']) => [...list].reverse().find((p) => p.date.startsWith(month) && p.pose === pose)
  const thumbs = useSignedUrls(list.map((p) => p.thumb_path ?? p.path))
  const [pose, setPose] = useState<ProgressPhoto['pose']>('frente')
  const [a, setA] = useState<string | null>(null)
  const [b, setB] = useState<string | null>(null)

  if (photos.isPending) return <Skeleton className="h-48" />
  if (photos.isError) return <ErrorState what="as fotos" onRetry={() => photos.refetch()} />

  if (list.length === 0) {
    return (
      <Block id="b-fotos" title="Fotos de progresso" sub="Mensais: frente, lado e costas">
        <Collecting title="Nenhuma foto ainda" icon={<Camera size={20} />}>
          No dia 1 de cada mês, mande no chat as 3 fotos (frente, lado, costas): mesmo lugar, luz e distância, de manhã em
          jejum, mesma roupa, postura relaxada. O assistente tira os metadados (GPS, aparelho) e guarda num cofre privado;
          aqui elas aparecem em grade por mês e dá para comparar dois meses lado a lado.
        </Collecting>
      </Block>
    )
  }

  const before = a ?? months[months.length - 1]
  const after = b ?? months[0]
  return (
    <Block id="b-fotos" title="Fotos de progresso" sub={`${list.length} ${list.length === 1 ? 'foto' : 'fotos'} em ${months.length} ${months.length === 1 ? 'mês' : 'meses'}`}>
      <div className="flex flex-col gap-4">
        {months.map((m) => (
          <div key={m}>
            <h3 className="text-sm font-medium text-muted">{capitalize(monthLabel(`${m}-01`))}</h3>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {POSES.map((po) => {
                const p = pick(m, po)
                const url = p && thumbs.data?.[p.thumb_path ?? p.path]
                return (
                  <figure key={po} className="overflow-hidden rounded-xl bg-card-2">
                    {url ? <img src={url} alt={`${po}, ${monthLabel(`${m}-01`)}`} className="aspect-[3/4] w-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
                      : <div className="flex aspect-[3/4] items-center justify-center text-muted"><Images size={22} aria-hidden="true" /></div>}
                    <figcaption className="px-2 py-1.5 text-center text-xs text-muted">{po}</figcaption>
                  </figure>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {months.length >= 2 ? (
        <div className="mt-6 border-t border-line pt-5">
          <h3 className="font-semibold">Comparar</h3>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <MonthSelect label="Antes" value={before} months={months} onChange={setA} />
            <MonthSelect label="Depois" value={after} months={months} onChange={setB} />
          </div>
          <div className="mt-3"><Segmented size="sm" label="Pose" value={pose} onChange={setPose} options={POSES.map((p) => ({ value: p, label: capitalize(p) }))} /></div>
          <Compare before={pick(before, pose)} after={pick(after, pose)} labels={[monthShort(`${before}-01`), monthShort(`${after}-01`)]} />
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">A comparação lado a lado aparece a partir do 2º mês de fotos.</p>
      )}
    </Block>
  )
}

function MonthSelect({ label, value, months, onChange }: { label: string; value: string; months: string[]; onChange: (m: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-muted">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-12 rounded-xl border border-line bg-card-2 px-3 text-base text-fg">
        {months.map((m) => <option key={m} value={m}>{capitalize(monthLabel(`${m}-01`))}</option>)}
      </select>
    </label>
  )
}

/** Comparação com divisor arrastável + botões (o gesto nunca é a única forma). Fotos em tamanho cheio via signed URL. */
function Compare({ before, after, labels }: { before?: ProgressPhoto; after?: ProgressPhoto; labels: [string, string] }) {
  const urls = useSignedUrls([before?.path, after?.path].filter(Boolean) as string[])
  const [pos, setPos] = useState(50)
  const box = useRef<HTMLDivElement>(null)
  const drag = (e: RPointerEvent) => {
    const r = box.current?.getBoundingClientRect()
    if (!r) return
    setPos(Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)))
  }
  if (!before || !after) return <p className="mt-3 text-sm text-muted">Falta a foto dessa pose em um dos meses.</p>
  const ua = urls.data?.[before.path]
  const ub = urls.data?.[after.path]
  return (
    <div className="mt-3">
      <div ref={box} className="relative aspect-[3/4] touch-none select-none overflow-hidden rounded-2xl bg-card-2"
        onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); drag(e) }}
        onPointerMove={(e) => { if (e.buttons) drag(e) }}>
        {ub && <img src={ub} alt={`Depois (${labels[1]})`} className="absolute inset-0 h-full w-full object-cover" referrerPolicy="no-referrer" draggable={false} />}
        {ua && <img src={ua} alt={`Antes (${labels[0]})`} className="absolute inset-0 h-full w-full object-cover" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} referrerPolicy="no-referrer" draggable={false} />}
        <div className="absolute inset-y-0 w-0.5 bg-lime" style={{ left: `${pos}%` }} aria-hidden="true">
          <div className="absolute top-1/2 left-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-lime text-bg"><ChevronLeft size={16} /><ChevronRight size={16} /></div>
        </div>
        <span className="absolute top-2 left-2 rounded-md bg-bg/80 px-2 py-1 text-xs font-semibold">{labels[0]}</span>
        <span className="absolute top-2 right-2 rounded-md bg-bg/80 px-2 py-1 text-xs font-semibold">{labels[1]}</span>
      </div>
      <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} aria-label="Divisor entre antes e depois" className="mt-3 w-full accent-[var(--color-lime)]" />
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Button onClick={() => setPos(100)}>Antes</Button>
        <Button onClick={() => setPos(50)}>Meio</Button>
        <Button onClick={() => setPos(0)}>Depois</Button>
      </div>
    </div>
  )
}

