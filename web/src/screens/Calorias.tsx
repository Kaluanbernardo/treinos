import { useState } from 'react'
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, MessageCircle, UserRound, Watch } from 'lucide-react'
import { useDailySteps, useEnergyDaily, useProfile } from '../lib/api'
import type { EnergyDay, Profile } from '../lib/types'
import { addDays, capitalize, dm, intFmt, longDay, num, todaySP, wdShort } from '../lib/format'
import { go } from '../lib/router'
import { Badge, Button, Card, CardHead, Collecting, ErrorState, IconButton, Segmented, Skeleton } from '../components/ui'
import { Big } from '../components/viz'
import { BalanceBars } from '../components/charts'
import { StepsStat } from '../components/Steps'

/** Gasto (basal + rotina + exercício) × comida. Regra única em v_energy_daily / docs/calorias.md. */

const C = {
  food: 'var(--color-kcal)',
  bmr: 'color-mix(in srgb, var(--color-fg) 30%, transparent)',
  life: 'color-mix(in srgb, var(--color-fg) 15%, transparent)',
  ex: 'var(--color-fg)',
}
const KCAL_PER_KG_FAT = 7700

const signedInt = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${intFmt(Math.abs(v))}`

function missingFromProfile(p: Profile | null | undefined) {
  if (!p) return ['altura', 'data de nascimento', 'sexo']
  return [!p.height_cm && 'altura', !p.birth_date && 'data de nascimento', !p.sex && 'sexo'].filter(Boolean) as string[]
}

export function Calorias() {
  const today = todaySP()
  const [date, setDate] = useState(today)
  const [period, setPeriod] = useState<'7' | '30'>('7')
  const energy = useEnergyDaily(60)
  const profile = useProfile()
  const steps = useDailySteps(60)
  const rows = energy.data ?? []
  const day = rows.find((r) => r.date === date) ?? null
  const missing = profile.data !== undefined ? missingFromProfile(profile.data) : []

  return (
    <div className="flex flex-col gap-4">
      <h1 className="pt-1 text-[28px] font-bold leading-tight tracking-[-0.02em]">Calorias</h1>

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

      {energy.isError || profile.isError ? (
        <ErrorState what="as calorias" message={energy.error?.message ?? profile.error?.message} onRetry={() => { energy.refetch(); profile.refetch() }} />
      ) : energy.isPending || profile.isPending ? (
        <><Skeleton className="h-96" /><Skeleton className="h-72" /></>
      ) : (
        <>
          <DayCard day={day} isToday={date === today} missing={missing}
            steps={steps.isSuccess ? steps.data.get(date) ?? null : undefined} />
          {missing.length > 0 && <ProfileMissing missing={missing} />}
          <BalanceCard rows={rows} period={period} setPeriod={setPeriod} selected={date} onPick={setDate} hasBmr={missing.length === 0} />
          <DaysList rows={rows} period={Number(period)} selected={date} onPick={(d) => { setDate(d); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- dia
/** `steps`: undefined = não carregou (ou coluna ainda não existe) → bloco some; null = sem leitura no dia. */
function DayCard({ day, isToday, missing, steps }: { day: EnergyDay | null; isToday: boolean; missing: string[]; steps?: number | null }) {
  const bmr = day?.bmr_kcal ?? null
  const life = day?.daily_life_kcal ?? 0
  const ex = day?.exercise_kcal ?? 0
  const food = day?.food_kcal ?? 0
  const out = day?.out_kcal ?? null
  const bal = day?.balance_kcal ?? null
  const target = day?.target_balance_kcal ?? null
  // dia em andamento: a comida ainda não fechou, então não acusa "déficit alto"
  const high = !isToday && bal != null && target != null && bal < target * 2
  const tone = bal == null ? null : bal > 0 || high ? 'warn' : 'ok'
  const word = bal == null ? '' : bal > 0 ? 'superávit' : high ? 'déficit alto' : bal < 0 ? 'déficit' : 'empate'
  const scale = Math.max(food, out ?? ex, 1)

  return (
    <Card tone="raised" aria-label="Calorias do dia">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] text-muted">{bal != null ? 'Saldo do dia' : bmr == null ? 'Comida no dia' : 'Gasto do dia'}</p>
          <Big size="lg" className="mt-1" value={bal != null ? signedInt(bal) : intFmt(bmr == null ? food : out ?? 0)} unit="kcal" />
        </div>
        {bal != null && tone && (
          <div className="flex shrink-0 flex-col items-end gap-1.5 pt-1">
            <Badge tone={tone}>
              {bal > 0 ? <ArrowUpRight size={14} strokeWidth={2.5} aria-hidden="true" /> : <ArrowDownRight size={14} strokeWidth={2.5} aria-hidden="true" />}
              {word}
            </Badge>
            {target != null && <span className="text-[13px] tabular-nums text-muted">meta {signedInt(target)}</span>}
          </div>
        )}
      </div>
      {(() => {
        const note = !day?.food_logged ? (isToday ? 'Nenhuma refeição registrada ainda.' : 'Sem refeições neste dia.')
          : bmr == null ? 'Sem basal: o gasto fica incompleto.'
            : isToday ? 'Dia em andamento: basal do dia inteiro, comida até agora.' : null
        return note && <p className="mt-2 text-sm text-muted">{note}</p>
      })()}

      <div className="mt-4 flex flex-col gap-3">
        <InOutBar label="Entrou" total={day?.food_logged ? food : null} scale={scale}
          segs={[{ v: food, c: C.food }]} aria={`Entrou: ${intFmt(food)} kcal de comida`} />
        <InOutBar label="Saiu" total={out} scale={scale} unknown={bmr == null}
          segs={[{ v: bmr ?? 0, c: C.bmr }, { v: life, c: C.life }, { v: ex, c: C.ex, striped: day?.is_estimate }]}
          aria={bmr == null ? `Saiu: basal desconhecido, exercício ${intFmt(ex)} kcal` : `Saiu: ${intFmt(out)} kcal (basal ${intFmt(bmr)}, rotina ${intFmt(life)}, exercício ${intFmt(ex)})`} />
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4">
        <Stat color={C.bmr} label="Basal" value={bmr != null ? intFmt(bmr) : '—'} sub={bmr != null ? `Mifflin · ${num(day?.weight_kg, 1)} kg` : `falta ${missing.join(', ')}`} />
        <Stat color={C.life} label="Rotina" value={bmr != null ? intFmt(life) : '—'} sub={day ? `basal × ${num((day.activity_factor ?? 1.2) - 1, 2)}` : undefined} />
        <Stat color={C.ex} label="Exercício" value={intFmt(ex)}
          sub={!day || ex === 0 ? 'sem treino' : day.is_estimate ? (day.exercise_watch_kcal ? 'relógio + estimativa' : 'estimado (MET)') : 'relógio'}
          badge={day?.is_estimate ? <Badge tone="warn">estimado</Badge> : day && day.exercise_watch_kcal > 0 ? <Watch size={14} className="text-muted" aria-label="do relógio" /> : null} />
        <Stat color={C.food} label="Comida" value={day?.food_logged ? intFmt(food) : '—'}
          sub={day?.food_has_estimated ? 'com estimativa' : day?.food_logged ? 'registrada no chat' : 'nada ainda'} />
      </dl>

      {steps !== undefined && (
        <div className="mt-4 border-t border-line pt-4">
          <StepsStat steps={steps} hint={isToday ? 'Sem leitura hoje. Mande os passos no chat.' : 'Sem leitura neste dia.'} />
          <p className="mt-2 text-[13px] text-muted">Só acompanhamento: passos não mudam o gasto (a rotina é um fator sobre o basal).</p>
        </div>
      )}
    </Card>
  )
}

function InOutBar({ label, total, segs, scale, unknown = false, aria }: {
  label: string; total: number | null; segs: { v: number; c: string; striped?: boolean }[]; scale: number; unknown?: boolean; aria: string
}) {
  const shown = segs.filter((s) => s.v > 0)
  return (
    <div className="grid grid-cols-[52px_1fr_auto] items-center gap-3">
      <span className="text-[13px] text-muted">{label}</span>
      <div role="img" aria-label={aria} className={`flex h-4 gap-0.5 overflow-hidden rounded-full ${unknown ? 'border border-dashed border-line' : 'bg-line/50'}`}>
        {shown.map((s, i) => (
          <span key={i} className="meter-fill h-full first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${(s.v / scale) * 100}%`,
              background: s.striped ? `repeating-linear-gradient(135deg, ${s.c} 0 4px, transparent 4px 7px)` : s.c,
            }} />
        ))}
      </div>
      <span className="w-14 text-right text-[15px] font-semibold tabular-nums">{total != null ? intFmt(total) : '—'}</span>
    </div>
  )
}

