import { addDays, intFmt, weekStart } from './format'
import type { EnergyDay } from './types'

/** Saldo da semana e do mês a partir de v_energy_daily (regra em docs/calorias.md). Contas puras. */

/** Saldo diário abaixo disto vira "déficit alto" (dia fechado; no período, a média por dia). */
export const HIGH_DEFICIT_KCAL = -600
export const KCAL_PER_KG_FAT = 7700

export const signedInt = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${intFmt(Math.abs(v))}`

export type BalanceKind = 'semana' | 'mes'

export interface PeriodRange { kind: BalanceKind; from: string; to: string }

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/**
 * Semana de segunda a domingo (a mesma do resto do app) ou mês do calendário, a partir de hoje em São Paulo.
 * `offset`: 0 = atual, −1 = anterior, e assim por diante.
 */
export function periodRange(kind: BalanceKind, today: string, offset = 0): PeriodRange {
  if (kind === 'semana') {
    const from = addDays(weekStart(today), 7 * offset)
    return { kind, from, to: addDays(from, 6) }
  }
  const y = Number(today.slice(0, 4))
  const m = Number(today.slice(5, 7)) - 1 + offset
  return { kind, from: isoDay(Date.UTC(y, m, 1)), to: isoDay(Date.UTC(y, m + 1, 0)) }
}

/**
 * counted: dia fechado com saldo. today: em andamento (basal do dia inteiro, comida até agora).
 * no_food: dia fechado sem refeição (ou sem linha na view). no_bmr: refeição, mas sem basal. future: ainda não chegou.
 */
export type BalanceDayState = 'counted' | 'today' | 'no_food' | 'no_bmr' | 'future'

export interface BalanceDay { date: string; row: EnergyDay | null; state: BalanceDayState }

export interface BalanceSummary {
  days: BalanceDay[]
  /** Dias na conta do saldo (só dias fechados com saldo). */
  counted: number
  /** Soma dos balance_kcal na conta; null sem nenhum dia. */
  balance: number | null
  /** Comida e gasto dos mesmos dias do saldo. */
  food: number
  out: number
  avg: number | null
  /** Algum dia na conta tem exercício ou comida estimados. */
  estimated: boolean
  noFood: string[]
  noBmr: string[]
  future: number
  hasToday: boolean
  /** Saldo parcial de hoje (fora da conta), quando já há refeição. */
  todayBalance: number | null
  /** Hoje já tem refeição, mas falta o basal para o saldo. */
  todayNoBmr: boolean
}

function dayState(date: string, row: EnergyDay | null, today: string): BalanceDayState {
  if (date > today) return 'future'
  if (date === today) return 'today'
  if (row?.balance_kcal != null) return 'counted'
  return row?.food_logged ? 'no_bmr' : 'no_food'
}

/** Dia sem refeição nunca vira zero nem déficit: fica fora da conta e aparece nomeado na tela. */
export function summarizeBalance(rows: EnergyDay[], range: PeriodRange, today: string): BalanceSummary {
  const by = new Map(rows.map((r) => [r.date, r]))
  const days: BalanceDay[] = []
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) {
    const row = by.get(d) ?? null
    days.push({ date: d, row, state: dayState(d, row, today) })
  }
  const on = days.filter((d) => d.state === 'counted').map((d) => d.row!)
  const sum = (f: (r: EnergyDay) => number | null) => on.reduce((s, r) => s + Number(f(r) ?? 0), 0)
  const balance = on.length ? sum((r) => r.balance_kcal) : null
  const dated = (state: BalanceDayState) => days.filter((d) => d.state === state).map((d) => d.date)
  const todayDay = days.find((d) => d.state === 'today')
  return {
    days,
    counted: on.length,
    balance,
    food: sum((r) => r.food_kcal),
    out: sum((r) => r.out_kcal),
    avg: balance != null ? balance / on.length : null,
    estimated: on.some((r) => r.is_estimate || r.food_has_estimated),
    noFood: dated('no_food'),
    noBmr: dated('no_bmr'),
    future: dated('future').length,
    hasToday: !!todayDay,
    todayBalance: todayDay?.row?.balance_kcal != null ? Number(todayDay.row.balance_kcal) : null,
    todayNoBmr: !!todayDay?.row?.food_logged && todayDay.row.balance_kcal == null,
  }
}
