import { useState } from 'react'
import { Camera, Check, ChevronLeft, ChevronRight, Droplets, MessageCircle, Pill } from 'lucide-react'
import { useDailyNutrition, useFoodLogs, useNutritionTargets, useToggleCreatine } from '../lib/api'
import type { DailyNutrition, FoodLog, NutritionTargets } from '../lib/types'
import { addDays, capitalize, intFmt, kgFmt, longDay, num, todaySP } from '../lib/format'
import { Badge, Card, CardHead, ErrorState, IconButton, Skeleton, haptic, toast } from '../components/ui'
import { Meter } from '../components/viz'
import { Ring } from '../components/Ring'

const EMPTY: DailyNutrition = { date: '', kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0, n_items: 0, has_estimated: false, food_logged: false, creatine: false, creatine_g: null, water_ml: null }

export function Nutricao() {
  const [date, setDate] = useState(todaySP())
  const today = todaySP()
  const daily = useDailyNutrition()
  const targets = useNutritionTargets()
  const logs = useFoodLogs(date)
  const day = daily.data?.find((d) => d.date === date) ?? { ...EMPTY, date }
  const t = targets.data

  return (
    <div className="flex flex-col gap-4">
      <h1 className="pt-1 text-[28px] font-bold leading-tight tracking-[-0.02em]">Nutrição</h1>

      <div className="flex items-center justify-between rounded-2xl bg-card p-1" role="group" aria-label="Dia">
        <IconButton label="Dia anterior" onClick={() => setDate(addDays(date, -1))}><ChevronLeft size={24} /></IconButton>
        <p className="text-center">
          <span className="block font-semibold">{date === today ? 'Hoje' : date === addDays(today, -1) ? 'Ontem' : capitalize(longDay(date).split(',')[0])}</span>
          <span className="block text-sm text-muted">{capitalize(longDay(date).split(', ')[1] ?? '')}</span>
        </p>
        <IconButton label="Próximo dia" onClick={() => setDate(addDays(date, 1))} disabled={date >= today} className="disabled:opacity-30">
          <ChevronRight size={24} />
        </IconButton>
      </div>

      {daily.isError || targets.isError ? (
        <ErrorState what="a nutrição" onRetry={() => { daily.refetch(); targets.refetch() }} />
      ) : daily.isPending || targets.isPending ? (
        <Skeleton className="h-80" />
      ) : (
        <Macros day={day} t={t ?? null} />
      )}

      <Checks day={day} date={date} t={t ?? null} />

      <Card aria-labelledby="ref-title">
        <CardHead id="ref-title" title="Refeições" aside={day.has_estimated ? <Badge tone="warn"><Camera size={13} aria-hidden="true" /> estimativa</Badge> : undefined} />
        {logs.isError ? <div className="mt-3"><ErrorState what="as refeições" onRetry={() => logs.refetch()} /></div>
          : logs.isPending ? <Skeleton className="mt-3 h-32" />
            : logs.data!.length === 0 ? <EmptyDay isToday={date === today} />
              : <Meals logs={logs.data!} />}
      </Card>
    </div>
  )
}

