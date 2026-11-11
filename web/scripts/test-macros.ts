// Faixas de carbo e gordura, zonas, espelho de v_day_targets e permissão do dia (src/lib/macros.ts, src/lib/kcal.ts).
//   npx jiti scripts/test-macros.ts
// Os mesmos casos de faixa rodam no banco em scripts/verify_local.sh (v_day_targets).
import { bandsOf, carbBand, dayStateOf, dayTargetsFrom, fatBand, macroZone, macroZoneLabel, periodNutrition } from '../src/lib/macros'
import { allowanceOf, dayAllowance, remainingKcal } from '../src/lib/kcal'
import type { DayTarget, EnergyDay, PlanItem } from '../src/lib/types'

let fail = 0
const check = (desc: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) fail++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${desc}${ok ? '' : ` (esperado ${JSON.stringify(want)}, veio ${JSON.stringify(got)})`}`)
}
const b = (x: { min: number; ideal: number; cap: number } | null) => (x ? `${x.min}/${x.ideal}/${x.cap}` : null)

// ---------------------------------------------------------------- faixas (mesmos casos do verify_local.sh)
const P = { min: 119, ideal: 147, cap: 202 }   // proteína do Kaluan: ref. 91,9 kg (IMC 30)
check('gordura: permissão 2200 → 37/49/86 g (15/20/35 %)', b(fatBand(2200)), '37/49/86')
check('carbo: permissão 2200 → 130/156/293 g', b(carbBand(2200, P)), '130/156/293')
check('dia sem treino do Kaluan (2225 − 300 = 1925): gordura 32/43/75', b(fatBand(1925)), '32/43/75')
check('dia sem treino: carbo 130/130/238 (o início da faixa ideal encosta no mínimo)', b(carbBand(1925, P)), '130/130/238')
check('treino aumenta a permissão e o espaço do carbo (2700 − 300 = 2400): 130/188/333', b(carbBand(2400, P)), '130/188/333')
check('treino: gordura 40/53/93 com 2400', b(fatBand(2400)), '40/53/93')
check('permissão baixa: faixa ideal nunca abaixo de 130 nem invertida', b(carbBand(1000, P)), '130/130/130')
check('sem permissão: sem faixa de gordura', fatBand(null), null)
check('sem faixa de proteína: sem faixa de carbo', carbBand(2200, null), null)
check('parâmetros vindos de goals', b(fatBand(2000, { fatFloorPct: 10, fatMinPct: 25, fatMaxPct: 30, carbFloorG: 100 })), '22/56/67')

// ---------------------------------------------------------------- zonas (limites iguais aos do banco)
const fat = fatBand(2200)!
const carb = carbBand(2200, P)!
check('carbo: 129,9 abaixo · 130 mínimo ok · 156 ideal · 293 ideal · 294 acima',
  [129.9, 130, 156, 293, 294].map((g) => macroZone(g, carb)), ['abaixo', 'ok', 'ideal', 'ideal', 'acima'])
check('gordura: 36,9 abaixo · 37 ok · 49 ideal · 86 ideal · 86,1 acima',
  [36.9, 37, 49, 86, 86.1].map((g) => macroZone(g, fat)), ['abaixo', 'ok', 'ideal', 'ideal', 'acima'])
check('faixa sem "mínimo ok" (1925): 130 já é ideal', macroZone(130, carbBand(1925, P)!), 'ideal')
check('rótulos: carbo acima da faixa; proteína acima do teto útil', [macroZoneLabel('carb', 'acima'), macroZoneLabel('protein', 'acima')], ['acima da faixa', 'acima do teto útil'])
check('dia em andamento abaixo do mínimo é "até agora"', macroZoneLabel('fat', 'abaixo', true), 'abaixo do mínimo até agora')

// ---------------------------------------------------------------- espelho de v_day_targets
const e = (date: string, r: Partial<EnergyDay>): EnergyDay => ({
  date, weight_kg: 92.5, height_cm: 175, age_years: 36, sex: 'M', activity_factor: 1.2, bmr_kcal: 1854, daily_life_kcal: 371,
  exercise_watch_kcal: 0, exercise_est_kcal: 0, exercise_kcal: 0, is_estimate: false, n_sessions_estimated: 0,
  food_kcal: 0, food_logged: false, food_has_estimated: false, out_kcal: 2225, balance_kcal: null, target_balance_kcal: -300, bmr_missing: [], ...r,
})
const meal = (date: string, food: number, ex = 0) =>
  e(date, { food_kcal: food, food_logged: true, exercise_kcal: ex, out_kcal: 2225 + ex, balance_kcal: food - 2225 - ex })
const today = '2026-11-11'
const rows = dayTargetsFrom({
  energy: [
    meal('2026-11-08', 1177, 450),                                   // treino: permissão 2375
    e('2026-11-07', {}),                                             // sem refeição
    meal('2026-11-05', 2225),                                        // placeholder: marcado incompleto
    e('2026-11-09', { bmr_kcal: null, daily_life_kcal: null, out_kcal: null, food_kcal: 2000, food_logged: true }),   // sem basal
    meal('2026-11-10', 1751, 782),
    meal(today, 1190, 296),
  ],
  nutrition: [
    { date: '2026-11-08', protein_g: 150, carb_g: 100, fat_g: 40 }, { date: '2026-11-05', protein_g: 0, carb_g: 0, fat_g: 0 },
    { date: '2026-11-10', protein_g: 160.04, carb_g: 210, fat_g: 60 }, { date: today, protein_g: 95, carb_g: 120, fat_g: 38 },
  ],
  incomplete: new Set(['2026-11-05']),
  protein: { ref_weight_kg: 91.9, min_g: 119, ideal_g: 147, cap_g: 202 }, kcalTarget: null, today,
})
const by = new Map(rows.map((r) => [r.date, r]))
check('estados como na view: na_conta, sem_refeicao, incompleto, sem_basal, hoje',
  ['2026-11-08', '2026-11-07', '2026-11-05', '2026-11-09', today].map((d) => by.get(d)!.day_state), ['na_conta', 'sem_refeicao', 'incompleto', 'sem_basal', 'hoje'])
const d8 = by.get('2026-11-08')!
check('permissão = basal + rotina + treino − 300 (treino 450 → 2375)', [d8.allowance_kcal, d8.allowance_basis, d8.target_balance_kcal], [2375, 'gasto', -300])
check('resta = permissão − comida; vs meta = comida − permissão = saldo real + 300', [d8.remaining_kcal, d8.balance_vs_target_kcal, d8.balance_kcal], [1198, -1198, -1498])
check('faixas do dia pela permissão do dia', [d8.fat_floor_g, d8.fat_min_g, d8.fat_max_g, d8.carb_min_g, d8.carb_max_g], [40, 53, 92, 184, 328])
check('zonas do dia (proteína ideal, carbo abaixo, gordura ok)', [d8.protein_zone, d8.carb_zone, d8.fat_zone], ['ideal', 'abaixo', 'ok'])
check('diário incompleto: sem zonas', [by.get('2026-11-05')!.protein_zone, by.get('2026-11-05')!.carb_zone], [null, null])
check('sem basal e sem meta fixa: sem permissão nem faixas', [by.get('2026-11-09')!.allowance_kcal, by.get('2026-11-09')!.fat_min_g, by.get('2026-11-09')!.carb_floor_g], [null, null, 130])
check('gramas arredondados a 0,1 como na view', by.get('2026-11-10')!.protein_g, 160)
check('bandsOf lê as três faixas da linha', Object.values(bandsOf(d8)).map(b), ['119/147/202', '130/184/328', '40/53/92'])
check('dayStateOf: hoje vence o incompleto', dayStateOf(today, today, { diary_incomplete: true, food_logged: true, balance_kcal: 1 }), 'hoje')

// ---------------------------------------------------------------- médias do período (resumos)
const pn = periodNutrition(rows, '2026-11-05', today)
check('período: só dias na conta (08 e 10), sem hoje, incompleto, sem refeição ou sem basal', pn.days, 2)
check('período: saldo real e meta somados nos mesmos dias', [pn.balance, pn.target], [-1498 + -1256, -600])
check('período: médias de macros', [pn.protein?.avg, pn.carb?.avg, pn.fat?.avg], [155, 155, 50])
check('período: faixa média (permissões 2375 e 2707) e zona da média', [b(pn.carb!.band), pn.carb!.zone, b(pn.fat!.band), pn.fat!.zone], ['130/211/361', 'ok', '43/57/99', 'ok'])
check('período: fora da conta por motivo', [pn.incomplete, pn.noFood], [1, 1])
check('período vazio: sem médias', [periodNutrition(rows, '2026-12-01', '2026-12-07').days, periodNutrition(rows, '2026-12-01', '2026-12-07').carb], [0, null])

// ---------------------------------------------------------------- permissão de hoje (meta fixa, sem "com/sem treino")
const item = (r: Partial<PlanItem>): PlanItem => ({ active: true, date: today, modality: 'muay_thai', duration_min: 60, est_minutes: null, session_status: null, ...r } as PlanItem)
const a = dayAllowance({ rows: [meal(today, 1190, 296)], plan: [item({ session_status: 'feito', modality: 'musculacao' }), item({})], today, fallback: null })
check('hoje: meta fixa −300; pode consumir = 1854 + 371 + 296 − 300', [a.targetBalance, a.allowance, a.dynamic], [-300, 2221, true])
check('hoje: o treino feito é o que subiu a permissão', [a.exercise, a.allowance! - (a.bmr! + a.life! + a.targetBalance!)], [296, 296])
check('hoje: treino por fazer só como aviso (muay thai 60 min, 92,5 kg ≈ 833)', [a.pendingCount, a.pendingKcal], [1, 833])
check('ainda resta = permissão − comida (negativo = passou)', [remainingKcal(a, 1190), remainingKcal(a, 2500)], [1031, -279])
const noBmr = dayAllowance({ rows: [e(today, { bmr_kcal: null, daily_life_kcal: null, out_kcal: null })], plan: [], today, fallback: 2000 })
check('sem basal: meta fixa goals.kcal_target, sem treino somado', [noBmr.dynamic, noBmr.allowance], [false, 2000])
check('allowanceOf de um dia passado = gasto + saldo-alvo', allowanceOf({ out_kcal: 3007, target_balance_kcal: -300 }, null), 2707)
check('allowanceOf sem saldo-alvo (view antiga) = gasto', allowanceOf({ out_kcal: 2225, target_balance_kcal: null }, null), 2225)

const _unused: DayTarget | null = null
void _unused
if (fail) {
  console.error(`${fail} teste(s) falharam`)
  process.exit(1)
}
