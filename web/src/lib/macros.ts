import type { DailyNutrition, DayState, DayTarget, EnergyDay, MacroZoneName, ProteinTarget } from './types'
import { type ProteinBand, proteinZone } from './protein'

/**
 * Carboidrato e gordura por zonas, no mesmo espírito da proteína (regra e fontes em docs/macros.md). A conta é a
 * mesma de v_day_targets (migração 20261111200000); aqui ficam as funções puras (testadas em scripts/test-macros.ts):
 *
 *   gordura = % da PERMISSÃO do dia (pode consumir = gasto + saldo-alvo):
 *             abaixo < 15 % ≤ mínimo ok < 20 % ≤ ideal ≤ 35 % < acima
 *             (ACSM/AND/DC 2016 e IOM: 20–35 % da energia; Helms 2014: até 15 % só em fase curta de corte)
 *   carbo   = abaixo < 130 g (RDA do IOM) ≤ mínimo ok < ideal ≤ … ≤ acima; a faixa ideal é o espaço que sobra na
 *             permissão depois das faixas de proteína e gordura (Helms 2014; Iraki 2019: "o resto das kcal"):
 *               início = (permissão × 65 % − 4 × teto útil da proteína) / 4
 *               fim    = (permissão × 80 % − 4 × ideal da proteína) / 4
 *             nunca abaixo de 130 g. Treinar aumenta a permissão e, com ela, o espaço do carbo (ACSM: 3–5 g/kg em
 *             treino leve, mais com mais volume).
 */

export type Macro = 'protein' | 'carb' | 'fat'
/** Mesma forma da faixa de proteína: abaixo < min ≤ ok < ideal ≤ ideal ≤ cap < acima. */
export type ZoneBand = ProteinBand

export const MACRO_DEFAULTS = { fatFloorPct: 15, fatMinPct: 20, fatMaxPct: 35, carbFloorG: 130 } as const
export type MacroParams = { fatFloorPct: number; fatMinPct: number; fatMaxPct: number; carbFloorG: number }

/** Gordura em gramas a partir da permissão do dia (kcal), ou null sem permissão. */
export function fatBand(allowance: number | null | undefined, p: MacroParams = MACRO_DEFAULTS): ZoneBand | null {
  if (allowance == null) return null
  const g = (pct: number) => Math.round((allowance * pct) / 900)
  return { min: g(p.fatFloorPct), ideal: g(p.fatMinPct), cap: g(p.fatMaxPct) }
}

/** Carbo em gramas: mínimo fixo (130 g) e a faixa ideal pelo espaço da permissão. Sem permissão ou proteína: null. */
export function carbBand(allowance: number | null | undefined, protein: ProteinBand | null, p: MacroParams = MACRO_DEFAULTS): ZoneBand | null {
  if (allowance == null || !protein) return null
  // numerador inteiro / 400: o arredondamento bate com o round() do Postgres (sem erro de ponto flutuante)
  const lo = Math.round((allowance * (100 - p.fatMaxPct) - 400 * protein.cap) / 400)
  const hi = Math.round((allowance * (100 - p.fatMinPct) - 400 * protein.ideal) / 400)
  const ideal = Math.max(p.carbFloorG, lo)
  return { min: p.carbFloorG, ideal, cap: Math.max(ideal, hi) }
}

export const macroZone = (grams: number, band: ZoneBand): MacroZoneName => proteinZone(grams, band)

export const MACRO_NAME: Record<Macro, string> = { protein: 'Proteína', carb: 'Carbo', fat: 'Gordura' }

/** Rótulos das zonas. Proteína acima do teto não faz mal (só não traz ganho); carbo e gordura acima ocupam a permissão. */
export const ZONE_LABEL: Record<Macro, Record<MacroZoneName, string>> = {
  protein: { abaixo: 'abaixo do mínimo', ok: 'mínimo ok', ideal: 'ideal', acima: 'acima do teto útil' },
  carb: { abaixo: 'abaixo do mínimo', ok: 'mínimo ok', ideal: 'ideal', acima: 'acima da faixa' },
  fat: { abaixo: 'abaixo do mínimo', ok: 'mínimo ok', ideal: 'ideal', acima: 'acima da faixa' },
}

