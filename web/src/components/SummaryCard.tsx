import { useState } from 'react'
import { Check, Trophy } from 'lucide-react'
import { useMonthlySummary, useWeeklySummary } from '../lib/api'
import type { PeriodSummary } from '../lib/types'
import { addDays, dm, intFmt, monthLabel, num, todaySP, weekStart } from '../lib/format'
import { Ring } from './Ring'
import { Big, Delta, Meter } from './viz'
import { Button, Card, CardHead } from './ui'

/** Números de um período (semana ou mês): anel de sessões + grade com barras contra a meta. Hoje e Evolução. */
export function SummaryStats({ row, prev }: { row: PeriodSummary; prev?: PeriodSummary }) {
  const waistDelta = row.waist_last_cm != null && prev?.waist_last_cm != null ? row.waist_last_cm - prev.waist_last_cm : null
  return (
    <div>
      <div className="flex items-center gap-4">
        <Ring value={row.done} target={row.planned || null} color="var(--color-lime)" size={84} stroke={9} label={`Sessões: ${row.done} de ${row.planned}`}>
          <span className="text-lg font-bold tabular-nums">{row.planned ? `${Math.round((row.done / row.planned) * 100)}%` : '—'}</span>
        </Ring>
        <div className="min-w-0">
          <p className="text-[13px] text-muted">Sessões</p>
          <Big size="md" value={row.done} unit={`/${row.planned}`} />
          <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm tabular-nums text-muted">
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
        <Cell label={`Kcal · ${row.days_logged}/${row.days_in_period} dias`}>
          <span className="text-xl font-bold tabular-nums">{row.kcal_avg != null ? intFmt(row.kcal_avg) : '—'}</span>
          {row.kcal_avg != null && row.kcal_target ? <Meter className="mt-1.5" height={6} value={row.kcal_avg} max={row.kcal_target} target={row.kcal_target} color="var(--color-kcal)" label={`Média ${intFmt(row.kcal_avg)} de ${intFmt(row.kcal_target)} kcal`} /> : null}
        </Cell>
        <Cell label="Proteína (média)">
          <span className="text-xl font-bold tabular-nums">{row.protein_avg_g != null ? `${intFmt(row.protein_avg_g)} g` : '—'}</span>
          {row.protein_avg_g != null && row.protein_target_min_g ? <Meter className="mt-1.5" height={6} value={row.protein_avg_g} max={row.protein_target_max_g ?? row.protein_target_min_g} band={[row.protein_target_min_g, row.protein_target_max_g ?? row.protein_target_min_g]} color="var(--color-protein)" label={`Média ${intFmt(row.protein_avg_g)} g; meta ${intFmt(row.protein_target_min_g)} g`} /> : null}
        </Cell>
        <Cell label="Creatina" className="col-span-2">
          <span className="flex items-center gap-3">
            <span className="text-xl font-bold tabular-nums">{row.creatine_days}<span className="text-sm font-medium text-muted">/{row.days_in_period}</span></span>
            <span className="flex flex-1 gap-1" aria-hidden="true">
              {Array.from({ length: Math.min(row.days_in_period, 31) }, (_, i) => <span key={i} className={`h-2 flex-1 rounded-full ${i < row.creatine_days ? 'bg-lime' : 'bg-line'}`} />)}
            </span>
          </span>
        </Cell>
      </dl>
    </div>
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
  const empty = row.done === 0 && row.days_logged === 0 && row.weight_avg7_end == null

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
