// Faixa de proteína (src/lib/protein.ts). Os gramas vêm de v_protein_target (conferidos em verify_local.sh).
//   npx jiti scripts/test-protein.ts
import { bandOf, proteinTargetFrom, proteinZone, scaleMax, zoneLabel, zoneSegments } from '../src/lib/protein'

let fail = 0
const check = (desc: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) fail++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${desc}${ok ? '' : ` (esperado ${JSON.stringify(want)}, veio ${JSON.stringify(got)})`}`)
}

// Kaluan em 11/11/2026: 92,5 kg, 175 cm → referência 91,9 kg (IMC 30) → 119 / 147 / 202 g
const b = bandOf({ min_g: 119, ideal_g: 147, cap_g: 202 })!
check('faixa lida da view', b, { min: 119, ideal: 147, cap: 202 })
check('sem peso: sem faixa (nunca inventa)', bandOf({ min_g: null, ideal_g: null, cap_g: null }), null)
check('sem view: sem faixa', bandOf(null), null)
check('zonas nos limites: 118 abaixo · 119 ok · 146 ok · 147 ideal · 202 ideal · 203 acima',
  [0, 118, 119, 146, 147, 175, 202, 203, 260].map((g) => proteinZone(g, b)),
  ['abaixo', 'abaixo', 'ok', 'ok', 'ideal', 'ideal', 'ideal', 'acima', 'acima'])
check('meta antiga 160–175 g cai inteira no ideal', [160, 175].map((g) => proteinZone(g, b)), ['ideal', 'ideal'])
check('valores com casa decimal (somas de refeição)', [118.6, 146.9, 202.4].map((g) => proteinZone(g, b)), ['abaixo', 'ok', 'acima'])
check('dia em andamento abaixo do mínimo: "até agora"', zoneLabel('abaixo', true), 'abaixo do mínimo até agora')
check('dia fechado abaixo do mínimo', zoneLabel('abaixo', false), 'abaixo do mínimo')
check('outras zonas não mudam com o dia em andamento', zoneLabel('ideal', true), 'ideal')
check('escala: 12 % além do teto', Math.round(scaleMax(b, 100)), 226)
check('escala acompanha valor acima do teto', Math.round(scaleMax(b, 250)), 260)
check('segmentos contíguos da barra', zoneSegments(b, 226), [[0, 119, 'abaixo'], [119, 147, 'ok'], [147, 202, 'ideal'], [202, 226, 'acima']])

// espelho de v_protein_target (app sem a view): mesmos casos de scripts/verify_local.sh
const pt = (weightKg: number | null, heightCm: number | null, pesoRefKg: number | null = 94) => {
  const t = proteinTargetFrom({ weightKg, weightDate: weightKg ? '2026-10-31' : null, heightCm, pesoRefKg })
  return `${t.ref_basis} ${t.ref_weight_kg} ${t.min_g}/${t.ideal_g}/${t.cap_g}${t.bmi != null ? ` imc ${t.bmi}` : ''}`
}
check('92,5 kg / 175 cm (IMC 30,2) → referência 91,9 kg (IMC 30) → 119/147/202 g', pt(92.5, 175), 'teto_imc 91.9 119/147/202 imc 30.2')
check('abaixo do IMC 30 usa o peso da balança (80 kg → 104/128/176 g)', pt(80, 175), 'peso 80 104/128/176 imc 26.1')
check('sem altura: peso da balança (92,5 → 120/148/204)', pt(92.5, null), 'peso 92.5 120/148/204')
check('sem pesagem: peso das metas (94 kg, 175 cm → teto 91,9)', pt(null, 175), 'teto_imc 91.9 119/147/202 imc 30.7')
check('sem peso nenhum: sem faixa', pt(null, 175, null), 'sem_peso null null/null/null')
check('g/kg das metas mudam a faixa', proteinTargetFrom({ weightKg: 80, weightDate: null, heightCm: null, gPerKg: { min: 1.2, ideal: 1.6, cap: 2.0 } }).cap_g, 160)
check('IMC máx. NULL = sempre o peso da balança', proteinTargetFrom({ weightKg: 92.5, weightDate: null, heightCm: 175, bmiMax: null }).ref_basis, 'peso')

if (fail) { console.log(`${fail} falha(s)`); process.exit(1) }
console.log('protein: tudo ok')
