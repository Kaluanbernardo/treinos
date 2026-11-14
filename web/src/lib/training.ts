import { addDays, weekStart } from './format'
import type { Modality, PlanItem, SessionRow, SessionStatus, TrainingWeek } from './types'

/**
 * Meta semanal de treinos, mapa de calor e contagem por ficha. Contas puras (testadas em
 * scripts/test-training.ts). A regra de "feito" é a mesma de v_training_weeks: feito + parcial,
 * qualquer modalidade, planejado ou não.
 */

export const DONE_STATUS: ReadonlySet<SessionStatus> = new Set(['feito', 'parcial'])
export const isDone = (s: Pick<SessionRow, 'status'>) => DONE_STATUS.has(s.status)

/** Faixa padrão (goals.weekly_sessions_min/max); o app usa o que vier do banco. */
export const GOAL_DEFAULT = { min: 4, max: 9 } as const

// ---------------------------------------------------------------- meta semanal
export type WeekStatus = 'abaixo' | 'na_faixa' | 'acima'

export function weekStatus(done: number, min: number, max: number): WeekStatus {
  if (done < min) return 'abaixo'
  if (done > max) return 'acima'
  return 'na_faixa'
}

/** "3/4 · faixa 4–9" (o denominador é o mínimo; acima dele o número segue subindo: "6/4"). */
export const weekGoalLabel = (done: number, min: number, max: number) => `${done}/${min} · faixa ${min}–${max}`

/**
 * Leitura curta do contador. Semana em andamento abaixo do mínimo não é "abaixo": diz quanto falta.
 * Nunca culpa: semana passada abaixo do mínimo é só um fato.
 */
export function weekReading(done: number, min: number, max: number, current: boolean): string {
  const st = weekStatus(done, min, max)
  if (st === 'acima') return `acima do máximo (${max})`
  if (st === 'na_faixa') return done === max ? 'no máximo da faixa' : 'na faixa'
  const left = min - done
  return current ? `${left === 1 ? 'falta 1' : `faltam ${left}`} para o mínimo` : 'abaixo do mínimo'
}

/** Conta as sessões feitas (feito + parcial) por semana de segunda a domingo. */
export function countByWeek(sessions: Pick<SessionRow, 'date' | 'status'>[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const s of sessions) if (DONE_STATUS.has(s.status)) out.set(weekStart(s.date), (out.get(weekStart(s.date)) ?? 0) + 1)
  return out
}

// ---------------------------------------------------------------- mapa de calor
export interface HeatItem { title: string; modality: Modality; status: SessionStatus; id: string }
export interface HeatDay {
  date: string
  /** feito + parcial */
  done: number
  partial: number
  missed: number
  /** kcal de exercício do dia (v_energy_daily.exercise_kcal), quando houver */
  kcal: number | null
  items: HeatItem[]
  future: boolean
}

/** Agrega sessões (e kcal de exercício, opcional) por dia. Sessão em andamento entra na lista, não na contagem. */
export function aggregateDays(
  sessions: Pick<SessionRow, 'id' | 'date' | 'status' | 'title' | 'modality'>[],
  kcalByDay: Map<string, number> = new Map(),
): Map<string, Omit<HeatDay, 'future'>> {
  const out = new Map<string, Omit<HeatDay, 'future'>>()
  const get = (date: string) => {
    let d = out.get(date)
    if (!d) out.set(date, d = { date, done: 0, partial: 0, missed: 0, kcal: kcalByDay.get(date) ?? null, items: [] })
    return d
  }
  for (const s of sessions) {
    const d = get(s.date)
    if (DONE_STATUS.has(s.status)) d.done++
    if (s.status === 'parcial') d.partial++
    if (s.status === 'faltou') d.missed++
    d.items.push({ id: s.id, title: s.title, modality: s.modality, status: s.status })
  }
  for (const [date, kcal] of kcalByDay) if (!out.has(date) && kcal > 0) get(date)
  return out
}

