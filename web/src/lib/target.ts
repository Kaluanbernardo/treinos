import type { TemplateExercise } from './types'

/**
 * Pré-preenchimento da próxima série (regra única para Sessão e Ficha):
 *   kg   = carga_alvo da ficha, senão a carga da última sessão
 *   reps = reps_alvo da ficha, senão as reps da última sessão limitadas a [reps_min, reps_max]
 * `suggested*` = o valor veio do alvo da ficha (o app mostra a etiqueta "sugerido").
 */
export interface Suggestion { kg: number | null; reps: number | null; kgSuggested: boolean; repsSuggested: boolean }

const n = (v: number | string | null | undefined) => (v == null || v === '' ? null : Number(v))

export function suggest(te: TemplateExercise, last: { kg?: number | null; reps?: number | null } | null | undefined): Suggestion {
  const alvoKg = n(te.carga_alvo)
  const alvoReps = n(te.reps_alvo)
  const lo = n(te.reps_min)
  const hi = n(te.reps_max)
  let reps = n(last?.reps)
  if (reps != null && te.reps_unit !== 'max') {
    if (lo != null) reps = Math.max(lo, reps)
    if (hi != null) reps = Math.min(hi, reps)
  }
  return {
    kg: alvoKg ?? n(last?.kg),
    reps: alvoReps ?? reps ?? lo ?? hi,
    kgSuggested: alvoKg != null,
    repsSuggested: alvoReps != null,
  }
}