function Stat({ color, label, value, sub, badge }: { color: string; label: string; value: string; sub?: string; badge?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-[13px] text-muted">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-line" style={{ background: color }} aria-hidden="true" />{label}
        {badge && <span className="ml-auto">{badge}</span>}
      </dt>
      <dd>
        <span className="text-[22px] font-bold leading-tight tabular-nums">{value}</span>
        {sub && <span className="block truncate text-[13px] text-muted">{sub}</span>}
      </dd>
    </div>
  )
}

function ProfileMissing({ missing }: { missing: string[] }) {
  return (
    <Card aria-labelledby="pm-title">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-line/60 text-muted" aria-hidden="true"><UserRound size={22} /></span>
        <div className="min-w-0">
          <h2 id="pm-title" className="text-lg font-semibold leading-tight">Falta o perfil para o basal</h2>
          <p className="mt-1 text-[15px] text-muted">Informe {missing.join(', ').replace(/, ([^,]*)$/, ' e $1')}. Sem isso, gasto e saldo ficam em branco.</p>
        </div>
      </div>
      <Button variant="primary" size="lg" className="mt-4 w-full" onClick={() => go('config/perfil')}>
        <UserRound size={20} aria-hidden="true" /> Completar em Configurações
      </Button>
    </Card>
  )
}