/** Dia em andamento abaixo do mínimo é "até agora", não veredito. */
export const macroZoneLabel = (m: Macro, z: MacroZoneName, inProgress = false) =>
  z === 'abaixo' && inProgress ? `${ZONE_LABEL[m].abaixo} até agora` : ZONE_LABEL[m][z]

/** Faixas em gramas de uma linha de v_day_targets. */
export function bandsOf(r: Pick<DayTarget, 'protein_min_g' | 'protein_ideal_g' | 'protein_cap_g' | 'fat_floor_g' | 'fat_min_g' | 'fat_max_g' | 'carb_floor_g' | 'carb_min_g' | 'carb_max_g'> | null | undefined) {
  const band = (a: number | null | undefined, b: number | null | undefined, c: number | null | undefined): ZoneBand | null =>
    a == null || b == null || c == null ? null : { min: Number(a), ideal: Number(b), cap: Number(c) }
  return {
    protein: band(r?.protein_min_g, r?.protein_ideal_g, r?.protein_cap_g),
    carb: band(r?.carb_floor_g, r?.carb_min_g, r?.carb_max_g),
    fat: band(r?.fat_floor_g, r?.fat_min_g, r?.fat_max_g),
  }
}

// ---------------------------------------------------------------- espelho de v_day_targets
/** Mesma ordem de v_day_targets: hoje > incompleto > sem refeição > sem basal > na conta. */
export function dayStateOf(date: string, today: string, r: { diary_incomplete?: boolean; food_logged: boolean; balance_kcal: number | null }): DayState {
  if (date === today) return 'hoje'
  if (r.diary_incomplete) return 'incompleto'
  if (!r.food_logged) return 'sem_refeicao'
  if (r.balance_kcal == null) return 'sem_basal'
  return 'na_conta'
}

const r1 = (n: number) => Math.round(n * 10) / 10

/**
 * Mesma conta de v_day_targets, para o app funcionar enquanto a view ainda não existe no banco: junta
 * v_energy_daily, v_daily_nutrition, daily_checks.diary_incomplete e v_protein_target.
 */
export function dayTargetsFrom(input: {
  energy: EnergyDay[]; nutrition: Pick<DailyNutrition, 'date' | 'protein_g' | 'carb_g' | 'fat_g'>[]; incomplete: Set<string>
  protein: Pick<ProteinTarget, 'ref_weight_kg' | 'min_g' | 'ideal_g' | 'cap_g'> | null; kcalTarget: number | null
  params?: MacroParams; today: string
}): DayTarget[] {
  const params = input.params ?? MACRO_DEFAULTS
  const nut = new Map(input.nutrition.map((n) => [n.date, n]))
  const pb: ProteinBand | null = input.protein?.min_g != null && input.protein.ideal_g != null && input.protein.cap_g != null
    ? { min: Number(input.protein.min_g), ideal: Number(input.protein.ideal_g), cap: Number(input.protein.cap_g) } : null
  return input.energy.map((e) => {
    const out = e.out_kcal != null ? Number(e.out_kcal) : null
    const target = e.target_balance_kcal != null ? Number(e.target_balance_kcal) : null
    const allowance = out != null ? out + (target ?? 0) : input.kcalTarget
    const food = Number(e.food_kcal)
    const n = nut.get(e.date)
    const g = { p: r1(Number(n?.protein_g ?? 0)), c: r1(Number(n?.carb_g ?? 0)), f: r1(Number(n?.fat_g ?? 0)) }
    const incomplete = input.incomplete.has(e.date)
    const fat = fatBand(allowance, params)
    const carb = carbBand(allowance, pb, params)
    const zones = e.food_logged && !incomplete
    return {
      date: e.date, day_state: dayStateOf(e.date, input.today, { diary_incomplete: incomplete, food_logged: e.food_logged, balance_kcal: e.balance_kcal }),
      diary_incomplete: incomplete, target_balance_kcal: target,
      bmr_kcal: e.bmr_kcal, daily_life_kcal: e.daily_life_kcal, exercise_kcal: Number(e.exercise_kcal), is_estimate: e.is_estimate, out_kcal: out,
      allowance_kcal: allowance, allowance_basis: out != null ? 'gasto' : input.kcalTarget != null ? 'fixa' : null,
      food_logged: e.food_logged, food_kcal: food, food_has_estimated: e.food_has_estimated,
      remaining_kcal: allowance != null ? allowance - food : null,
      balance_kcal: e.balance_kcal != null ? Number(e.balance_kcal) : null,
      balance_vs_target_kcal: e.food_logged && out != null && allowance != null ? food - allowance : null,
      protein_g: g.p, carb_g: g.c, fat_g: g.f,
      ref_weight_kg: input.protein?.ref_weight_kg ?? null,
      protein_min_g: pb?.min ?? null, protein_ideal_g: pb?.ideal ?? null, protein_cap_g: pb?.cap ?? null,
      fat_floor_g: fat?.min ?? null, fat_min_g: fat?.ideal ?? null, fat_max_g: fat?.cap ?? null,
      carb_floor_g: params.carbFloorG, carb_min_g: carb?.ideal ?? null, carb_max_g: carb?.cap ?? null,
      protein_zone: zones && pb ? macroZone(g.p, pb) : null,
      fat_zone: zones && fat ? macroZone(g.f, fat) : null,
      carb_zone: zones && carb ? macroZone(g.c, carb) : null,
    }
  })
}

