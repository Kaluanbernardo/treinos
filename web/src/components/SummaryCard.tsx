import { useState } from 'react'
import { Check, Trophy } from 'lucide-react'
import { useMonthlySummary, useWeeklySummary } from '../lib/api'
import type { PeriodSummary } from '../lib/types'
import { addDays, dm, intFmt, monthLabel, num, signed, todaySP, weekStart } from '../lib/format'
import { Button, Card, CardHead } from './ui'

/** Grade de números de um período (semana ou mês). Usada no Hoje e no bloco Resumo da Evolução. */
export function SummaryStats({ row, prev }: { row: PeriodSummary; prev?: PeriodSummary }) {
  const waistDelta = row.waist_last_cm != null && prev?.waist_last_cm != null ? row.waist_last_cm - prev.waist_last_cm : null
  const logged = `${row.days_logged}/${row.days_in_period} dias`
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
      <Stat label="Sessões" value={<>{row.done}<span className="text-lg text-muted">/{row.planned}</span></>}
        sub={row.planned ? `${Math.round((row.done / row.planned) * 100)}% do planejado` : 'nada planejado'} hero />
      <Stat label="Recordes" value={<span className={row.n_prs ? 'text-lime' : ''}>{row.n_prs}</span>}
        sub={row.n_sets ? `${row.n_sets} séries · ${intFmt(row.volume_kg)} kg` : 'sem séries registradas'}
        icon={row.n_prs ? <Trophy size={18} className="text-lime" aria-hidden="true" /> : undefined} />
      <Stat label="Peso (média 7d)" value={row.weight_delta_kg != null ? `${signed(row.weight_delta_kg)} kg` : row.weight_avg7_end != null ? `${num(row.weight_avg7_end)} kg` : '—'}
        sub={row.weight_delta_kg != null ? `fechou em ${num(row.weight_avg7_end)} kg` : row.weight_avg7_end != null ? 'sem período anterior para comparar' : 'sem pesagem'} />
      <Stat label="Cintura" value={row.waist_last_cm != null ? `${num(row.waist_last_cm)} cm` : '—'}
        sub={waistDelta != null ? `${signed(waistDelta)} cm vs anterior` : row.waist_last_cm != null ? 'primeira medida' : 'sem medida'} />
      <Stat label="Kcal (média)" value={row.kcal_avg != null ? intFmt(row.kcal_avg) : '—'}
        sub={row.days_logged ? `${logged} registrados${row.kcal_target ? ` · meta ${intFmt(row.kcal_target)}` : ''}` : 'nenhum dia registrado'} />
      <Stat label="Proteína (média)" value={row.protein_avg_g != null ? `${intFmt(row.protein_avg_g)} g` : '—'}
        sub={row.days_logged ? `${logged}${row.protein_target_min_g ? ` · meta ${intFmt(row.protein_target_min_g)} g` : ''}` : 'nenhum dia registrado'} />
      <Stat label="Creatina" value={<>{row.creatine_days}<span className="text-lg text-muted">/{row.days_in_period}</span></>} sub="dias com check" />
    </dl>
  )
}

function Stat({ label, value, sub, hero, icon }: { label: string; value: React.ReactNode; sub: string; hero?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd>
        <span className={`flex items-center gap-1.5 font-bold leading-tight tabular-nums ${hero ? 'text-[32px]' : 'text-2xl'}`}>{icon}{value}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-muted">{sub}</span>
      </dd>
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
  const empty = row.done === 0 && row.days_logged === 0 && row.weight_avg7_end == null

  return (
    <Card tone="raised" className="ring-1 ring-lime/30" aria-labelledby="sum-title">
      <CardHead id="sum-title" title={mode === 'mes' ? 'Seu mês' : 'Sua semana'}
        sub={mode === 'mes' ? monthLabel(row.period_start) : `${dm(row.period_start)} a ${dm(row.period_end)}`} />
      <div className="mt-4">
        {empty ? <p className="text-[15px] text-muted">Ainda sem registros nesse período. O próximo resumo já vai ter números.</p> : <SummaryStats row={row} prev={list[idx - 1]} />}
      </div>
      <Button className="mt-5 w-full" onClick={() => { localStorage.setItem(key, '1'); rerender((x) => x + 1) }}>
        <Check size={18} aria-hidden="true" /> Entendi
      </Button>
    </Card>
  )
}
