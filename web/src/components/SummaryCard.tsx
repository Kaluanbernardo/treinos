import { useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Check, Trophy } from 'lucide-react'
import { useDayTargets, useMonthlySummary, useWeekGoal, useWeeklySummary } from '../lib/api'
import { weekReading, weekStatus } from '../lib/training'
import { type Macro, type PeriodMacro, MACRO_NAME, periodNutrition } from '../lib/macros'
import { signedInt } from '../lib/balance'
import { MacroZoneBar, ZoneWord } from './Protein'
import type { PeriodSummary } from '../lib/types'
import { addDays, dm, intFmt, monthLabel, num, todaySP, weekStart } from '../lib/format'
import { Ring } from './Ring'
import { Big, Delta } from './viz'
import { Button, Card, CardHead } from './ui'

/** Treinos feitos no período: soma de by_modality (feito + parcial, sem teto pelo plano; mesma conta de v_training_weeks). */
export const periodDone = (row: PeriodSummary) =>
  Object.values(row.by_modality ?? {}).reduce((s, m) => s + Number(m?.done ?? 0), 0)

/**
 * Números de um período (semana ou mês): treinos contra a meta semanal (faixa 4–9) + grade com peso, cintura,
 * saldo real contra a meta (−300 × dias) e proteína, carbo e gordura por zona. Saldo e macros usam os mesmos dias
 * (fechados, com refeição e basal, diário completo; v_day_targets). Hoje (segunda / dia 1) e Evolução.
 */
export function SummaryStats({ row, prev }: { row: PeriodSummary; prev?: PeriodSummary }) {
  const goal = useWeekGoal()
  const dayT = useDayTargets(row.period_start, row.period_end)
  const pn = dayT.data ? periodNutrition(dayT.data, row.period_start, row.period_end) : null
  const gmin = goal.week?.goal_min ?? 4
  const gmax = goal.week?.goal_max ?? 9
  const week = row.days_in_period <= 7
  const done = periodDone(row)
  const today = todaySP()
  const current = row.period_start <= today && today <= row.period_end
  const weeksIn = row.days_in_period / 7
  const perWeek = done / weeksIn
  const st = weekStatus(week ? done : Math.round(perWeek * 10) / 10, gmin, gmax)
  const waistDelta = row.waist_last_cm != null && prev?.waist_last_cm != null ? row.waist_last_cm - prev.waist_last_cm : null
  return (
    <div>
      <div className="flex items-center gap-4">
        <Ring value={week ? done : perWeek} target={gmin} color="var(--color-lime)" size={84} stroke={9}
          label={week ? `Treinos: ${done} de ${gmin} (faixa ${gmin} a ${gmax})` : `Treinos: ${done} no mês, ${num(perWeek)} por semana (faixa ${gmin} a ${gmax})`}>
          <span className="text-lg font-bold tabular-nums">{week ? `${done}/${gmin}` : num(perWeek)}</span>
        </Ring>
        <div className="min-w-0">
          <p className="text-[13px] text-muted">{week ? 'Treinos na semana' : 'Treinos no mês'}</p>
          <Big size="md" value={done} unit={week ? `/${gmin} · faixa ${gmin}–${gmax}` : `· ${num(perWeek)}/semana`} />
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm tabular-nums text-muted">
            <span className={st === 'na_faixa' ? 'font-semibold text-ok' : st === 'acima' ? 'font-semibold text-warn' : ''}>
              {week ? weekReading(done, gmin, gmax, current) : st === 'na_faixa' ? 'média na faixa' : st === 'acima' ? 'média acima do máximo' : 'média abaixo do mínimo'}
            </span>
            <span className={`flex items-center gap-1 ${row.n_prs ? 'font-semibold text-lime' : ''}`}><Trophy size={15} aria-hidden="true" />{row.n_prs} {row.n_prs === 1 ? 'PR' : 'PRs'}</span>
            {row.n_sets > 0 && <span>{row.n_sets} séries · {intFmt(row.volume_kg)} kg</span>}
          </p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-line pt-4">
        <Cell label="Peso (média 7d)">
          {row.weight_delta_kg != null ? <Delta value={row.weight_delta_kg} unit="kg" good="down" className="text-xl" />
            : <span className="text-xl font-bold tabular-nums">{row.weight_avg7_end != null ? `${num(row.weight_avg7_end)} kg` : '—'}</span>}
        </Cell>
        <Cell label="Cintura">
          {waistDelta != null ? <Delta value={waistDelta} unit="cm" good="down" className="text-xl" />
            : <span className="text-xl font-bold tabular-nums">{row.waist_last_cm != null ? `${num(row.waist_last_cm)} cm` : '—'}</span>}
        </Cell>
        <Cell label={pn ? `Saldo real · ${pn.days} ${pn.days === 1 ? 'dia' : 'dias'} na conta` : 'Saldo real'} className="col-span-2">
          {pn?.balance != null ? (
            <>
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-xl font-bold tabular-nums">{signedInt(Math.round(pn.balance))} kcal</span>
                <span className={`inline-flex items-center gap-0.5 text-[13px] font-semibold ${pn.balance > 0 ? 'text-warn' : 'text-ok'}`}>
                  {pn.balance > 0 ? <ArrowUpRight size={14} strokeWidth={2.5} aria-hidden="true" /> : pn.balance < 0 ? <ArrowDownRight size={14} strokeWidth={2.5} aria-hidden="true" /> : null}
                  {pn.balance > 0 ? 'superávit' : pn.balance < 0 ? 'déficit' : 'empate'}
                </span>
              </span>
              <span className="mt-0.5 block text-[13px] tabular-nums text-muted">
                meta {signedInt(Math.round(pn.target ?? 0))} ({signedInt(Math.round((pn.target ?? 0) / Math.max(1, pn.days)))}/dia)
                {pn.kcalAvg != null && <> · comida {intFmt(pn.kcalAvg)} kcal/dia</>}
                {pn.incomplete + pn.noFood > 0 && <> · {pn.incomplete + pn.noFood} fora (sem refeição ou incompleto)</>}
              </span>
            </>
          ) : <span className="text-xl font-bold tabular-nums">—</span>}
        </Cell>
        <MacroCell macro="protein" m={pn?.protein ?? null} />
        <MacroCell macro="carb" m={pn?.carb ?? null} />
        <MacroCell macro="fat" m={pn?.fat ?? null} />
      </dl>
    </div>
  )
}