// ---------------------------------------------------------------- período
function lastDays(rows: EnergyDay[], n: number) {
  const today = todaySP()
  const by = new Map(rows.map((r) => [r.date, r]))
  return Array.from({ length: n }, (_, i) => addDays(today, i - n + 1)).map((d) => ({ date: d, row: by.get(d) ?? null }))
}

function BalanceCard({ rows, period, setPeriod, selected, onPick, hasBmr }: {
  rows: EnergyDay[]; period: '7' | '30'; setPeriod: (p: '7' | '30') => void; selected: string; onPick: (d: string) => void; hasBmr: boolean
}) {
  const n = Number(period)
  const days = lastDays(rows, n)
  const withBal = days.filter((d) => d.row?.balance_kcal != null)
  const sum = withBal.reduce((s, d) => s + d.row!.balance_kcal!, 0)
  const avg = withBal.length ? sum / withBal.length : null
  const target = rows.at(-1)?.target_balance_kcal ?? null
  const need = 3

  return (
    <Card aria-labelledby="bal-title">
      <CardHead id="bal-title" title="Saldo diário" sub={`comida − gasto · abaixo de zero é déficit${target != null ? ` · tracejado = meta ${signedInt(target)}` : ''}`} />
      <div className="mt-4">
        <Segmented size="sm" label="Período" value={period} onChange={setPeriod}
          options={[{ value: '7', label: '7 dias' }, { value: '30', label: '30 dias' }]} track="bg-bg/70 ring-1 ring-line" />
      </div>
      <div className="mt-4">
        {!hasBmr ? (
          <Collecting title="Sem basal, sem saldo">Complete altura, nascimento e sexo em Configurações para o gráfico aparecer.</Collecting>
        ) : withBal.length < need ? (
          <Collecting title="Coletando dados" progress={{ have: withBal.length, need, unit: 'dias com refeição' }}>
            O saldo aparece com {need} dias que tenham refeições registradas no chat.
          </Collecting>
        ) : (
          <>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[13px] text-muted">Média por dia</p>
                <Big size="md" value={signedInt(Math.round(avg!))} unit="kcal" />
              </div>
              <p className="pb-0.5 text-right text-[13px] leading-snug text-muted tabular-nums">
                {withBal.length} de {n} dias<br />
                ≈ {num(Math.abs(sum) / KCAL_PER_KG_FAT, 2)} kg {sum < 0 ? 'a menos' : 'a mais'}
              </p>
            </div>
            <div className="mt-3">
              <BalanceBars ariaLabel={`Saldo diário dos últimos ${n} dias`} color="var(--color-kcal)" target={target} selected={selected} onPick={onPick}
                data={days.map((d) => ({
                  date: d.date, label: n <= 7 ? capitalize(wdShort(d.date)).slice(0, 3) : dm(d.date),
                  value: d.row?.balance_kcal ?? null, food: d.row?.food_kcal ?? null, out: d.row?.out_kcal ?? null,
                }))} />
            </div>
          </>
        )}
      </div>
    </Card>
  )
}

