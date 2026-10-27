import { useState } from 'react'
import { Camera, Check, ChevronLeft, ChevronRight, Droplets, MessageCircle, Pill } from 'lucide-react'
import { useDailyNutrition, useFoodLogs, useNutritionTargets, useToggleCreatine } from '../lib/api'
import type { DailyNutrition, FoodLog, NutritionTargets } from '../lib/types'
import { addDays, capitalize, intFmt, kgFmt, longDay, num, todaySP } from '../lib/format'
import { Badge, Card, CardHead, ErrorState, IconButton, ScreenHeader, Skeleton, haptic, toast } from '../components/ui'
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
      <ScreenHeader title="Nutrição" sub="Registro pelo chat; aqui é só para ver" />

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
        <Rings day={day} t={t ?? null} />
      )}

      <Checks day={day} date={date} t={t ?? null} />

      <Card aria-labelledby="ref-title">
        <CardHead id="ref-title" title="Refeições" aside={day.has_estimated ? <Badge tone="warn"><Camera size={13} aria-hidden="true" /> tem estimativa</Badge> : undefined} />
        {logs.isError ? <div className="mt-3"><ErrorState what="as refeições" onRetry={() => logs.refetch()} /></div>
          : logs.isPending ? <Skeleton className="mt-3 h-32" />
            : logs.data!.length === 0 ? <EmptyDay isToday={date === today} />
              : <Meals logs={logs.data!} />}
      </Card>
    </div>
  )
}

function Rings({ day, t }: { day: DailyNutrition; t: NutritionTargets | null }) {
  const kcalT = t?.kcal_target ?? null
  const left = kcalT != null ? kcalT - day.kcal : null
  const pMin = t?.protein_min_g ?? null
  return (
    <Card tone="raised" aria-label="Macros do dia">
      <div className="flex items-center gap-5">
        <Ring value={day.kcal} target={kcalT} color="var(--color-kcal)" size={148} stroke={14}
          label={`Calorias: ${intFmt(day.kcal)}${kcalT ? ` de ${intFmt(kcalT)}` : ''} kcal`}>
          {left != null ? (
            <>
              <span className="text-[34px] font-bold leading-none tabular-nums">{intFmt(Math.abs(left))}</span>
              <span className="mt-1 text-xs text-muted">{left >= 0 ? 'kcal restantes' : 'kcal acima'}</span>
            </>
          ) : (
            <>
              <span className="text-[34px] font-bold leading-none tabular-nums">{intFmt(day.kcal)}</span>
              <span className="mt-1 text-xs text-muted">kcal no dia</span>
            </>
          )}
        </Ring>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">Calorias</p>
          <p className="text-2xl font-semibold tabular-nums">{intFmt(day.kcal)}<span className="text-base font-normal text-muted"> {kcalT ? `/ ${intFmt(kcalT)}` : ''} kcal</span></p>
          {!kcalT && <p className="mt-1 text-sm leading-snug text-muted">Meta de kcal ainda não definida: o assistente calcula com o TDEE (déficit de ~300 kcal).</p>}
          <p className="mt-2 text-sm text-muted">Proteína <b className="text-fg tabular-nums">{intFmt(day.protein_g)} g</b>{pMin ? <> · meta {pMin}–{t!.protein_max_g} g</> : null}</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 border-t border-line pt-5">
        <MacroRing name="Proteína" color="var(--color-protein)" value={day.protein_g} target={pMin} sub={pMin ? `meta ${pMin}–${t!.protein_max_g} g` : 'sem meta'} />
        <MacroRing name="Carbo" color="var(--color-carb)" value={day.carb_g} target={t?.carb_target_g ?? null} sub={t?.carb_target_g ? `meta ${t.carb_target_g} g` : 'meta com as kcal'} />
        <MacroRing name="Gordura" color="var(--color-fat)" value={day.fat_g} target={t?.fat_min_g ?? null} sub={t?.fat_min_g ? `meta ${t.fat_min_g}–${t.fat_max_g} g` : 'sem meta'} />
      </div>
    </Card>
  )
}

