import type { PrevBest, SetLog } from './types'

/**
 * 1RM estimado (Epley) em CENTÉSIMOS inteiros, exatamente como o banco: round(kg * (1 + reps / 30.0), 2).
 * O banco devolve best_e1rm já arredondado; comparar com o valor cru do JS (62,5 × 7 = 77,0833… > 77,08)
 * marcava PR numa série que só empatava o recorde.
 */
export function e1rmCents(kg: number, reps: number): number | null {
  if (!(kg > 0) || !Number.isInteger(reps) || reps < 1 || reps > 12) return null
  const n = Math.round(kg * 100) * (30 + reps) // e1rm × 100 = n / 30, tudo inteiro
  const q = Math.floor(n / 30)
  const twice = (n % 30) * 2
  // meio centésimo exato: o Postgres guarda reps / 30.0 com 20 casas, arredondando a última. Com reps ≡ 1 (mod 3)
  // a dízima é 0,…333 (fica um fio abaixo) e round() desce; ≡ 2 dá 0,…667 e múltiplos de 3 são exatos: sobe.
  return twice > 30 || (twice === 30 && reps % 3 !== 1) ? q + 1 : q
}

const cents = (v: number | null | undefined) => (v == null ? null : Math.round(Number(v) * 100))

/**
 * PR = supera ESTRITAMENTE o melhor anterior (sessões anteriores + séries anteriores desta), mesma regra de v_prs:
 * carga maior, ou 1RM estimado maior. Empate (mesma carga × reps, ou 1RM igual com carga menor) não é PR.
 * A primeira série de um exercício sem histórico é linha de base, não PR.
 */
export function prFlagsFor(exSets: Pick<SetLog, 'id' | 'kg' | 'reps' | 'logged_at'>[], best: Pick<PrevBest, 'best_kg' | 'best_e1rm'> | undefined) {
  const flags = new Map<string, boolean>()
  let bestKg = cents(best?.best_kg)
  let bestE = cents(best?.best_e1rm)
  for (const s of [...exSets].sort((a, b) => a.logged_at.localeCompare(b.logged_at))) {
    const kg = cents(s.kg) ?? 0
    const reps = s.reps ?? 0
    if (kg <= 0 || reps < 1) continue
    const e = e1rmCents(kg / 100, reps)
    const pr = (bestKg != null && kg > bestKg) || (bestE != null && e != null && e > bestE)
    flags.set(s.id, pr)
    bestKg = Math.max(bestKg ?? 0, kg)
    if (e != null) bestE = Math.max(bestE ?? 0, e)
  }
  return flags
}