function DaysList({ rows, period, selected, onPick }: { rows: EnergyDay[]; period: number; selected: string; onPick: (d: string) => void }) {
  const days = lastDays(rows, period).reverse()
  const scale = Math.max(1, ...days.map((d) => Math.max(d.row?.food_kcal ?? 0, d.row?.out_kcal ?? d.row?.exercise_kcal ?? 0)))
  const today = todaySP()
  return (
    <Card aria-labelledby="days-title">
      <CardHead id="days-title" title="Por dia" sub={`últimos ${period} dias · toque para ver o dia`} />
      <ul className="mt-2 flex flex-col">
        {days.map(({ date, row }) => {
          const bal = row?.balance_kcal ?? null
          const on = date === selected
          return (
            <li key={date} className="border-b border-line last:border-0">
              <button type="button" onClick={() => onPick(date)} aria-current={on ? 'date' : undefined}
                className={`-mx-2 my-1 grid w-[calc(100%+16px)] grid-cols-[56px_1fr_76px] items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors duration-150 ${on ? 'bg-card-2 ring-1 ring-lime/35' : 'hover:bg-card-2'}`}>
                <span className="leading-tight">
                  <span className={`block text-[13px] ${date === today ? 'font-semibold text-lime' : 'text-muted'}`}>{date === today ? 'Hoje' : capitalize(wdShort(date)).slice(0, 3)}</span>
                  <span className="block text-[15px] font-semibold tabular-nums">{dm(date)}</span>
                </span>
                <span className="flex flex-col gap-1" aria-hidden="true">
                  <span className="block h-1.5 rounded-full" style={{ width: `${((row?.food_logged ? row.food_kcal : 0) / scale) * 100}%`, background: C.food }} />
                  <span className="flex h-1.5 gap-px overflow-hidden rounded-full" style={{ width: `${((row?.out_kcal ?? row?.exercise_kcal ?? 0) / scale) * 100}%` }}>
                    {row?.bmr_kcal != null && <span style={{ flex: row.bmr_kcal, background: C.bmr }} />}
                    {row?.daily_life_kcal ? <span style={{ flex: row.daily_life_kcal, background: C.life }} /> : null}
                    {row?.exercise_kcal ? <span style={{ flex: row.exercise_kcal, background: C.ex }} /> : null}
                  </span>
                </span>
                <span className="text-right leading-tight">
                  {bal != null ? (
                    <>
                      <span className="block text-lg font-bold tabular-nums">{signedInt(bal)}</span>
                      <span className="block text-[12px] text-muted">{bal < 0 ? 'déficit' : bal > 0 ? 'superávit' : 'empate'}</span>
                    </>
                  ) : (
                    <span className="flex items-center justify-end gap-1 text-[13px] text-muted">
                      {row?.food_logged ? 'sem basal' : <><MessageCircle size={14} aria-hidden="true" /> sem refeição</>}
                    </span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted" aria-hidden="true">
        <Legend color={C.food} label="comida" /><Legend color={C.bmr} label="basal" /><Legend color={C.life} label="rotina" /><Legend color={C.ex} label="exercício" />
      </p>
    </Card>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full ring-1 ring-line" style={{ background: color }} />{label}</span>
}
