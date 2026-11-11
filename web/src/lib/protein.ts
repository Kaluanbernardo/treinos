import type { ProteinTarget } from './types'

/**
 * Faixa de proteína (regra e fontes em docs/proteina.md). Os gramas vêm de v_protein_target:
 *   referência = última pesagem, limitada ao peso do IMC 30 (Weijs 2025, Curr Opin Clin Nutr Metab Care)
 *   mínimo efetivo 1,3 g/kg  · meio da faixa 1,2–1,4 (Jäger et al. 2017, ISSN; meta-análise em sobrepeso,
 *                              Clin Nutr ESPEN 2024: > 1,3 g/kg associado a ganho de massa muscular)
 *   ideal          1,6 g/kg  · platô do ganho de massa magra com musculação (Morton et al. 2018, BJSM)
 *   teto útil      2,2 g/kg  · limite superior do IC 95 % desse platô (Morton et al. 2018)
 * Acima do teto não faz mal: só deixa de trazer ganho extra (e ocupa kcal de carbo e gordura).
 */

export type ProteinZone = 'abaixo' | 'ok' | 'ideal' | 'acima'

export interface ProteinBand { min: number; ideal: number; cap: number }

/** Faixa em gramas, ou null sem peso (nunca inventa um alvo). */
export function bandOf(t: Pick<ProteinTarget, 'min_g' | 'ideal_g' | 'cap_g'> | null | undefined): ProteinBand | null {
  if (!t || t.min_g == null || t.ideal_g == null || t.cap_g == null) return null
  return { min: Number(t.min_g), ideal: Number(t.ideal_g), cap: Number(t.cap_g) }
}

/** abaixo < min ≤ ok < ideal ≤ ideal ≤ cap < acima */
export function proteinZone(grams: number, b: ProteinBand): ProteinZone {
  if (grams < b.min) return 'abaixo'
  if (grams < b.ideal) return 'ok'
  if (grams <= b.cap) return 'ideal'
  return 'acima'
}

/** Rótulo, tom (token de cor) e frase curta de cada zona. A cor nunca vai sozinha: sempre com a palavra. */
export const ZONE: Record<ProteinZone, { label: string; tone: 'warn' | 'protein' | 'ok'; short: string }> = {
  abaixo: { label: 'abaixo do mínimo', tone: 'warn', short: 'abaixo' },
  ok: { label: 'mínimo ok', tone: 'protein', short: 'ok' },
  ideal: { label: 'ideal', tone: 'ok', short: 'ideal' },
  acima: { label: 'acima do teto útil', tone: 'warn', short: 'acima' },
}

/** Dia em andamento abaixo do mínimo é "até agora", não um veredito. */
export function zoneLabel(z: ProteinZone, inProgress: boolean) {
  return z === 'abaixo' && inProgress ? 'abaixo do mínimo até agora' : ZONE[z].label
}

/** Escala da barra: um pouco além do teto (ou do valor, se passou), para o teto não colar na borda. */
export const scaleMax = (b: ProteinBand, grams: number) => Math.max(b.cap * 1.12, grams * 1.04)

/** Segmentos da barra de zonas [início, fim, zona] em gramas. */
export function zoneSegments(b: ProteinBand, max: number): [number, number, ProteinZone][] {
  return [[0, b.min, 'abaixo'], [b.min, b.ideal, 'ok'], [b.ideal, b.cap, 'ideal'], [b.cap, Math.max(max, b.cap), 'acima']]
}

/** Padrões de goals (migração 20261111120000): 1,3 · 1,6 · 2,2 g/kg, referência limitada ao IMC 30. */
export const PROTEIN_DEFAULTS = { min: 1.3, ideal: 1.6, cap: 2.2, bmiMax: 30 as number | null } as const

const r1 = (n: number) => Math.round(n * 10) / 10

/**
 * Mesma conta de v_protein_target, para o app funcionar enquanto a view ainda não existe no banco.
 * Peso = última pesagem (senão goals.peso_ref_kg); referência = menor entre ele e o peso no IMC máximo
 * (quando há altura). Sem peso: sem faixa.
 */
export function proteinTargetFrom(input: {
  weightKg: number | null; weightDate: string | null; heightCm: number | null; pesoRefKg?: number | null
  gPerKg?: { min?: number | null; ideal?: number | null; cap?: number | null }; bmiMax?: number | null
}): ProteinTarget {
  const min = Number(input.gPerKg?.min ?? PROTEIN_DEFAULTS.min)
  const ideal = Number(input.gPerKg?.ideal ?? PROTEIN_DEFAULTS.ideal)
  const cap = Number(input.gPerKg?.cap ?? PROTEIN_DEFAULTS.cap)
  const bmiMax = input.bmiMax === undefined ? PROTEIN_DEFAULTS.bmiMax : input.bmiMax
  const weight = input.weightKg != null ? Number(input.weightKg) : input.pesoRefKg != null ? Number(input.pesoRefKg) : null
  const h = input.heightCm != null ? Number(input.heightCm) / 100 : null
  const bmiCap = h != null && bmiMax != null ? r1(bmiMax * h * h) : null
  const ref = weight == null ? null : bmiCap != null && weight > bmiCap ? bmiCap : weight
  return {
    weight_kg: weight, weight_date: input.weightKg != null ? input.weightDate : null, height_cm: input.heightCm,
    bmi: h != null && weight != null ? r1(weight / (h * h)) : null,
    bmi_cap_kg: bmiCap, ref_bmi_max: bmiMax, ref_weight_kg: ref == null ? null : r1(ref),
    ref_basis: weight == null ? 'sem_peso' : bmiCap != null && weight > bmiCap ? 'teto_imc' : 'peso',
    min_g_per_kg: min, ideal_g_per_kg: ideal, cap_g_per_kg: cap,
    min_g: ref == null ? null : Math.round(ref * min),
    ideal_g: ref == null ? null : Math.round(ref * ideal),
    cap_g: ref == null ? null : Math.round(ref * cap),
  }
}