/**
 * Grade de semanas (colunas) × dias seg–dom (linhas) cobrindo [from, to], estendida para começar
 * numa segunda e terminar num domingo. Dias depois de `today` ficam `future`.
 */
export function heatmapWeeks(days: Map<string, Omit<HeatDay, 'future'>>, from: string, to: string, today: string): HeatDay[][] {
  const weeks: HeatDay[][] = []
  const end = addDays(weekStart(to), 6)
  for (let ws = weekStart(from); ws <= end; ws = addDays(ws, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, k) => {
      const date = addDays(ws, k)
      const d = days.get(date)
      return { date, done: d?.done ?? 0, partial: d?.partial ?? 0, missed: d?.missed ?? 0, kcal: d?.kcal ?? null, items: d?.items ?? [], future: date > today }
    }))
  }
  return weeks
}

/** Intensidade 0–4 por nº de treinos feitos no dia (0, 1, 2, 3, 4+). */
export const countLevel = (n: number) => Math.max(0, Math.min(4, Math.floor(n)))

/** Faixas de kcal de exercício do dia: 0 | 1–299 | 300–599 | 600–899 | 900+. */
export const KCAL_STEPS = [300, 600, 900] as const
export function kcalLevel(kcal: number | null | undefined) {
  if (!kcal || kcal <= 0) return 0
  return 1 + KCAL_STEPS.filter((s) => kcal >= s).length
}

/** Rótulos de mês sobre as colunas: o mês aparece na primeira semana que tem o dia 1 (ou na primeira coluna). */
export function monthMarks(weeks: HeatDay[][]): { index: number; month: string }[] {
  const out: { index: number; month: string }[] = []
  weeks.forEach((w, i) => {
    const first = w.find((d) => d.date.endsWith('-01'))
    if (i === 0) out.push({ index: 0, month: (first ?? w[0]).date.slice(0, 7) })
    else if (first) out.push({ index: i, month: first.date.slice(0, 7) })
  })
  // rótulo da 1ª coluna some se o próximo vier logo depois (não encavala)
  if (out.length > 1 && out[1].index - out[0].index < 3) out.shift()
  return out
}

// ---------------------------------------------------------------- contagem por ficha / tipo
export interface TypeCount { key: string; title: string; modality: Modality; total: number; inPeriod: number; missedInPeriod: number; last: string | null }

/**
 * Quantas vezes cada treino foi feito: musculação pela ficha (Superior A, Inferiores B...), sem ficha
 * "Musculação"; aulas pela modalidade (Muay thai, Funcional, Cross...). `since` = início do período (inclusive).
 */
export function countByType(sessions: Pick<SessionRow, 'date' | 'status' | 'title' | 'modality' | 'template_id'>[], since: string | null): TypeCount[] {
  const by = new Map<string, TypeCount>()
  for (const s of sessions) {
    // ficha pelo nome: versões aposentadas com o mesmo nome (ex.: a B curta e a B completa) contam como a mesma ficha
    const key = s.template_id ? `t:${s.title}` : `m:${s.modality}`
    let c = by.get(key)
    if (!c) by.set(key, c = { key, title: s.title, modality: s.modality, total: 0, inPeriod: 0, missedInPeriod: 0, last: null })
    const inP = since == null || s.date >= since
    if (DONE_STATUS.has(s.status)) {
      c.total++
      if (inP) c.inPeriod++
      if (!c.last || s.date > c.last) c.last = s.date
    } else if (s.status === 'faltou' && inP) c.missedInPeriod++
  }
  return [...by.values()]
    .filter((c) => c.total > 0 || c.missedInPeriod > 0)
    .sort((a, b) => b.inPeriod - a.inPeriod || b.total - a.total || a.title.localeCompare(b.title, 'pt-BR'))
}

