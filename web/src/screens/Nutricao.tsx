import { useEffect, useId, useRef, useState } from 'react'
import { CalendarCheck, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, Droplets, ImageOff, Maximize2, MessageCircle, Pill, X } from 'lucide-react'
import { useDailyNutrition, useEnergyDaily, useFoodLogs, useMealPhotos, useNutritionTargets, useSignedUrls, useToggleCreatine } from '../lib/api'
import type { DailyNutrition, FoodLog, MealPhoto, NutritionTargets } from '../lib/types'
import { TZ, addDays, capitalize, intFmt, kgFmt, longDay, num, plural, todaySP } from '../lib/format'
import { Badge, Button, Card, ErrorState, IconButton, Skeleton, haptic, toast } from '../components/ui'
import { Meter } from '../components/viz'
import { Ring } from '../components/Ring'
import { type KcalTargets, hasDynamicIdeal, idealKcal, mainTarget, pctOf, signedKcal, useKcalTargets } from '../lib/kcal'

const EMPTY: DailyNutrition = { date: '', kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0, n_items: 0, has_estimated: false, food_logged: false, creatine: false, creatine_g: null, water_ml: null }

export function Nutricao() {
  const [date, setDate] = useState(todaySP())
  const today = todaySP()
  const daily = useDailyNutrition()
  const targets = useNutritionTargets()
  const logs = useFoodLogs(date)
  const photos = useMealPhotos(date)
  // hoje: metas com/sem treino (lib/kcal.ts); dias passados: gasto real − déficit. Mesma janela de 60 dias da aba Calorias.
  const energy = useEnergyDaily(60)
  const kt = useKcalTargets()
  const isToday = date === today
  const energyDay = energy.data?.find((e) => e.date === date)
  const k = isToday ? kt.data : null
  const day = daily.data?.find((d) => d.date === date) ?? { ...EMPTY, date }
  const t = targets.data
  const meals = logs.data && photos.data ? groupMeals(logs.data, photos.data) : []

  // desktop: dia, macros e checks à esquerda; feed de refeições à direita (ordem do celular intacta)
  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:grid-rows-[auto_auto_auto_auto_1fr] lg:items-start lg:gap-x-6 lg:gap-y-4">
      <div className="flex items-center justify-between gap-3 pt-1 lg:col-span-2">
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em]">Nutrição</h1>
        {date !== today && (
          <Button onClick={() => setDate(today)} className="flex items-center gap-2"><CalendarCheck size={18} aria-hidden="true" /> Hoje</Button>
        )}
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-card p-1 lg:col-start-1" role="group" aria-label="Dia">
        <IconButton label="Dia anterior" onClick={() => setDate(addDays(date, -1))}><ChevronLeft size={24} /></IconButton>
        <p className="text-center" aria-live="polite">
          <span className="block font-semibold">{date === today ? 'Hoje' : date === addDays(today, -1) ? 'Ontem' : capitalize(longDay(date).split(',')[0])}</span>
          <span className="block text-sm text-muted">{capitalize(longDay(date).split(', ')[1] ?? '')}</span>
        </p>
        <IconButton label="Próximo dia" onClick={() => setDate(addDays(date, 1))} disabled={date >= today} className="disabled:opacity-30">
          <ChevronRight size={24} />
        </IconButton>
      </div>

      <div className="lg:col-start-1">
      {daily.isError || targets.isError ? (
        <ErrorState what="a nutrição" onRetry={() => { daily.refetch(); targets.refetch() }} />
      ) : daily.isPending || targets.isPending || energy.isPending || (isToday && kt.isPending) ? (
        <Skeleton className="h-80" />
      ) : (
        <Macros day={day} t={t ?? null} k={k}
          ideal={isToday ? mainTarget(k) : idealKcal(energyDay, t?.kcal_target ?? null)}
          dynamic={isToday ? !!k?.dynamic : hasDynamicIdeal(energyDay)} />
      )}
      </div>

      <section aria-labelledby="ref-title" className="flex flex-col gap-3 lg:col-start-2 lg:row-span-4 lg:row-start-2">
        <div className="mt-2 flex items-baseline justify-between gap-3 lg:mt-0">
          <h2 id="ref-title" className="text-xl font-semibold">Refeições</h2>
          {meals.length > 0 && <span className="text-sm tabular-nums text-muted">{plural(meals.length, 'refeição', 'refeições')}</span>}
        </div>
        {logs.isError || photos.isError ? <ErrorState what="as refeições" onRetry={() => { logs.refetch(); photos.refetch() }} />
          : logs.isPending || photos.isPending ? <><Skeleton className="h-40" /><Skeleton className="h-40" /></>
            : meals.length === 0 ? <EmptyDay isToday={date === today} />
              : <Feed meals={meals} />}
      </section>

      <div className="lg:col-start-1"><Checks day={day} date={date} t={t ?? null} /></div>
    </div>
  )
}