function Macros({ day, t }: { day: DailyNutrition; t: NutritionTargets | null }) {
  const kcalT = t?.kcal_target ?? null
  const left = kcalT != null ? kcalT - day.kcal : null
  const pMin = t?.protein_min_g ?? null
  const macros = [
    { name: 'Proteína', color: 'var(--color-protein)', value: day.protein_g, target: pMin, band: pMin && t?.protein_max_g ? [pMin, t.protein_max_g] as [number, number] : null, of: pMin ? `${pMin}–${t!.protein_max_g}` : null },
    { name: 'Carbo', color: 'var(--color-carb)', value: day.carb_g, target: t?.carb_target_g ?? null, band: null, of: t?.carb_target_g ? `${t.carb_target_g}` : null },
    { name: 'Gordura', color: 'var(--color-fat)', value: day.fat_g, target: t?.fat_min_g ?? null, band: t?.fat_min_g && t.fat_max_g ? [t.fat_min_g, t.fat_max_g] as [number, number] : null, of: t?.fat_min_g ? `${t.fat_min_g}–${t.fat_max_g}` : null },
  ]
  return (
    <Card tone="raised" aria-label="Macros do dia">
      <div className="flex flex-col items-center">
        <Ring value={day.kcal} target={kcalT} color="var(--color-kcal)" size={184} stroke={16}
          label={`Calorias: ${intFmt(day.kcal)}${kcalT ? ` de ${intFmt(kcalT)}` : ''} kcal`}>
          <span className="text-[48px] font-bold leading-none tracking-[-0.02em] tabular-nums">{intFmt(left != null ? Math.abs(left) : day.kcal)}</span>
          <span className="mt-1 text-sm text-muted">{left == null ? 'kcal no dia' : left >= 0 ? 'kcal restantes' : 'kcal acima'}</span>
        </Ring>
        <p className="mt-3 text-[15px] tabular-nums text-muted">
          <b className="font-semibold text-kcal">{intFmt(day.kcal)}</b>{kcalT ? <> / {intFmt(kcalT)} kcal</> : ' kcal · meta ainda não definida'}
        </p>
      </div>
      <ul className="mt-5 flex flex-col gap-4 border-t border-line pt-5">
        {macros.map((m) => {
          const pct = m.target ? Math.round((m.value / m.target) * 100) : null
          return (
            <li key={m.name}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="flex items-center gap-2 font-medium">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: m.color }} aria-hidden="true" />{m.name}
                </span>
                <span className="tabular-nums text-muted">
                  <b className="text-lg font-bold text-fg">{intFmt(m.value)}</b>{m.of ? ` / ${m.of} g` : ' g'}
                  {pct != null && <span className="ml-2 inline-block w-11 text-right text-sm">{pct}%</span>}
                </span>
              </div>
              <Meter className="mt-2" value={m.value} max={m.target ?? m.value} color={m.color} target={m.band ? null : m.target} band={m.band}
                label={`${m.name}: ${intFmt(m.value)} g${m.of ? ` de ${m.of} g` : ''}`} />
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function Checks({ day, date, t }: { day: DailyNutrition; date: string; t: NutritionTargets | null }) {
  const toggle = useToggleCreatine()
  const lo = t?.water_min_ml ?? null
  const hi = t?.water_max_ml ?? null
  return (
    <div className="flex flex-col gap-3">
      <CreatineButton on={day.creatine} onToggle={() => {
        haptic(15)
        toggle.mutate({ date, value: !day.creatine }, { onError: () => toast('Não salvou a creatina. Tente de novo.', { tone: 'err' }) })
      }} />
      <div className="rounded-2xl bg-card px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="flex items-center gap-2 font-semibold"><Droplets size={20} className="text-protein" aria-hidden="true" /> Água</span>
          <span className="tabular-nums text-muted">
            {day.water_ml ? <b className="text-lg font-bold text-fg">{num(day.water_ml / 1000)} L</b> : 'sem registro'}
            {lo && hi ? ` / ${num(lo / 1000)}–${num(hi / 1000)} L` : ''}
          </span>
        </div>
        {lo && hi && <Meter className="mt-2.5" value={day.water_ml ?? 0} max={hi} color="var(--color-protein)" band={[lo, hi]} label={`Água: ${num((day.water_ml ?? 0) / 1000)} L de ${num(lo / 1000)} a ${num(hi / 1000)} L`} />}
      </div>
    </div>
  )
}

export function CreatineButton({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} aria-pressed={on}
      className={`flex h-14 w-full items-center gap-3 rounded-2xl px-3 text-left transition-colors duration-150 ${on ? 'bg-lime/12 ring-1 ring-lime/50' : 'bg-card-2 hover:bg-line/60'}`}>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${on ? 'check-pop bg-lime text-bg' : 'border-2 border-muted/50 text-muted'}`} aria-hidden="true">
        {on ? <Check size={20} strokeWidth={3} /> : <Pill size={18} />}
      </span>
      <span className="flex-1 font-semibold">Creatina</span>
      <span className={`text-[15px] font-semibold ${on ? 'text-lime' : 'text-muted'}`}>{on ? 'tomada' : 'marcar'}</span>
    </button>
  )
}

function EmptyDay({ isToday }: { isToday: boolean }) {
  return (
    <div className="mt-3 flex items-center gap-3 rounded-2xl border border-dashed border-line p-4">
      <MessageCircle size={22} className="shrink-0 text-muted" aria-hidden="true" />
      <p className="text-[15px] text-muted"><span className="font-medium text-fg">{isToday ? 'Nada registrado hoje.' : 'Sem refeições neste dia.'}</span> Mande foto ou texto no chat.</p>
    </div>
  )
}

function Meals({ logs }: { logs: FoodLog[] }) {
  const groups: { meal: string; items: FoodLog[] }[] = []
  for (const l of logs) {
    const m = l.meal || 'Outros'
    const g = groups.find((x) => x.meal === m)
    if (g) g.items.push(l); else groups.push({ meal: m, items: [l] })
  }
  return (
    <div className="mt-2 flex flex-col">
      {groups.map((g) => {
        const sum = (k: 'kcal' | 'protein_g' | 'carb_g' | 'fat_g') => g.items.reduce((s, i) => s + Number(i[k]), 0)
        const kcal = sum('kcal'); const p = sum('protein_g'); const c = sum('carb_g'); const f = sum('fat_g')
        const parts = [{ v: p * 4, c: 'var(--color-protein)' }, { v: c * 4, c: 'var(--color-carb)' }, { v: f * 9, c: 'var(--color-fat)' }]
        const tot = parts.reduce((s, x) => s + x.v, 0) || 1
        return (
          <section key={g.meal} className="border-b border-line py-3.5 last:border-0">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-lg font-semibold">{capitalize(g.meal)}</h3>
              <p className="tabular-nums text-muted"><b className="text-lg font-bold text-kcal">{intFmt(kcal)}</b> kcal</p>
            </div>
            <div className="mt-2 flex h-1.5 gap-0.5 overflow-hidden rounded-full" role="img"
              aria-label={`Proteína ${intFmt(p)} g, carboidrato ${intFmt(c)} g, gordura ${intFmt(f)} g`}>
              {parts.map((x, i) => <span key={i} style={{ width: `${(x.v / tot) * 100}%`, background: x.c }} />)}
            </div>
            <p className="mt-1.5 flex gap-3 text-[13px] tabular-nums text-muted">
              <span><b className="text-protein">{intFmt(p)}</b> P</span><span><b className="text-carb">{intFmt(c)}</b> C</span><span><b className="text-fat">{intFmt(f)}</b> G</span>
            </p>
            <ul className="mt-2 flex flex-col gap-1">
              {g.items.map((i) => (
                <li key={i.id} className="flex items-start justify-between gap-3 text-[15px]">
                  <span className="min-w-0">
                    <span className="text-fg">{i.description}</span>
                    <span className="text-muted"> · {i.portion_label ? `${i.portion_qty && i.portion_qty !== 1 ? `${kgFmt(i.portion_qty)} × ` : ''}${i.portion_label} (${intFmt(i.grams)} g)` : i.grams ? `${intFmt(i.grams)} g` : ''}</span>
                    {i.estimated && <Badge tone="warn" className="ml-1.5 align-middle">estimado</Badge>}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted">{intFmt(i.kcal)}</span>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
