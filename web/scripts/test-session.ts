// Progresso e status do treino de ficha com exercícios opcionais (src/lib/session.ts).
//   npx jiti scripts/test-session.ts
import { sessionProgress } from '../src/lib/session'
import type { TemplateExercise } from '../src/lib/types'

let fail = 0
const check = (desc: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) fail++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${desc}${ok ? '' : ` (esperado ${JSON.stringify(want)}, veio ${JSON.stringify(got)})`}`)
}

const te = (id: string, sets: number, optional = false, optional_sets = 0) =>
  ({ id: `te-${id}`, sets, optional, optional_sets, exercises: { id } } as unknown as TemplateExercise)
const logs = (id: string, n: number) => Array.from({ length: n }, () => ({ exercise_id: id, warmup: false }))

// B: agachamento 4, leg press 3 obrigatórios; afundo 2 opcional
const B = [te('agach', 4), te('leg', 3), te('afundo', 2, true)]
check('B compacta: obrigatórios feitos e opcional pulado = feito',
  sessionProgress(B, [...logs('agach', 4), ...logs('leg', 3)], new Set(['afundo'])).status, 'feito')
check('B: obrigatório pulado = parcial',
  sessionProgress(B, [...logs('agach', 4), ...logs('afundo', 2)], new Set(['leg'])).status, 'parcial')
check('B: opcional pulado continua saindo do anel (alvo 7)',
  sessionProgress(B, logs('agach', 4), new Set(['afundo'])).target, 7)
check('B: só metade dos obrigatórios = parcial',
  sessionProgress(B, logs('agach', 3), new Set(['afundo'])).status, 'parcial')

// A: rosca 3 com a 3ª opcional
const A = [te('dev', 3), te('rosca', 3, false, 1)]
check('A: sem a 3ª série opcional da rosca = feito', sessionProgress(A, [...logs('dev', 3), ...logs('rosca', 2)], new Set()).status, 'feito')
check('A: série warmup não conta', sessionProgress(A, [...logs('dev', 3), { exercise_id: 'rosca', warmup: true }], new Set()).status, 'parcial')
check('ficha sem opcionais: regra antiga (80 %)', sessionProgress([te('x', 5)], logs('x', 4), new Set()).status, 'feito')

if (fail) { console.log(`${fail} falha(s)`); process.exit(1) }
console.log('session: tudo ok')