// ---------------------------------------------------------------- período (resumos)
export interface PeriodMacro { avg: number; band: ZoneBand | null; zone: MacroZoneName | null }
export interface PeriodNutrition {
  /** dias na conta (fechados, com refeição e basal, diário completo) */
  days: number
  /** saldo real somado (comida − gasto) e a meta somada (saldo-alvo × dias) nos mesmos dias */
  balance: number | null
  target: number | null
  kcalAvg: number | null
  protein: PeriodMacro | null
  carb: PeriodMacro | null
  fat: PeriodMacro | null
  /** dias fora da conta por motivo (sem "hoje"/futuro, que não são falha do diário) */
  incomplete: number
  noFood: number
}

/**
 * Médias do período sobre os mesmos dias do saldo (só `na_conta`): grama médio de cada macro contra a média das
 * faixas desses dias (a faixa de carbo e gordura muda com a permissão de cada dia).
 */
export function periodNutrition(rows: DayTarget[], from: string, to: string): PeriodNutrition {
  const inP = rows.filter((r) => r.date >= from && r.date <= to)
  const on = inP.filter((r) => r.day_state === 'na_conta')
  const avg = (f: (r: DayTarget) => number | null | undefined) => {
    const v = on.map(f).filter((x): x is number => x != null).map(Number)
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null
  }
  const macro = (g: (r: DayTarget) => number, a: (r: DayTarget) => number | null, b: (r: DayTarget) => number | null, c: (r: DayTarget) => number | null): PeriodMacro | null => {
    const m = avg(g)
    if (m == null) return null
    const lo = avg(a); const mid = avg(b); const hi = avg(c)
    const band = lo != null && mid != null && hi != null ? { min: Math.round(lo), ideal: Math.round(mid), cap: Math.round(hi) } : null
    return { avg: m, band, zone: band ? macroZone(m, band) : null }
  }
  const sum = (f: (r: DayTarget) => number | null) => (on.length ? on.reduce((s, r) => s + Number(f(r) ?? 0), 0) : null)
  return {
    days: on.length,
    balance: sum((r) => r.balance_kcal),
    target: sum((r) => r.target_balance_kcal),
    kcalAvg: avg((r) => r.food_kcal),
    protein: macro((r) => Number(r.protein_g), (r) => r.protein_min_g, (r) => r.protein_ideal_g, (r) => r.protein_cap_g),
    carb: macro((r) => Number(r.carb_g), (r) => r.carb_floor_g, (r) => r.carb_min_g, (r) => r.carb_max_g),
    fat: macro((r) => Number(r.fat_g), (r) => r.fat_floor_g, (r) => r.fat_min_g, (r) => r.fat_max_g),
    incomplete: inP.filter((r) => r.day_state === 'incompleto').length,
    noFood: inP.filter((r) => r.day_state === 'sem_refeicao').length,
  }
}
