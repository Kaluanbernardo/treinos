import { useEnergyDaily, useNutritionTargets, usePlan } from './api'
import { addDays, todaySP } from './format'
import type { EnergyDay, Modality, PlanItem } from './types'

/** Regras em docs/calorias.md ("Meta de kcal de hoje"). Contas puras aqui; o hook só junta as queries. */

/** O ideal do dia vem do gasto real (basal + rotina + exercício) mais a meta de saldo (−déficit). */
export const hasDynamicIdeal = (row: EnergyDay | undefined | null) =>
  row?.out_kcal != null && row.target_balance_kcal != null

/**
 * Kcal ideal de um dia já vivido (docs/calorias.md):
 *   out_kcal + target_balance_kcal  (gasto − déficit), quando a view tem os dois
 *   senão `fallback` (goals.kcal_target fixo), senão null.
 */
export function idealKcal(row: EnergyDay | undefined | null, fallback: number | null): number | null {
  if (hasDynamicIdeal(row)) return Math.round(Number(row!.out_kcal) + Number(row!.target_balance_kcal))
  return fallback ?? null
}

/** % consumido do ideal (arredondado), ou null sem ideal. */
export const pctOf = (value: number, ideal: number | null) => (ideal && ideal > 0 ? Math.round((value / ideal) * 100) : null)

// ---------------------------------------------------------------- treino planejado
/** Espelho de public.modality_met() (Compendium of Physical Activities). */
const MET: Record<Modality, number> = { musculacao: 5, muay_thai: 10, jiu_jitsu: 8, cross: 8, funcional: 6 }

/** Sessão com registro: já entrou (feito/parcial) ou não vai entrar (faltou) no exercício do dia. */
const SETTLED = new Set(['feito', 'parcial', 'faltou'])

/** Itens de hoje ainda por fazer (inclui a sessão em andamento, que só conta no gasto ao terminar). */
export const remainingPlan = (plan: PlanItem[]) => plan.filter((i) => i.active && !SETTLED.has(i.session_status ?? ''))

/** Mesma estimativa de v_energy_daily: (MET − 1) × kg × horas, duração da grade/ficha, senão 60 min, teto 180. */
export function estimateSessionKcal(item: Pick<PlanItem, 'modality' | 'duration_min' | 'est_minutes'>, weightKg: number) {
  const minutes = Math.min(180, item.duration_min || item.est_minutes || 60)
  return Math.round((MET[item.modality] - 1) * weightKg * minutes / 60)
}

/** Sem peso para o MET: média de kcal de exercício nos dias com treino dos últimos 14 dias (antes de hoje). */
export function meanSessionKcal(rows: EnergyDay[], today: string) {
  const from = addDays(today, -14)
  const days = rows.filter((r) => r.date >= from && r.date < today && Number(r.exercise_kcal) > 0)
  return days.length ? Math.round(days.reduce((s, r) => s + Number(r.exercise_kcal), 0) / days.length) : 0
}

// ---------------------------------------------------------------- ajuste dos últimos 7 dias
export const ADJUST_CAP = 300

/**
 * Desvio da meta nos 7 dias fechados antes de hoje (só dias com comida e saldo):
 *   Σ (balance_kcal − target_balance_kcal), espalhado nos próximos 7 dias com sinal trocado, teto ±300.
 * Comeu 700 acima da meta na semana → −100/dia.
 */
export function carryOverAdjust(rows: EnergyDay[], today: string) {
  const from = addDays(today, -7)
  const days = rows.filter((r) => r.date >= from && r.date < today && r.food_logged && r.balance_kcal != null && r.target_balance_kcal != null)
  const deviation = days.reduce((s, r) => s + Number(r.balance_kcal) - Number(r.target_balance_kcal), 0)
  const adjust = Math.round(Math.max(-ADJUST_CAP, Math.min(ADJUST_CAP, -deviation / 7)))
  return { adjust: adjust || 0, deviation: Math.round(deviation), days: days.length }
}

// ---------------------------------------------------------------- metas de hoje
export interface KcalTargets {
  /** Meta se fizer o treino que falta hoje (= noWorkout sem plano pendente). */
  withWorkout: number | null
  /** Meta só com o exercício já registrado hoje. */
  noWorkout: number | null
  /** Ajuste dos 7 dias anteriores (kcal/dia, ±300). 0 sem basal. */
  adjust: number
  /** Kcal estimadas do treino que ainda falta hoje. */
  plannedKcal: number
  /** Há treino planejado e ainda não registrado hoje. */
  hasPlan: boolean
  /** true = metas a partir do gasto (basal); false = meta fixa goals.kcal_target. */
  dynamic: boolean
  /** Dias usados no ajuste (0–7). */
  adjustDays: number
}

/**
 * base = bmr + rotina; noWorkout = base + exercício registrado − déficit + ajuste; withWorkout = noWorkout + planejado.
 * Sem basal cai em goals.kcal_target, que já é "gasto − déficit": não desconta o déficit de novo nem soma treino.
 */
export function kcalTargets({ rows, plan, today, fallback }: {
  rows: EnergyDay[]; plan: PlanItem[]; today: string; fallback: number | null
}): KcalTargets {
  const row = rows.find((r) => r.date === today)
  const pending = remainingPlan(plan.filter((i) => i.date === today))
  const weight = row?.weight_kg != null ? Number(row.weight_kg) : null
  const perSession = weight == null ? meanSessionKcal(rows, today) : 0
  const plannedKcal = pending.reduce((s, i) => s + (weight != null ? estimateSessionKcal(i, weight) : perSession), 0)
  const hasPlan = pending.length > 0

  if (row?.bmr_kcal == null || row.daily_life_kcal == null || row.target_balance_kcal == null) {
    return { withWorkout: fallback, noWorkout: fallback, adjust: 0, plannedKcal, hasPlan, dynamic: false, adjustDays: 0 }
  }
  const { adjust, days } = carryOverAdjust(rows, today)
  const base = Number(row.bmr_kcal) + Number(row.daily_life_kcal)
  const deficit = -Number(row.target_balance_kcal)
  const noWorkout = Math.round(base + Number(row.exercise_kcal) - deficit + adjust)
  return { withWorkout: noWorkout + plannedKcal, noWorkout, adjust, plannedKcal, hasPlan, dynamic: true, adjustDays: days }
}

/** Metas de kcal de hoje. Mesma janela de 60 dias da aba Calorias (um cache só). */
export function useKcalTargets() {
  const today = todaySP()
  const energy = useEnergyDaily(60)
  const plan = usePlan(today, today)
  const targets = useNutritionTargets()
  const isPending = energy.isPending || plan.isPending || targets.isPending
  const data = isPending ? null : kcalTargets({
    rows: energy.data ?? [], plan: plan.data ?? [], today, fallback: targets.data?.kcal_target ?? null,
  })
  return { data, isPending, isError: energy.isError || plan.isError || targets.isError }
}

/** Meta principal do dia: com treino se ainda há treino pendente, senão sem treino. */
export const mainTarget = (k: KcalTargets | null) => (k ? (k.hasPlan ? k.withWorkout : k.noWorkout) : null)

/** "+120" / "−80" / "±0" */
export const signedKcal = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toLocaleString('pt-BR')}`