function Macros({ day, t, k, ideal, dynamic }: {
  day: DailyNutrition; t: NutritionTargets | null; k: KcalTargets | null; ideal: number | null; dynamic: boolean
}) {
  const kcalT = ideal
  const kcalPct = pctOf(day.kcal, kcalT)
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
          label={`Calorias: ${intFmt(day.kcal)}${kcalT ? ` de ${intFmt(kcalT)} ideais (${kcalPct}%)` : ''} kcal`}>
          <span className="text-[48px] font-bold leading-none tracking-[-0.02em] tabular-nums">{intFmt(left != null ? Math.abs(left) : day.kcal)}</span>
          <span className="mt-1 text-sm text-muted">{left == null ? 'kcal no dia' : left >= 0 ? 'kcal restantes' : 'kcal acima'}</span>
        </Ring>
        <p className="mt-3 text-[15px] tabular-nums text-muted">
          <b className="font-semibold text-kcal">{intFmt(day.kcal)}</b>{kcalT ? <> / {intFmt(kcalT)} kcal · <b className="font-semibold text-fg">{kcalPct}%</b></> : ' kcal · meta ainda não definida'}
        </p>
        {kcalT != null && (
          <p className="mt-0.5 text-[13px] text-muted">
            {!dynamic ? 'meta fixa (sem gasto calculado para o dia)'
              : k ? (k.hasPlan ? 'meta com o treino que falta hoje' : 'meta de hoje (sem treino pendente)')
                : 'ideal do dia (gasto − déficit)'}
          </p>
        )}
      </div>
      {k?.dynamic && <KcalTargetsBlock k={k} kcal={day.kcal} />}
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

/** Hoje: as duas metas (com / sem o treino que falta), cada uma com o consumido, e o ajuste dos 7 dias. */
function KcalTargetsBlock({ k, kcal }: { k: KcalTargets; kcal: number }) {
  const rows = k.hasPlan
    ? [{ name: 'Com treino', target: k.withWorkout, sub: `+${intFmt(k.plannedKcal)} kcal do treino que falta` },
       { name: 'Sem treino', target: k.noWorkout, sub: 'só o exercício já registrado' }]
    : [{ name: 'Sem treino pendente', target: k.noWorkout, sub: 'exercício de hoje já contado' }]
  return (
    <div className="mt-5 flex flex-col gap-4 border-t border-line pt-5">
      {rows.map((r) => r.target != null && (
        <div key={r.name}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-medium">{r.name}</span>
            <span className="tabular-nums text-muted">
              <b className="text-lg font-bold text-fg">{intFmt(kcal)}</b> / {intFmt(r.target)} kcal
              <span className="ml-2 inline-block w-11 text-right text-sm">{pctOf(kcal, r.target)}%</span>
            </span>
          </div>
          <Meter className="mt-2" value={kcal} max={r.target} color="var(--color-kcal)" target={r.target}
            label={`${r.name}: ${intFmt(kcal)} de ${intFmt(r.target)} kcal`} />
          <p className="mt-1 text-[13px] text-muted">{r.sub}</p>
        </div>
      ))}
      <p className="text-[13px] tabular-nums text-muted">
        {k.adjustDays
          ? <>Ajuste 7d <b className="font-semibold text-fg">{signedKcal(k.adjust)}</b> kcal/dia · desvio da meta em {k.adjustDays} {k.adjustDays === 1 ? 'dia' : 'dias'}, dividido por 7 (teto ±300)</>
          : 'Ajuste 7d: coletando dados (precisa de dias com refeições e basal)'}
      </p>
    </div>
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
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${on ? 'check-pop action-fill' : 'border-2 border-muted/50 text-muted'}`} aria-hidden="true">
        {on ? <Check size={20} strokeWidth={3} /> : <Pill size={18} />}
      </span>
      <span className="flex-1 font-semibold">Creatina</span>
      <span className={`text-[15px] font-semibold ${on ? 'text-lime' : 'text-muted'}`}>{on ? 'tomada' : 'marcar'}</span>
    </button>
  )
}

function EmptyDay({ isToday }: { isToday: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-line p-4">
      <MessageCircle size={22} className="shrink-0 text-muted" aria-hidden="true" />
      <p className="text-[15px] text-muted"><span className="font-medium text-fg">{isToday ? 'Nada registrado hoje.' : 'Sem refeições neste dia.'}</span> Mande foto ou texto no chat.</p>
    </div>
  )
}

// ---------------------------------------------------------------- feed de refeições
interface Meal { key: string; name: string; at: string; items: FoodLog[]; photos: MealPhoto[]; kcal: number; p: number; c: number; f: number; estimated: boolean }

const mealKey = (m: string | null) => norm(m || 'outros').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
const MEAL_NAMES: Record<string, string> = {
  cafe: 'Café da manhã', 'cafe-da-manha': 'Café da manhã', almoco: 'Almoço', jantar: 'Jantar', lanche: 'Lanche', ceia: 'Ceia',
  'pre-treino': 'Pré-treino', 'pos-treino': 'Pós-treino', outros: 'Outros',
}
const g1 = (n: number) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
const hm = (ts: string) => new Date(ts).toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })

/** Agrupa itens e fotos pelo nome da refeição (sem acento/caixa: "café" = "cafe"), em ordem cronológica. */
function groupMeals(logs: FoodLog[], photos: MealPhoto[]): Meal[] {
  const by = new Map<string, Meal>()
  const get = (raw: string | null, at: string) => {
    const key = mealKey(raw)
    let m = by.get(key)
    if (!m) by.set(key, m = { key, name: MEAL_NAMES[key] ?? capitalize(raw?.trim() || 'Outros'), at, items: [], photos: [], kcal: 0, p: 0, c: 0, f: 0, estimated: false })
    if (at < m.at) m.at = at
    return m
  }
  for (const l of logs) {
    const m = get(l.meal, l.logged_at)
    m.items.push(l)
    m.kcal += Number(l.kcal); m.p += Number(l.protein_g); m.c += Number(l.carb_g); m.f += Number(l.fat_g)
    m.estimated ||= l.estimated
  }
  for (const ph of photos) get(ph.meal, ph.created_at).photos.push(ph)
  return [...by.values()].sort((a, b) => a.at.localeCompare(b.at))
}

function Feed({ meals }: { meals: Meal[] }) {
  const all = meals.flatMap((m) => m.photos)
  const thumbs = useSignedUrls(all.map((p) => p.thumb_path ?? p.path), 'meals')
  const [view, setView] = useState<{ meal: Meal; i: number } | null>(null)
  return (
    <>
      <ol className="flex flex-col gap-3">
        {meals.map((m) => (
          <li key={m.key}>
            <MealCard meal={m} thumb={m.photos[0] ? thumbs.data?.[m.photos[0].thumb_path ?? m.photos[0].path] : undefined}
              thumbState={thumbs.isError ? 'error' : thumbs.isPending ? 'loading' : 'ok'} onOpen={() => setView({ meal: m, i: 0 })} />
          </li>
        ))}
      </ol>
      {view && <PhotoViewer meal={view.meal} index={view.i} onIndex={(i) => setView({ ...view, i })} onClose={() => setView(null)} />}
    </>
  )
}

function MealCard({ meal: m, thumb, thumbState, onOpen }: { meal: Meal; thumb?: string; thumbState: 'loading' | 'error' | 'ok'; onOpen: () => void }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const n = m.items.length
  const allEst = n > 0 && m.items.every((i) => i.estimated)   // tudo estimado: o selo do card basta
  return (
    <Card as="article" aria-label={`${m.name}, ${intFmt(m.kcal)} kcal`} className="!p-4">
      <div className="flex gap-4">
        {m.photos.length > 0 && (
          <button type="button" onClick={onOpen} aria-label={`Ver foto: ${m.name}`}
            className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-card-2 ring-1 ring-line transition-transform duration-150 active:scale-[0.98]">
            {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" draggable={false} />
              : thumbState === 'loading' ? <span className="absolute inset-0 animate-pulse bg-line/50" aria-hidden="true" />
                : <ImageOff size={22} className="absolute inset-0 m-auto text-muted" aria-hidden="true" />}
            <span className="absolute right-1.5 bottom-1.5 flex h-7 min-w-7 items-center justify-center gap-1 rounded-full bg-black/60 px-1.5 text-xs font-semibold text-white" aria-hidden="true">
              {m.photos.length > 1 ? <>{m.photos.length}</> : null}<Maximize2 size={13} />
            </span>
          </button>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 text-lg font-semibold leading-tight">{m.name}</h3>
            <time className="shrink-0 pt-0.5 text-sm tabular-nums text-muted" dateTime={m.at}>{hm(m.at)}</time>
          </div>
          {n > 0 ? (
            <>
              <p className="mt-1 flex items-baseline gap-1.5 tabular-nums">
                <span className="text-[32px] font-bold leading-none tracking-[-0.02em] text-kcal">{intFmt(m.kcal)}</span>
                <span className="text-muted">kcal</span>
                {m.estimated && <Badge tone="warn" className="ml-auto self-center"><Camera size={13} aria-hidden="true" /> estimado</Badge>}
              </p>
              <MacroBar p={m.p} c={m.c} f={m.f} className="mt-auto pt-3" />
            </>
          ) : (
            <p className="mt-2 text-[15px] text-muted">Itens ainda não registrados.</p>
          )}
        </div>
      </div>
      {n > 0 && (
        <>
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={id}
            className="-mx-1 mt-2 -mb-2 flex h-12 w-[calc(100%+0.5rem)] items-center justify-between rounded-xl px-1 text-[15px] font-medium text-muted transition-colors duration-150 hover:text-fg">
            <span>{plural(n, 'item', 'itens')}</span>
            <ChevronDown size={20} className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {open && (
            <ul id={id} className="flex flex-col border-t border-line">
              {m.items.map((i) => <ItemRow key={i.id} i={i} mark={i.estimated && !allEst} />)}
            </ul>
          )}
        </>
      )}
    </Card>
  )
}

function MacroBar({ p, c, f, className = '' }: { p: number; c: number; f: number; className?: string }) {
  const parts = [{ v: p * 4, c: 'var(--color-protein)' }, { v: c * 4, c: 'var(--color-carb)' }, { v: f * 9, c: 'var(--color-fat)' }]
  const tot = parts.reduce((s, x) => s + x.v, 0) || 1
  return (
    <div className={className}>
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-line" role="img"
        aria-label={`Proteína ${intFmt(p)} g, carboidrato ${intFmt(c)} g, gordura ${intFmt(f)} g`}>
        {parts.map((x, i) => x.v > 0 && <span key={i} className="h-full" style={{ width: `${(x.v / tot) * 100}%`, background: x.c }} />)}
      </div>
      <p className="mt-1.5 flex gap-3 text-[13px] tabular-nums text-muted" aria-hidden="true">
        <span><b className="font-semibold text-protein">{intFmt(p)}</b> P</span>
        <span><b className="font-semibold text-carb">{intFmt(c)}</b> C</span>
        <span><b className="font-semibold text-fat">{intFmt(f)}</b> G</span>
      </p>
    </div>
  )
}

function ItemRow({ i, mark }: { i: FoodLog; mark: boolean }) {
  const qty = i.portion_label
    ? `${i.portion_qty && Number(i.portion_qty) !== 1 ? `${kgFmt(i.portion_qty)} × ` : ''}${i.portion_label}${i.grams ? ` · ${intFmt(i.grams)} g` : ''}`
    : i.grams ? `${intFmt(i.grams)} g` : null
  return (
    <li className="flex items-start justify-between gap-3 border-b border-line/60 py-3 last:border-0 last:pb-1">
      <div className="min-w-0">
        <p className="text-base leading-snug">{i.description}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] tabular-nums text-muted">
          {qty && <span className="text-fg/80">{qty}</span>}
          <span><b className="font-semibold text-protein">{g1(i.protein_g)}</b> P</span>
          <span><b className="font-semibold text-carb">{g1(i.carb_g)}</b> C</span>
          <span><b className="font-semibold text-fat">{g1(i.fat_g)}</b> G</span>
          {mark && <span className="inline-flex items-center gap-1 font-medium text-warn"><Camera size={12} aria-hidden="true" /> estimado</span>}
        </p>
      </div>
      <p className="shrink-0 text-right tabular-nums"><b className="font-semibold">{intFmt(i.kcal)}</b> <span className="text-sm text-muted">kcal</span></p>
    </li>
  )
}

/** Foto em tela cheia (signed URL do arquivo de 1600 px; a miniatura aparece enquanto carrega). */
function PhotoViewer({ meal, index, onIndex, onClose }: { meal: Meal; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const ph = meal.photos[index]
  const urls = useSignedUrls(meal.photos.flatMap((p) => [p.path, p.thumb_path ?? p.path]), 'meals')
  const full = urls.data?.[ph.path]
  const thumb = urls.data?.[ph.thumb_path ?? ph.path]
  const [loaded, setLoaded] = useState<string | null>(null)
  const many = meal.photos.length > 1
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])
  return (
    <dialog ref={ref} onClose={onClose} aria-label={`Foto: ${meal.name}`}
      className="photo-view m-0 h-dvh max-h-none w-full max-w-none bg-black p-0 text-white outline-none backdrop:bg-black">
      <div className="relative flex h-full flex-col">
        <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent px-4 pt-[max(env(safe-area-inset-top),12px)] pb-8">
          <p className="pt-2.5">
            <span className="block text-lg font-semibold">{meal.name}</span>
            <span className="block text-sm tabular-nums text-white/70">{hm(meal.at)}{meal.items.length > 0 && <> · {intFmt(meal.kcal)} kcal</>}{many && <> · {index + 1} de {meal.photos.length}</>}</span>
          </p>
          <button type="button" onClick={onClose} aria-label="Fechar foto" autoFocus
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/12 text-white transition-colors duration-150 hover:bg-white/20">
            <X size={24} />
          </button>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar foto" tabIndex={-1} className="relative flex flex-1 items-center justify-center">
          {thumb && loaded !== full && <img src={thumb} alt="" className="absolute inset-0 h-full w-full object-contain blur-sm" referrerPolicy="no-referrer" />}
          {full && <img src={full} alt={`${meal.name}${ph.note ? `: ${ph.note}` : ''}`} onLoad={() => setLoaded(full)}
            className="relative max-h-full max-w-full object-contain" referrerPolicy="no-referrer" draggable={false} />}
          {urls.isError && <span className="flex items-center gap-2 text-white/80"><ImageOff size={20} aria-hidden="true" /> Não consegui carregar a foto.</span>}
        </button>
        {(ph.note || many) && (
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/75 to-transparent px-4 pt-10 pb-[max(env(safe-area-inset-bottom),16px)]">
            {many && <button type="button" onClick={() => onIndex((index - 1 + meal.photos.length) % meal.photos.length)} aria-label="Foto anterior"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/12"><ChevronLeft size={24} /></button>}
            <p className="min-w-0 flex-1 text-[15px] text-white/85">{ph.note}</p>
            {many && <button type="button" onClick={() => onIndex((index + 1) % meal.photos.length)} aria-label="Próxima foto"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/12"><ChevronRight size={24} /></button>}
          </div>
        )}
      </div>
    </dialog>
  )
}
