// Teste do saldo da semana e do mês (src/lib/balance.ts). Rodado por scripts/verify_local.sh via jiti:
//   npx jiti scripts/test-balance.ts
import { periodRange, summarizeBalance } from '../src/lib/balance'
import type { EnergyDay } from '../src/lib/types'

let fail = 0
const check = (desc: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) fail++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${desc}${ok ? '' : ` (esperado ${JSON.stringify(want)}, veio ${JSON.stringify(got)})`}`)
}
const bounds = (r: { from: string; to: string }) => [r.from, r.to]

// limites: 05/11/2026 é uma quinta-feira
check('semana: segunda a domingo', bounds(periodRange('semana', '2026-11-05')), ['2026-11-02', '2026-11-08'])
check('semana: domingo fica na semana que começou na segunda', bounds(periodRange('semana', '2026-11-08')), ['2026-11-02', '2026-11-08'])
check('semana: segunda abre a própria semana', bounds(periodRange('semana', '2026-11-02')), ['2026-11-02', '2026-11-08'])
check('semana anterior, cruzando o mês', bounds(periodRange('semana', '2026-11-05', -1)), ['2026-10-26', '2026-11-01'])
check('mês: do dia 1 ao último', bounds(periodRange('mes', '2026-11-05')), ['2026-11-01', '2026-11-30'])
check('mês anterior de 31 dias', bounds(periodRange('mes', '2026-11-05', -1)), ['2026-10-01', '2026-10-31'])
check('mês: dia 31 não estoura ao voltar para fevereiro', bounds(periodRange('mes', '2026-03-31', -1)), ['2026-02-01', '2026-02-28'])
check('mês: fevereiro bissexto', bounds(periodRange('mes', '2028-02-10')), ['2028-02-01', '2028-02-29'])
check('mês: volta para o ano anterior', bounds(periodRange('mes', '2026-01-15', -1)), ['2025-12-01', '2025-12-31'])

const row = (date: string, r: Partial<EnergyDay>): EnergyDay => ({
  date, weight_kg: 94, height_cm: 178, age_years: 36, sex: 'M', activity_factor: 1.2, bmr_kcal: 1900, daily_life_kcal: 380,
  exercise_watch_kcal: 0, exercise_est_kcal: 0, exercise_kcal: 0, is_estimate: false, n_sessions_estimated: 0,
  food_kcal: 0, food_logged: false, food_has_estimated: false, out_kcal: 2280, balance_kcal: null, target_balance_kcal: 0, bmr_missing: [], ...r,
})
const ate = (date: string, food: number, out = 2280, r: Partial<EnergyDay> = {}) =>
  row(date, { food_kcal: food, food_logged: true, out_kcal: out, balance_kcal: food - out, ...r })

// semana de 02 a 08/11, hoje = quinta 05/11
const today = '2026-11-05'
const week = periodRange('semana', today)
const s = summarizeBalance([
  ate('2026-11-02', 2000),                                      // −280
  row('2026-11-03', {}),                                        // fechado sem refeição
  ate('2026-11-04', 2500, 2300, { is_estimate: true }),         // +200
  ate(today, 500),                                              // em andamento: −1780, fora da conta
], week, today)

check('estados de cada dia', s.days.map((d) => d.state), ['counted', 'no_food', 'counted', 'today', 'future', 'future', 'future'])
check('saldo soma só os dias fechados', s.balance, -80)
check('dia sem refeição e hoje não entram na conta', s.counted, 2)
check('média só sobre os dias na conta', s.avg, -40)
check('comida e gasto dos mesmos dias', [s.food, s.out], [4500, 4580])
check('comida − gasto = saldo', s.food - s.out, s.balance)
check('dia sem refeição fica nomeado', s.noFood, ['2026-11-03'])
check('saldo parcial de hoje separado', s.todayBalance, -1780)
check('dias por vir', s.future, 3)
check('estimativa em dia na conta aparece', s.estimated, true)

const onlyToday = summarizeBalance([ate('2026-11-02', 500)], week, '2026-11-02')
check('segunda: nenhum dia fechado, sem saldo', [onlyToday.counted, onlyToday.balance, onlyToday.avg], [0, null, null])
check('segunda: hoje em andamento', [onlyToday.hasToday, onlyToday.todayBalance], [true, -1780])

const past = summarizeBalance([ate('2026-11-01', 2000, 2280, { food_has_estimated: true })], periodRange('semana', today, -1), today)
check('semana passada: sem hoje nem dias por vir', [past.hasToday, past.future], [false, 0])
check('semana passada: dia sem linha na view conta como sem refeição, nunca como zero', [past.counted, past.noFood.length, past.balance], [1, 6, -280])

const noBmr = summarizeBalance([row('2026-11-02', { food_kcal: 2000, food_logged: true, bmr_kcal: null, out_kcal: null })], week, today)
check('refeição sem basal fica fora e nomeada', [noBmr.counted, noBmr.noBmr, noBmr.balance], [0, ['2026-11-02'], null])

const todayNoBmr = summarizeBalance([row(today, { food_kcal: 800, food_logged: true, bmr_kcal: null, out_kcal: null })], week, today)
check('hoje com refeição e sem basal não vira "sem refeição"', [todayNoBmr.todayNoBmr, todayNoBmr.todayBalance], [true, null])
check('hoje sem refeição não acusa falta de basal', summarizeBalance([row(today, {})], week, today).todayNoBmr, false)

const fromDb = summarizeBalance([row('2026-11-02', { food_kcal: '2000.5', food_logged: true, out_kcal: '2280.5', balance_kcal: '-280' } as unknown as Partial<EnergyDay>)], week, today)
check('numeric vindo como texto do banco ainda soma', [fromDb.balance, fromDb.food, fromDb.out], [-280, 2000.5, 2280.5])

const month = summarizeBalance([], periodRange('mes', today), today)
check('mês: uma entrada por dia do calendário', [month.days.length, month.days[0].date, month.days.at(-1)?.date], [30, '2026-11-01', '2026-11-30'])

if (fail) {
  console.error(`${fail} teste(s) falharam`)
  process.exit(1)
}