function MacroRing({ name, color, value, target, sub }: { name: string; color: string; value: number; target: number | null; sub: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <Ring value={value} target={target} color={color} size={88} stroke={9} label={`${name}: ${intFmt(value)} g${target ? ` de ${target} g` : ''}`}>
        <span className="text-xl font-bold leading-none tabular-nums">{intFmt(value)}</span>
        <span className="text-[11px] text-muted">g</span>
      </Ring>
      <p className="mt-2 text-sm font-medium">{name}</p>
      <p className="text-xs leading-snug text-muted">{sub}</p>
    </div>
  )
}

function Checks({ day, date, t }: { day: DailyNutrition; date: string; t: NutritionTargets | null }) {
  const toggle = useToggleCreatine()
  return (
    <div className="grid grid-cols-2 gap-3">
      <CreatineButton on={day.creatine} onToggle={() => {
        haptic(15)
        toggle.mutate({ date, value: !day.creatine }, { onError: () => toast('Não salvou a creatina. Tente de novo.', { tone: 'err' }) })
      }} />
      <div className="flex min-h-16 items-center gap-3 rounded-2xl bg-card px-4 py-3">
        <Droplets size={22} className="shrink-0 text-protein" aria-hidden="true" />
        <span className="min-w-0">
          <span className="block text-sm text-muted">Água</span>
          <span className="block font-semibold tabular-nums">
            {day.water_ml ? `${num(day.water_ml / 1000)} L` : 'pelo chat'}
            {t?.water_min_ml ? <span className="font-normal text-muted"> / {num(t.water_min_ml / 1000)}–{num(t.water_max_ml! / 1000)} L</span> : null}
          </span>
        </span>
      </div>
    </div>
  )
}

export function CreatineButton({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} aria-pressed={on}
      className={`flex min-h-16 items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors duration-150 ${on ? 'bg-lime/15 ring-1 ring-lime/50' : 'bg-card hover:bg-card-2'}`}>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${on ? 'check-pop bg-lime text-bg' : 'border-2 border-line text-muted'}`} aria-hidden="true">
        {on ? <Check size={20} strokeWidth={3} /> : <Pill size={18} />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-muted">Creatina</span>
        <span className={`block font-semibold ${on ? 'text-lime' : ''}`}>{on ? 'tomada' : 'tocar quando tomar'}</span>
      </span>
    </button>
  )
}

function EmptyDay({ isToday }: { isToday: boolean }) {
  return (
    <div className="mt-3 flex gap-3 rounded-2xl border border-dashed border-line p-4">
      <MessageCircle size={22} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
      <div>
        <p className="font-medium">{isToday ? 'Nada registrado hoje ainda' : 'Nenhuma refeição registrada neste dia'}</p>
        <p className="mt-1 text-[15px] leading-relaxed text-muted">
          Mande a foto ou descreva a refeição no chat ("almoço: arroz, feijão, 1 filé de frango"). O assistente
          converte em gramas pela TACO e ela aparece aqui com kcal e proteína.
        </p>
      </div>
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
        const kcal = g.items.reduce((s, i) => s + Number(i.kcal), 0)
        const p = g.items.reduce((s, i) => s + Number(i.protein_g), 0)
        return (
          <section key={g.meal} className="border-b border-line py-3 last:border-0">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-semibold">{capitalize(g.meal)}</h3>
              <p className="text-sm tabular-nums text-muted"><b className="text-kcal">{intFmt(kcal)}</b> kcal · <b className="text-protein">{intFmt(p)}</b> g prot.</p>
            </div>
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {g.items.map((i) => (
                <li key={i.id} className="flex items-start justify-between gap-3 text-[15px]">
                  <span className="min-w-0">
                    <span className="text-fg">{i.description}</span>
                    <span className="text-muted"> · {i.portion_label ? `${i.portion_qty && i.portion_qty !== 1 ? `${kgFmt(i.portion_qty)} × ` : ''}${i.portion_label} (${intFmt(i.grams)} g)` : i.grams ? `${intFmt(i.grams)} g` : ''}</span>
                    {i.estimated && <Badge tone="warn" className="ml-1.5 align-middle">estimado</Badge>}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted">{intFmt(i.kcal)} kcal</span>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
