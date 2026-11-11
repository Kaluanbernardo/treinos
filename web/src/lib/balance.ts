import { addDays, intFmt, weekStart } from './format'
import type { EnergyDay } from './types'

/** Linha mínima para o saldo: v_energy_daily, ou v_day_targets (que traz o diário incompleto). */
export type BalanceRow = Pick<EnergyDay, 'date' | 'balance_kcal' | 'food_kcal' | 'out_kcal' | 'is_estimate' | 'food_has_estimated' | 'food_logged'>
  & { target_balance_kcal?: number | null; diary_incomplete?: boolean }

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
 * incomplete: diário marcado incompleto no chat (daily_checks.diary_incomplete; `fit diario incompleto`).
 * no_food: dia fechado sem refeição (ou sem linha na view). no_bmr: refeição, mas sem basal. future: ainda não chegou.
 * Só `counted` entra nas somas; os outros ficam fora e nomeados na tela.
 */
export type BalanceDayState = 'counted' | 'today' | 'incomplete' | 'no_food' | 'no_bmr' | 'future'

export interface BalanceDay<R extends BalanceRow = BalanceRow> { date: string; row: R | null; state: BalanceDayState }

export interface BalanceSummary<R extends BalanceRow = BalanceRow> {
  days: BalanceDay<R>[]
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
  /** diário marcado incompleto (fora da conta) */
  incomplete: string[]
  future: number
  hasToday: boolean
  /** Saldo parcial de hoje (fora da conta), quando já há refeição. */
  todayBalance: number | null
  /** Hoje já tem refeição, mas falta o basal para o saldo. */
  todayNoBmr: boolean
}

function dayState(date: string, row: BalanceRow | null, today: string): BalanceDayState {
  if (date > today) return 'future'
  if (date === today) return 'today'
  if (row?.diary_incomplete) return 'incomplete'
  if (row?.balance_kcal != null) return 'counted'
  return row?.food_logged ? 'no_bmr' : 'no_food'
}

/** Dia sem refeição nunca vira zero nem déficit: fica fora da conta e aparece nomeado na tela. */
export function summarizeBalance<R extends BalanceRow>(rows: R[], range: Pick<PeriodRange, 'from' | 'to'>, today: string): BalanceSummary<R> {
  const by = new Map(rows.map((r) => [r.date, r]))
  const days: BalanceDay<R>[] = []
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) {
    const row = by.get(d) ?? null
    days.push({ date: d, row, state: dayState(d, row, today) })
  }
  const on = days.filter((d) => d.state === 'counted').map((d) => d.row!)
  const sum = (f: (r: R) => number | null) => on.reduce((s, r) => s + Number(f(r) ?? 0), 0)
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
    incomplete: dated('incomplete'),
    future: dated('future').length,
    hasToday: !!todayDay,
    todayBalance: todayDay?.row?.balance_kcal != null ? Number(todayDay.row.balance_kcal) : null,
    todayNoBmr: !!todayDay?.row?.food_logged && todayDay.row.balance_kcal == null,
  }
}

// ---------------------------------------------------------------- saldo acumulado (gráfico do calendário)
/** Semana (seg–dom) e mês do calendário com setas; 90 dias e Tudo terminam hoje. */
export type CumulativeKind = BalanceKind | '90d' | 'tudo'

export function cumulativeRange(kind: CumulativeKind, today: string, offset = 0, firstDate: string | null = null): { from: string; to: string } {
  if (kind === 'semana' || kind === 'mes') return periodRange(kind, today, offset)
  if (kind === '90d') return { from: addDays(today, -89), to: today }
  return { from: firstDate && firstDate < today ? firstDate : today, to: today }
}

/**
 * Corta o começo do período no 1º dia com dados: v_energy_daily começa no primeiro registro, então dias antes dele
 * não são "sem refeição", são "antes do registro" (não entram no gráfico nem na lista de fora da conta).
 */
export function clipToData<T extends { from: string; to: string }>(range: T, rows: { date: string }[]): T & { clipped: boolean } {
  const first = rows.reduce<string | null>((m, r) => (m == null || r.date < m ? r.date : m), null)
  if (first == null || first <= range.from) return { ...range, clipped: false }
  return { ...range, from: first > range.to ? range.to : first, clipped: true }
}

export interface CumulativePoint {
  date: string
  state: BalanceDayState
  /** saldo real do dia (comida − gasto), só nos dias na conta */
  day: number | null
  /** saldo real acumulado até o dia; fica parado nos dias fora da conta; null em hoje e no futuro */
  total: number | null
  /** meta acumulada até o dia: saldo-alvo (−300) × dias na conta; mesmos dias do total */
  target: number | null
  food: number | null
  out: number | null
}

export interface CumulativeSummary<R extends BalanceRow = BalanceRow> {
  points: CumulativePoint[]
  /** acumulado real no fim do período (null sem nenhum dia na conta) */
  total: number | null
  /** meta acumulada nos mesmos dias (null sem nenhum dia na conta) */
  target: number | null
  /** total − meta: > 0 = acima da linha da meta (menos déficit que o planejado) */
  vsTarget: number | null
  counted: number
  deficitDays: number
  surplusDays: number
  /** extremos do acumulado e da meta (escala do gráfico) */
  lo: number
  hi: number
  summary: BalanceSummary<R>
}

/**
 * Saldo real acumulado (comida − gasto; zero = manutenção) e a linha da meta (saldo-alvo × N) dia a dia.
 * Dias fora da conta (hoje, diário incompleto, sem refeição, sem basal) não somam em NENHUMA das duas linhas:
 * o acumulado e a meta ficam parados neles. O dia de hoje e os futuros não têm ponto.
 */
export function cumulativeBalance<R extends BalanceRow>(rows: R[], range: { from: string; to: string }, today: string): CumulativeSummary<R> {
  const summary = summarizeBalance(rows, range, today)
  let total = 0
  let target = 0
  let lo = 0
  let hi = 0
  let deficitDays = 0
  let surplusDays = 0
  const points = summary.days.map((d): CumulativePoint => {
    const r = d.row
    const food = r?.food_logged ? Number(r.food_kcal) : null
    const out = r?.out_kcal != null ? Number(r.out_kcal) : null
    if (d.state === 'future' || d.state === 'today') return { date: d.date, state: d.state, day: null, total: null, target: null, food, out }
    let day: number | null = null
    if (d.state === 'counted') {
      day = Number(r!.balance_kcal)
      total += day
      target += Number(r!.target_balance_kcal ?? 0)
      if (day < 0) deficitDays++
      else if (day > 0) surplusDays++
    }
    lo = Math.min(lo, total, target)
    hi = Math.max(hi, total, target)
    return { date: d.date, state: d.state, day, total, target, food, out }
  })
  const counted = summary.counted
  return {
    points, counted, deficitDays, surplusDays, lo, hi, summary,
    total: counted ? total : null,
    target: counted ? target : null,
    vsTarget: counted ? total - target : null,
  }
}