/** Média do macro nos dias na conta, com a zona contra a faixa média desses dias. */
function MacroCell({ macro, m }: { macro: Macro; m: PeriodMacro | null }) {
  return (
    <Cell label={`${MACRO_NAME[macro]} (média)`}>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-xl font-bold tabular-nums">{m ? `${intFmt(m.avg)} g` : '—'}</span>
        {m?.zone && <ZoneWord zone={m.zone} macro={macro} />}
      </span>
      {m?.band ? <MacroZoneBar className="mt-1.5" compact macro={macro} grams={m.avg} band={m.band}
        label={`${MACRO_NAME[macro]}: média ${intFmt(m.avg)} g; ideal ${m.band.ideal} a ${m.band.cap} g`} /> : null}
    </Cell>
  )
}

function Cell({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  )
}

/**
 * Hoje: na segunda o card vira "Sua semana" (semana anterior); no dia 1 vira "Seu mês" (mês anterior).
 * Some depois de visto ("Entendi"). `?resumo=semana|mes` força a exibição (verificação).
 */
export function SummaryCard() {
  const weekly = useWeeklySummary()
  const monthly = useMonthlySummary()
  const [, rerender] = useState(0)
  const today = todaySP()
  const force = new URLSearchParams(location.search).get('resumo')
  const isMonday = weekStart(today) === today
  const isFirst = today.endsWith('-01')

  const mode = force === 'mes' || (!force && isFirst) ? 'mes' : force === 'semana' || isMonday ? 'semana' : null
  if (!mode) return null
  const list = mode === 'mes' ? monthly.data : weekly.data
  if (!list) return null
  const start = mode === 'mes' ? `${addDays(today.slice(0, 8) + '01', -1).slice(0, 8)}01` : addDays(weekStart(today), -7)
  const idx = force ? list.length - 1 : list.findIndex((r) => r.period_start === start)
  const row = list[idx]
  const key = `summary_seen:${mode}:${row?.period_start}`
  if (!row || (!force && localStorage.getItem(key))) return null
  const empty = periodDone(row) === 0 && row.days_logged === 0 && row.weight_avg7_end == null

  return (
    <Card tone="raised" className="ring-1 ring-lime/30" aria-labelledby="sum-title">
      <CardHead id="sum-title" title={mode === 'mes' ? 'Seu mês' : 'Sua semana'}
        sub={mode === 'mes' ? monthLabel(row.period_start) : `${dm(row.period_start)} a ${dm(row.period_end)}`} />
      <div className="mt-4">
        {empty ? <p className="text-[15px] text-muted">Sem registros nesse período.</p> : <SummaryStats row={row} prev={list[idx - 1]} />}
      </div>
      <Button className="mt-5 w-full" onClick={() => { localStorage.setItem(key, '1'); rerender((x) => x + 1) }}>
        <Check size={18} aria-hidden="true" /> Entendi
      </Button>
    </Card>
  )
}
