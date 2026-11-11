import { useEnergyDaily, useNutritionTargets, usePlan } from './api'
import { addDays, todaySP } from './format'
import type { EnergyDay, Modality, PlanItem } from './types'

/**
 * Meta calórica (docs/calorias.md, "Meta fixa e permissão"). Contas puras aqui; o hook só junta as queries.
 *
 *   meta do dia      = saldo-alvo FIXO (v_energy_daily.target_balance_kcal = −goals.deficit_kcal; hoje −300),
 *                      treine ou não
 *   pode consumir    = basal + rotina + exercício já feito + saldo-alvo   (= gasto − 300)
 *   ainda resta      = pode consumir − comida
 *
 * O treino aumenta a PERMISSÃO (o exercício entra no gasto), não a meta. Treino de hoje ainda por fazer não entra
 * na conta: aparece só como aviso de quanto a permissão deve subir quando for registrado.
 */

/** Permissão de um dia: gasto do dia + saldo-alvo; sem basal, `fallback` (goals.kcal_target fixo), senão null. */
export function allowanceOf(row: Pick<EnergyDay, 'out_kcal' | 'target_balance_kcal'> | undefined | null, fallback: number | null): number | null {
  if (row?.out_kcal != null) return Math.round(Number(row.out_kcal) + Number(row.target_balance_kcal ?? 0))
  return fallback ?? null
}

/** A permissão vem do gasto real (só existe com basal). */
export const hasDynamicAllowance = (row: Pick<EnergyDay, 'out_kcal'> | undefined | null) => row?.out_kcal != null

/** % consumido da permissão (arredondado), ou null sem permissão. */
export const pctOf = (value: number, of: number | null) => (of && of > 0 ? Math.round((value / of) * 100) : null)

// ---------------------------------------------------------------- treino planejado (só o aviso)
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

// ---------------------------------------------------------------- hoje
export interface DayAllowance {
  /** true = permissão a partir do gasto (basal); false = meta fixa goals.kcal_target */
  dynamic: boolean
  /** saldo-alvo do dia (−300 = déficit de 300); null sem dados do dia */
  targetBalance: number | null
  bmr: number | null
  life: number | null
  /** exercício já registrado hoje: é o que o treino somou na permissão */
  exercise: number
  exerciseEstimated: boolean
  /** pode consumir hoje */
  allowance: number | null
  /** treinos de hoje ainda por fazer e quanto devem somar na permissão quando feitos (estimativa) */
  pendingCount: number
  pendingKcal: number
  pendingTitles: string[]
}

/** Permissão de hoje. Sem basal cai em goals.kcal_target (meta fixa, sem exercício somado). */
export function dayAllowance({ rows, plan, today, fallback }: {
  rows: EnergyDay[]; plan: PlanItem[]; today: string; fallback: number | null
}): DayAllowance {
  const row = rows.find((r) => r.date === today)
  const pending = remainingPlan(plan.filter((i) => i.date === today))
  const weight = row?.weight_kg != null ? Number(row.weight_kg) : null
  const perSession = weight == null ? meanSessionKcal(rows, today) : 0
  const pendingKcal = pending.reduce((s, i) => s + (weight != null ? estimateSessionKcal(i, weight) : perSession), 0)
  const targetBalance = row?.target_balance_kcal != null ? Number(row.target_balance_kcal) : null
  const base = { targetBalance, pendingCount: pending.length, pendingKcal, pendingTitles: pending.map((i) => i.title), exercise: Number(row?.exercise_kcal ?? 0), exerciseEstimated: !!row?.is_estimate }
  if (row?.bmr_kcal == null || row.daily_life_kcal == null) {
    return { ...base, dynamic: false, bmr: null, life: null, allowance: fallback }
  }
  return { ...base, dynamic: true, bmr: Number(row.bmr_kcal), life: Number(row.daily_life_kcal), allowance: allowanceOf(row, fallback) }
}

/** Quanto ainda resta da permissão (negativo = passou), ou null sem permissão. */
export const remainingKcal = (a: Pick<DayAllowance, 'allowance'> | null, food: number) => (a?.allowance == null ? null : Math.round(a.allowance - food))

/** Permissão de hoje. Mesma janela de 60 dias da aba Calorias (um cache só). */
export function useDayAllowance() {
  const today = todaySP()
  const energy = useEnergyDaily(60)
  const plan = usePlan(today, today)
  const targets = useNutritionTargets()
  const isPending = energy.isPending || plan.isPending || targets.isPending
  const data = isPending ? null : dayAllowance({
    rows: energy.data ?? [], plan: plan.data ?? [], today, fallback: targets.data?.kcal_target ?? null,
  })
  return { data, isPending, isError: energy.isError || plan.isError || targets.isError }
}
