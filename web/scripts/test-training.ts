// Meta semanal, mapa de calor, contagem por ficha e histórico (src/lib/training.ts).
//   npx jiti scripts/test-training.ts
import {
  aggregateDays, countByType, countByWeek, countLevel, heatmapWeeks, historyRows, kcalLevel, monthMarks,
  trainingWeeksFrom, weekGoalLabel, weekReading, weekStatus,
} from '../src/lib/training'
import type { PlanItem, SessionRow, SessionStatus } from '../src/lib/types'

let fail = 0
const check = (desc: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) fail++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${desc}${ok ? '' : ` (esperado ${JSON.stringify(want)}, veio ${JSON.stringify(got)})`}`)
}

let n = 0
const s = (date: string, status: SessionStatus, title = 'Muay thai', extra: Partial<SessionRow> = {}): SessionRow => ({
  id: `s${++n}`, date, modality: title.startsWith('Muay') ? 'muay_thai' : title === 'Funcional' ? 'funcional' : 'musculacao',
  modality_label: '', template_id: title.startsWith('Superior') || title.startsWith('Inferiores') ? `t:${title}` : null, template_slug: null,
  title, status, started_at: null, ended_at: null, note: null, source: 'bot', duration_min: null, n_sets: 0, n_exercises: 0,
  volume_kg: 0, n_prs: 0, ...extra,
})

// ---------------------------------------------------------------- meta semanal (mesma regra de v_training_weeks)
check('3 de 4: abaixo', weekStatus(3, 4, 9), 'abaixo')
check('4 de 4: na faixa (mínimo conta)', weekStatus(4, 4, 9), 'na_faixa')
check('9: na faixa (máximo conta)', weekStatus(9, 4, 9), 'na_faixa')
check('10: acima', weekStatus(10, 4, 9), 'acima')
check('rótulo "3/4 · faixa 4–9"', weekGoalLabel(3, 4, 9), '3/4 · faixa 4–9')
check('rótulo acima do mínimo segue subindo', weekGoalLabel(6, 4, 9), '6/4 · faixa 4–9')
check('semana atual: faltam 2', weekReading(2, 4, 9, true), 'faltam 2 para o mínimo')
check('semana atual: falta 1 (singular)', weekReading(3, 4, 9, true), 'falta 1 para o mínimo')
check('semana passada abaixo: só o fato', weekReading(1, 4, 9, false), 'abaixo do mínimo')
check('no máximo', weekReading(9, 4, 9, true), 'no máximo da faixa')
check('acima do máximo', weekReading(11, 4, 9, false), 'acima do máximo (9)')

// semana 09–15/11/2026 (seg–dom): feito + parcial contam, faltou e em andamento não, qualquer modalidade
const week = [
  s('2026-11-09', 'faltou', 'Superior A'), s('2026-11-10', 'feito'), s('2026-11-11', 'feito', 'Superior B'),
  s('2026-11-12', 'parcial', 'Funcional'), s('2026-11-15', 'feito', 'Inferiores B'), s('2026-11-16', 'feito', 'Superior A'),
  s('2026-11-08', 'feito', 'Inferiores A'), s('2026-11-13', 'em_andamento', 'Inferiores A'),
]
const byWeek = countByWeek(week)
check('contador da semana: 4 (feito + parcial; domingo fecha a semana)', byWeek.get('2026-11-09'), 4)
check('domingo anterior fica na semana anterior', byWeek.get('2026-11-02'), 1)
check('segunda seguinte abre a próxima semana', byWeek.get('2026-11-16'), 1)

// ---------------------------------------------------------------- mapa de calor
const days = aggregateDays([
  s('2026-11-10', 'feito'), s('2026-11-10', 'feito', 'Superior B'), s('2026-11-10', 'faltou', 'Funcional'),
  s('2026-11-11', 'parcial', 'Superior B'), s('2026-11-12', 'faltou'),
], new Map([['2026-11-10', 950], ['2026-11-13', 320]]))
const d10 = days.get('2026-11-10')!
check('dia com 2 feitos + 1 falta', [d10.done, d10.missed, d10.items.length, d10.kcal], [2, 1, 3, 950])
check('parcial conta como feito e fica marcado', [days.get('2026-11-11')!.done, days.get('2026-11-11')!.partial], [1, 1])
check('dia só com falta: 0 feitos, 1 falta', [days.get('2026-11-12')!.done, days.get('2026-11-12')!.missed], [0, 1])
check('kcal sem sessão também entra (leitura do dia)', days.get('2026-11-13')?.kcal, 320)

const grid = heatmapWeeks(days, '2026-11-04', '2026-11-11', '2026-11-11')
check('grade começa na segunda e termina no domingo', [grid[0][0].date, grid[grid.length - 1][6].date], ['2026-11-02', '2026-11-15'])
check('2 colunas de 7 dias', grid.map((w) => w.length), [7, 7])
check('futuro marcado depois de hoje', grid[1].map((d) => d.future), [false, false, false, true, true, true, true])
check('célula de ter 10/11 tem a contagem', grid[1][1].done, 2)
check('nível por treinos: 0,1,2,3,4,4', [0, 1, 2, 3, 4, 7].map(countLevel), [0, 1, 2, 3, 4, 4])
check('nível por kcal: 0 | 1–299 | 300–599 | 600–899 | 900+', [0, 150, 300, 599, 600, 899, 900, 2000, null].map(kcalLevel), [0, 1, 2, 2, 3, 3, 4, 4, 0])

const long = heatmapWeeks(new Map(), '2026-09-28', '2026-11-11', '2026-11-11')
check('meses nas colunas: cada mês na semana que tem o dia 1 (01/11 é domingo)', monthMarks(long).map((m) => `${m.index}:${m.month}`), ['0:2026-10', '4:2026-11'])
check('rótulo da 1ª coluna some se o mês seguinte vem colado', monthMarks(heatmapWeeks(new Map(), '2026-10-19', '2026-11-11', '2026-11-11')).map((m) => `${m.index}:${m.month}`), ['1:2026-11'])

// ---------------------------------------------------------------- contagem por ficha / tipo
const hist = [
  s('2026-10-01', 'feito', 'Superior A'), s('2026-11-02', 'feito', 'Superior A'), s('2026-11-09', 'faltou', 'Superior A'),
  s('2026-11-04', 'feito', 'Superior B'), s('2026-11-11', 'parcial', 'Superior B'),
  s('2026-11-10', 'feito'), s('2026-10-20', 'feito'), s('2026-11-06', 'faltou', 'Inferiores B'), s('2026-11-08', 'feito', 'Funcional'),
]
const types = countByType(hist, '2026-10-13')
check('por tipo: período (desde 13/10) e total, ordem pelo período',
  types.map((t) => `${t.title} ${t.inPeriod}/${t.total} f${t.missedInPeriod}`),
  ['Muay thai 2/2 f0', 'Superior B 2/2 f0', 'Superior A 1/2 f1', 'Funcional 1/1 f0', 'Inferiores B 0/0 f1'])
check('último feito por ficha', types.find((t) => t.title === 'Superior A')?.last, '2026-11-02')
check('ficha aposentada com o mesmo nome soma na mesma linha',
  countByType([s('2026-11-10', 'feito', 'B — Pernas', { template_id: 'velha' }), s('2026-11-14', 'feito', 'B — Pernas', { template_id: 'nova' })], null)
    .map((t) => `${t.title} ${t.total} ${t.last}`), ['B — Pernas 2 2026-11-14'])
check('sem período = tudo', countByType(hist, null).find((t) => t.title === 'Superior A')?.inPeriod, 2)

// ---------------------------------------------------------------- histórico
const plan = (date: string, title: string, active: boolean, kind: PlanItem['plan_kind'], start = '19:00:00'): PlanItem => ({
  date, start_time: start, duration_min: 60, starts_at: `${date}T${start.slice(0, 5)}:00-03:00`, ends_at: '', modality: 'muay_thai',
  modality_label: 'Muay thai', title, plan_kind: kind, active, motivo: active ? null : 'Pugna fechada', slot_id: 'x', override_id: null,
  template_id: null, template_slug: null, template_name: null, template_warmup: null, template_note: null, est_minutes: null,
  exercise_count: 0, session_id: null, session_status: null,
})
const rows = historyRows(
  [s('2026-11-10', 'feito', 'Muay thai', { plan_kind: 'adicionado' }), s('2026-11-11', 'em_andamento', 'Superior B'), s('2026-11-09', 'faltou', 'Superior A')],
  [plan('2026-11-10', 'Muay thai', true, 'base'), plan('2026-11-02', 'Muay thai', false, 'pulado')],
)
check('histórico: sem em andamento, pulado do plano entra, mais recente primeiro',
  rows.map((r) => `${r.date.slice(8)} ${r.status}${r.rescheduled ? ' remarcado' : ''}`),
  ['10 feito remarcado', '09 faltou', '02 pulado'])
check('pulado traz o motivo', rows[2].motivo, 'Pugna fechada')

// ---------------------------------------------------------------- espelho de v_training_weeks (app sem a view)
// mesmos dados e mesmo resultado esperado do teste da view em scripts/verify_local.sh
const tw = (date: string, modality: SessionRow['modality'], status: SessionStatus) => ({ date, modality, status })
const TW = [
  tw('2025-01-06', 'musculacao', 'feito'), tw('2025-01-07', 'muay_thai', 'feito'), tw('2025-01-08', 'funcional', 'parcial'),
  tw('2025-01-09', 'cross', 'feito'), tw('2025-01-10', 'muay_thai', 'faltou'),
  tw('2025-01-13', 'musculacao', 'feito'), tw('2025-01-13', 'muay_thai', 'feito'), tw('2025-01-14', 'musculacao', 'feito'),
  tw('2025-01-14', 'cross', 'feito'), tw('2025-01-15', 'musculacao', 'feito'), tw('2025-01-15', 'muay_thai', 'feito'),
  tw('2025-01-16', 'musculacao', 'feito'), tw('2025-01-17', 'muay_thai', 'feito'), tw('2025-01-18', 'funcional', 'feito'),
  tw('2025-01-19', 'musculacao', 'feito'),
  tw('2025-01-20', 'musculacao', 'feito'), tw('2025-01-21', 'muay_thai', 'feito'),
]
const twRows = trainingWeeksFrom(TW, { min: 4, max: 9 }, '2025-01-22')
check('espelho da view: 4 na faixa (parcial conta, faltou não), 10 acima, semana atual 2 abaixo mantém a sequência',
  twRows.map((w) => `${w.week_start.slice(8)}/${w.week_start.slice(5, 7)} ${w.done}/${w.goal_min}-${w.goal_max} ${w.status} f${w.missed} s${w.streak_weeks}`).join(' | '),
  '06/01 4/4-9 na_faixa f1 s1 | 13/01 10/4-9 acima f0 s2 | 20/01 2/4-9 abaixo f0 s2')
check('espelho da view: semana passada abaixo zera a sequência', trainingWeeksFrom(TW, { min: 4, max: 9 }, '2025-01-29').map((w) => w.streak_weeks), [1, 2, 0, 0])
check('espelho da view: por modalidade conta só o feito', twRows[0].by_modality, { musculacao: 1, muay_thai: 1, funcional: 1, cross: 1 })
check('espelho da view: só a última é a atual; melhor sequência 2', [twRows.map((w) => w.is_current), twRows[0].best_streak_weeks], [[false, false, true], 2])
check('espelho da view: semanas vazias no meio entram com 0', trainingWeeksFrom([tw('2025-01-06', 'cross', 'feito')], { min: 4, max: 9 }, '2025-01-20').map((w) => w.done), [1, 0, 0])
check('espelho da view: sem sessão, só a semana atual', trainingWeeksFrom([], { min: 4, max: 9 }, '2026-11-11').map((w) => `${w.week_start} ${w.done} ${w.to_min}`), ['2026-11-09 0 4'])

if (fail) { console.log(`${fail} falha(s)`); process.exit(1) }
console.log('training: tudo ok')
