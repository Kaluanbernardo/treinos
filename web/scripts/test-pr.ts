// Teste da regra de PR do app (src/lib/pr.ts). Rodado por scripts/verify_local.sh via jiti:
//   npx jiti scripts/test-pr.ts [arquivo.json com [[kg, reps, e1rm_do_postgres], ...]]
import { readFileSync } from 'node:fs'
import { e1rmCents, prFlagsFor } from '../src/lib/pr'

let fail = 0
const check = (desc: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) fail++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${desc}${ok ? '' : ` (esperado ${JSON.stringify(want)}, veio ${JSON.stringify(got)})`}`)
}
let t = 0
const set = (kg: number | null, reps: number | null) => ({ id: `s${++t}`, kg, reps, logged_at: `2026-10-28T09:00:${String(t).padStart(2, '0')}Z` })
const flags = (sets: ReturnType<typeof set>[], best?: { best_kg: number | null; best_e1rm: number | null }) =>
  sets.map((s) => prFlagsFor(sets, best).get(s.id) ?? null)

// recorde anterior vindo do banco (prev_bests): best_e1rm já arredondado a 2 casas
check('PR (app): 62,5×7 empata recorde 62,5×7 (77,08) → sem PR', flags([set(62.5, 7)], { best_kg: 62.5, best_e1rm: 77.08 }), [false])
check('PR (app): mesma carga × reps → sem PR', flags([set(80, 5)], { best_kg: 80, best_e1rm: 93.33 }), [false])
check('PR (app): 1RM igual com carga menor (60×10 vs 75×2 = 80,00) → sem PR', flags([set(60, 10)], { best_kg: 75, best_e1rm: 80 }), [false])
check('PR (app): 1 rep a mais na mesma carga → PR', flags([set(62.5, 8)], { best_kg: 62.5, best_e1rm: 77.08 }), [true])
check('PR (app): carga maior → PR', flags([set(65, 3)], { best_kg: 62.5, best_e1rm: 77.08 }), [true])
check('PR (app): best vindo como string numérica', flags([set(62.5, 7)], { best_kg: '62.5' as unknown as number, best_e1rm: '77.08' as unknown as number }), [false])
check('PR (app): empate entre séries da mesma sessão → só a 1ª é PR', flags([set(70, 6), set(70, 6)], { best_kg: 67.5, best_e1rm: 81 }), [true, false])
check('PR (app): sem histórico, 1ª série é linha de base; 2ª igual não é PR', flags([set(40, 10), set(40, 10)]), [false, false])
check('PR (app): sem histórico, 2ª série melhor é PR', flags([set(40, 10), set(42.5, 10)]), [false, true])
check('PR (app): >12 reps: só carga conta', flags([set(20, 15), set(20, 20)], { best_kg: 20, best_e1rm: null }), [false, false])
check('PR (app): aquecimento / carga 0 ignorados', flags([set(0, 10), set(null, 8)], { best_kg: 10, best_e1rm: 12 }), [null, null])
check('e1rmCents: 100×10 = 133,33', e1rmCents(100, 10), 13333)
check('e1rmCents: 18,75×1 = 19,37 (dízima truncada, como o Postgres)', e1rmCents(18.75, 1), 1937)
check('e1rmCents: 0,25×3 = 0,28 (meio exato sobe)', e1rmCents(0.25, 3), 28)
check('e1rmCents: 0,75×5 = 0,88 (0,…667 sobe)', e1rmCents(0.75, 5), 88)

// mesma conta que o banco, numa grade de cargas × reps (gerada pelo verify_local com psql)
const file = process.argv[2]
if (file) {
  const grid = JSON.parse(readFileSync(file, 'utf8')) as [number, number, number][]
  const bad = grid.filter(([kg, reps, pg]) => e1rmCents(kg, reps) !== Math.round(pg * 100))
  check(`e1rmCents = round(kg * (1 + reps / 30.0), 2) do Postgres em ${grid.length} combinações`, bad.slice(0, 3), [])
}

console.log(fail ? `pr: ${fail} falhas` : 'pr: tudo ok')
process.exit(fail ? 1 : 0)