// ---------------------------------------------------------------- histórico
export type HistoryStatus = SessionStatus | 'pulado'
export interface HistoryRow {
  key: string
  date: string
  title: string
  modality: Modality
  status: HistoryStatus
  /** veio de um item adicionado ao plano (remarcado / extra) */
  rescheduled: boolean
  motivo: string | null
  session: SessionRow | null
  /** hora para ordenar dentro do dia (início da sessão ou do item do plano) */
  at: string
}

/**
 * Linha do tempo do histórico: sessões (feito / parcial / faltou) + ocorrências puladas do plano
 * (override 'skip') no mesmo intervalo. Mais recente primeiro; no mesmo dia, pela hora.
 */
export function historyRows(sessions: SessionRow[], plan: PlanItem[]): HistoryRow[] {
  const rows: HistoryRow[] = sessions
    .filter((s) => s.status !== 'em_andamento')
    .map((s) => ({
      key: s.id, date: s.date, title: s.title, modality: s.modality, status: s.status,
      rescheduled: s.plan_kind === 'adicionado', motivo: s.plan_motivo ?? null, session: s, at: s.started_at ?? '',
    }))
  for (const p of plan) {
    if (p.active || p.plan_kind !== 'pulado') continue
    rows.push({
      key: `pulado:${p.date}:${p.start_time}:${p.slot_id}`, date: p.date, title: p.title, modality: p.modality, status: 'pulado',
      rescheduled: false, motivo: p.motivo, session: null, at: p.starts_at,
    })
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date) || b.at.localeCompare(a.at))
}

// ---------------------------------------------------------------- semanas da meta (espelho de v_training_weeks)
/**
 * Mesma conta de v_training_weeks (migração 20261111120000), para o app funcionar enquanto a view ainda não
 * existe no banco: 1 linha por semana (seg–dom) da semana da 1ª sessão até a atual; done = feito + parcial,
 * qualquer modalidade; met = done ≥ mínimo; sequência = semanas seguidas no mínimo, e a semana atual abaixo do
 * mínimo repete a sequência da anterior (semana em andamento não quebra). `planned` fica 0 (vem do plano no banco).
 */
export function trainingWeeksFrom(
  sessions: Pick<SessionRow, 'date' | 'status' | 'modality'>[],
  goal: { min: number; max: number },
  today: string,
): TrainingWeek[] {
  const cw = weekStart(today)
  const first = sessions.reduce<string>((m, s) => (s.date < m ? s.date : m), today)
  const by = new Map<string, { done: number; feito: number; parcial: number; missed: number; mods: Partial<Record<Modality, number>> }>()
  for (const s of sessions) {
    const ws = weekStart(s.date)
    let w = by.get(ws)
    if (!w) by.set(ws, w = { done: 0, feito: 0, parcial: 0, missed: 0, mods: {} })
    if (DONE_STATUS.has(s.status)) { w.done++; w.mods[s.modality] = (w.mods[s.modality] ?? 0) + 1 }
    if (s.status === 'feito') w.feito++
    if (s.status === 'parcial') w.parcial++
    if (s.status === 'faltou') w.missed++
  }
  const out: TrainingWeek[] = []
  let run = 0
  let best = 0
  for (let ws = weekStart(first); ws <= cw; ws = addDays(ws, 7)) {
    const w = by.get(ws)
    const done = w?.done ?? 0
    const met = done >= goal.min
    const prevRun = run
    run = met ? run + 1 : 0
    best = Math.max(best, run)
    const current = ws === cw
    out.push({
      week_start: ws, week_end: addDays(ws, 6), is_current: current,
      done, n_feito: w?.feito ?? 0, n_parcial: w?.parcial ?? 0, missed: w?.missed ?? 0, planned: 0,
      by_modality: w?.mods ?? {}, goal_min: goal.min, goal_max: goal.max, met,
      status: weekStatus(done, goal.min, goal.max), to_min: Math.max(goal.min - done, 0),
      streak_weeks: met ? run : current ? prevRun : 0, best_streak_weeks: 0,
    })
  }
  for (const w of out) w.best_streak_weeks = best
  return out
}
