import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { addDays, todaySP } from './format'
import { pickPlanLink, type SessionLinkHint } from './planLink'
import { GOAL_DEFAULT, trainingWeeksFrom } from './training'
import { proteinTargetFrom } from './protein'
import type {
  BodyMetric, BotNote, DailyNutrition, EnergyDay, Profile, ExerciseSession, ExerciseStatus, FoodLog, MealPhoto, MonthlySummary, MuscleVolumeWeek,
  NutritionTargets, PeriodSummary, PlanItem, PrRow, PrevBest, PrevSet, ProgressPhoto, ProteinTarget, Recomposition,
  SessionRow, SessionStatus, SetLog, Streak, Template, TrainingWeek, WeightPoint,
} from './types'

function db() {
  if (!supabase) throw new Error('Supabase não configurado')
  return supabase
}

async function rows<T>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await p
  if (error) throw new Error(error.message)
  return (data ?? []) as T[]
}

const one = async <T,>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>) =>
  ((await rows<T>(p))[0] ?? null) as T | null

// ---------------------------------------------------------------- plano
export const useToday = () =>
  useQuery({ queryKey: ['v_today'], queryFn: () => rows<PlanItem>(db().from('v_today').select('*').order('start_time')) })

export const useWeek = () =>
  useQuery({
    queryKey: ['v_week'],
    queryFn: () => rows<PlanItem>(db().from('v_week').select('*').order('date').order('start_time')),
  })

export const usePlan = (from: string, to: string) =>
  useQuery({
    queryKey: ['plan', from, to],
    queryFn: () =>
      rows<PlanItem>(db().rpc('plan_with_sessions', { p_from: from, p_to: to }).order('date').order('start_time')),
  })

// ---------------------------------------------------------------- treino
const TEMPLATE_SELECT =
  'id, slug, name, modality, warmup, note, est_minutes, template_exercises(id, position, sets, reps_min, reps_max, reps_unit, per_side, rir, rest_s_min, rest_s_max, carga_alvo, reps_alvo, warmup, note, exercises(id, slug, name, muscle_group, main_lift, video_url, tips))'

const sortTemplate = (t: Template) => ({
  ...t,
  template_exercises: [...t.template_exercises].sort((a, b) => a.position - b.position),
})

export const useTemplates = () =>
  useQuery({
    queryKey: ['templates'],
    staleTime: 5 * 60_000,
    queryFn: async () =>
      (await rows<Template>(db().from('workout_templates').select(TEMPLATE_SELECT).order('slug'))).map(sortTemplate),
  })

export const useSessions = (limit = 30) =>
  useQuery({
    queryKey: ['v_sessions', limit],
    queryFn: () =>
      rows<SessionRow>(
        db().from('v_sessions').select('*').order('date', { ascending: false }).order('started_at', { ascending: false, nullsFirst: false }).limit(limit),
      ),
  })

/** Todas as sessões (só as colunas da contagem por ficha e do mapa de calor). Uma pessoa: poucas centenas de linhas. */
export const useAllSessions = () =>
  useQuery({
    queryKey: ['v_sessions', 'all'],
    queryFn: () =>
      rows<SessionRow>(db().from('v_sessions').select('id, date, status, title, modality, template_id, started_at').order('date')),
  })

/**
 * View nova que ainda não chegou no banco (migração não aplicada): o PostgREST responde PGRST205
 * "Could not find the table ... in the schema cache". Só nesse caso o app calcula a mesma regra no cliente.
 */
const missingView = (e: unknown) => /PGRST205|Could not find the (table|relation)|does not exist/i.test(String((e as Error)?.message ?? e))

/** goals como objeto livre: colunas novas podem não existir ainda (migração pendente). */
const goalsRow = () => one<Record<string, unknown>>(db().from('goals').select('*').limit(1))
const numOr = (v: unknown, d: number) => (v == null || v === '' || Number.isNaN(Number(v)) ? d : Number(v))

/** Meta semanal (v_training_weeks): 1 linha por semana, a última é a atual. */
export const useTrainingWeeks = () =>
  useQuery({
    queryKey: ['v_training_weeks'],
    queryFn: async () => {
      try {
        return await rows<TrainingWeek>(db().from('v_training_weeks').select('*').order('week_start'))
      } catch (e) {
        if (!missingView(e)) throw e
        const [sessions, g] = await Promise.all([
          rows<Pick<SessionRow, 'date' | 'status' | 'modality'>>(db().from('sessions').select('date, status, modality').order('date')),
          goalsRow(),
        ])
        return trainingWeeksFrom(sessions, { min: numOr(g?.weekly_sessions_min, GOAL_DEFAULT.min), max: numOr(g?.weekly_sessions_max, GOAL_DEFAULT.max) }, todaySP())
      }
    },
  })

/** Semana atual da meta (última linha de v_training_weeks). */
export function useWeekGoal() {
  const q = useTrainingWeeks()
  const cur = q.data?.find((w) => w.is_current) ?? q.data?.[q.data.length - 1] ?? null
  return { ...q, week: cur }
}

export const useActiveSession = () =>
  useQuery({
    queryKey: ['active_session'],
    queryFn: () =>
      one<SessionRow>(
        db().from('v_sessions').select('*').eq('status', 'em_andamento').order('started_at', { ascending: false }).limit(1),
      ),
  })

export const useSession = (id: string) =>
  useQuery({ queryKey: ['session', id], queryFn: () => one<SessionRow>(db().from('v_sessions').select('*').eq('id', id)) })

export const useSessionSets = (id: string | null) =>
  useQuery({
    queryKey: ['sets', id],
    enabled: !!id,
    queryFn: () => rows<SetLog>(db().from('set_logs').select('*').eq('session_id', id).order('logged_at')),
  })

export const usePrevSets = (id: string) =>
  useQuery({
    queryKey: ['prev_sets', id],
    staleTime: Infinity,
    queryFn: () => rows<PrevSet>(db().rpc('prev_sets', { p_session: id })),
  })

export const usePrevBests = (id: string | null) =>
  useQuery({
    queryKey: ['prev_bests', id],
    enabled: !!id,
    staleTime: Infinity,
    queryFn: () => rows<PrevBest>(db().rpc('prev_bests', { p_session: id })),
  })

export const useSessionExercises = (id: string) =>
  useQuery({
    queryKey: ['session_exercises', id],
    queryFn: () => rows<ExerciseSession>(db().from('v_e1rm_session').select('*').eq('session_id', id)),
  })

export const useSessionPrs = (id: string) =>
  useQuery({
    queryKey: ['session_prs', id],
    queryFn: () => rows<PrRow>(db().from('v_prs').select('*').eq('session_id', id).eq('is_pr', true)),
  })

/**
 * Exercícios pulados da sessão. Antes da migração 20261028180000 a tabela não existe: devolve vazio
 * em vez de derrubar a tela do treino.
 */
export const useSkips = (id: string | null) =>
  useQuery({
    queryKey: ['skips', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await db().from('session_exercise_status').select('session_id, exercise_id, skipped').eq('session_id', id!)
      if (error) {
        if (/session_exercise_status|PGRST205|42P01/.test(`${error.message} ${(error as { code?: string }).code ?? ''}`)) return new Set<string>()
        throw new Error(error.message)
      }
      return new Set((data as ExerciseStatus[]).filter((r) => r.skipped).map((r) => r.exercise_id))
    },
  })

/** Pular / desfazer pular um exercício (upsert por sessão + exercício). */
export function useSkipExercise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: ExerciseStatus) => {
      const { error } = await db().from('session_exercise_status')
        .upsert({ session_id: v.session_id, exercise_id: v.exercise_id, skipped: v.skipped, source: 'app' }, { onConflict: 'session_id,exercise_id' })
      if (error) throw new Error(error.message)
    },
    onMutate: async (v) => {
      const key = ['skips', v.session_id]
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<Set<string>>(key)
      const next = new Set(prev)
      if (v.skipped) next.add(v.exercise_id); else next.delete(v.exercise_id)
      qc.setQueryData(key, next)
      return { prev }
    },
    onError: (_e, v, ctx) => qc.setQueryData(['skips', v.session_id], ctx?.prev),
    onSettled: (_d, _e, v) => {
      qc.invalidateQueries({ queryKey: ['skips', v.session_id] })
      qc.invalidateQueries({ queryKey: ['session', v.session_id] })
      qc.invalidateQueries({ queryKey: ['v_sessions'] })
    },
  })
}

/** Invalida tudo que depende de sessões/séries (Hoje, Agenda, Evolução, gasto estimado em Calorias). */
export function invalidateTraining(qc: QueryClient) {
  for (const k of ['v_today', 'v_week', 'plan', 'v_sessions', 'active_session', 'session', 'v_e1rm_session',
    'v_prs', 'v_streaks', 'v_weekly_summary', 'v_monthly_summary', 'v_recomposition', 'muscle_volume', 'session_exercises', 'session_prs', 'v_energy_daily',
    'v_training_weeks'])
    qc.invalidateQueries({ queryKey: [k] })
}

export interface StartSessionInput {
  template_id: string | null
  modality: PlanItem['modality']
  slot_id?: string | null
  override_id?: string | null
}

/** Slot/override do plano do dia quando a sessão ainda não tem horário. Falha de leitura não impede o treino. */
async function loosePlanLink(session: SessionLinkHint & { date: string }) {
  try {
    const plan = await rows<PlanItem>(db().rpc('plan_with_sessions', { p_from: session.date, p_to: session.date }))
    const item = pickPlanLink(plan, session)
    if (!item || (!item.slot_id && !item.override_id)) return null
    return { slot_id: item.slot_id, override_id: item.override_id }
  } catch {
    return null
  }
}

export function useStartSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: StartSessionInput) => {
      const id = crypto.randomUUID()
      let slot_id = input.slot_id ?? null
      let override_id = input.override_id ?? null
      // ficha aberta sem o horário do plano: liga se houver um único item compatível hoje
      if (!slot_id && !override_id) {
        const link = await loosePlanLink({
          date: todaySP(), modality: input.modality, template_id: input.template_id, started_at: new Date().toISOString(),
        })
        if (link) ({ slot_id, override_id } = link)
      }
      const { error } = await db().from('sessions').insert({
        id, date: todaySP(), status: 'em_andamento', started_at: new Date().toISOString(), source: 'app',
        template_id: input.template_id, modality: input.modality, slot_id, override_id,
      })
      if (error) throw new Error(error.message)
      return id
    },
    onSuccess: () => invalidateTraining(qc),
  })
}

/** Feito / Faltei de uma aula (ou de um treino que não foi registrado série a série). */
export function useMarkSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ item, status }: { item: PlanItem; status: Extract<SessionStatus, 'feito' | 'faltou'> }) => {
      const id = crypto.randomUUID()
      const { error } = await db().from('sessions').insert({
        id, date: item.date, status, modality: item.modality, template_id: item.template_id,
        slot_id: item.slot_id, override_id: item.override_id, source: 'app',
      })
      if (error) throw new Error(error.message)
      return id
    },
    onMutate: async ({ item, status }) => {
      // otimista: o cartão muda na hora
      for (const key of [['v_today'], ['v_week']]) {
        qc.setQueryData<PlanItem[]>(key, (old) =>
          old?.map((p) => (p.date === item.date && p.start_time === item.start_time && p.title === item.title
            ? { ...p, session_status: status, session_id: 'pending' } : p)))
      }
    },
    onSettled: () => invalidateTraining(qc),
  })
}

export function useDeleteSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().from('sessions').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSettled: () => invalidateTraining(qc),
  })
}

export interface FinishInput {
  id: string
  status: 'feito' | 'parcial'
  /** data da sessão (para a linha de exercise_kcal); obrigatória quando há kcal */
  date?: string
  startedAt?: string | null
  /** minutos de treino informados no fim; vazio = até agora */
  durationMin?: number | null
  /** kcal ATIVAS do relógio; vazio = sem leitura (Calorias estima pela duração) */
  kcal?: number | null
}

/**
 * Fecha a sessão. A duração informada vira ended_at = started_at + minutos (o v_sessions calcula
 * duration_min daí); as kcal do relógio vão para exercise_kcal (uma linha por sessão).
 */
export function useFinishSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: FinishInput) => {
      const now = Date.now()
      const start = v.startedAt ? Date.parse(v.startedAt) : null
      const patch: Record<string, unknown> = { status: v.status, ended_at: new Date(now).toISOString() }
      if (v.durationMin != null) {
        if (start != null) patch.ended_at = new Date(start + v.durationMin * 60_000).toISOString()
        else patch.started_at = new Date(now - v.durationMin * 60_000).toISOString()
      }
      const { error } = await db().from('sessions').update(patch).eq('id', v.id)
      if (error) throw new Error(error.message)
      if (v.kcal != null && v.date) await saveSessionKcal(v.id, v.date, v.kcal, 'treino salvo, mas as kcal não')
      await linkFinishedSession(v.id)
      return patch
    },
    onSuccess: (patch, v) => {
      // a tela troca para o resumo sem esperar o refetch
      qc.setQueryData<SessionRow | null>(['session', v.id], (old) => (old ? {
        ...old, ...patch,
        duration_min: v.durationMin ?? (old.started_at ? Math.round((Date.parse(patch.ended_at as string) - Date.parse(old.started_at)) / 60_000) : null),
      } : old))
      if (v.kcal != null && v.date) qc.setQueryData(['session_kcal', v.id], v.kcal)
    },
    onSettled: (_d, _e, v) => {
      invalidateTraining(qc)
      qc.invalidateQueries({ queryKey: ['session_kcal', v.id] })
    },
  })
}

/**
 * Sessão fechada sem horário passa a apontar para o item do plano do dia (ficha, ou a única
 * atividade da modalidade). O status na home não depende desse vínculo; ele só evita divergir de novo.
 */
async function linkFinishedSession(id: string) {
  try {
    const row = await one<{ date: string; modality: PlanItem['modality']; template_id: string | null; slot_id: string | null; override_id: string | null; started_at: string | null }>(
      db().from('sessions').select('date, modality, template_id, slot_id, override_id, started_at').eq('id', id).limit(1),
    )
    if (!row || row.slot_id || row.override_id) return
    const link = await loosePlanLink({ id, date: row.date, modality: row.modality, template_id: row.template_id, started_at: row.started_at })
    if (!link) return
    const { error } = await db().from('sessions').update(link).eq('id', id).is('slot_id', null).is('override_id', null)
    if (error) throw new Error(error.message)
  } catch {
    // o treino já foi salvo; a home lê a sessão do dia mesmo sem slot
  }
}

/** Grava as kcal do relógio da sessão (uma linha por session_id em exercise_kcal). */
async function saveSessionKcal(sessionId: string, date: string, kcal: number, failMsg: string) {
  // índice único parcial (session_id where not null): upsert do PostgREST não o enxerga
  const cur = await one<{ id: string }>(db().from('exercise_kcal').select('id').eq('session_id', sessionId).limit(1))
  const { error } = cur
    ? await db().from('exercise_kcal').update({ kcal, date, source: 'app' }).eq('id', cur.id)
    : await db().from('exercise_kcal').insert({ session_id: sessionId, date, kcal, source: 'app' })
  if (error) throw new Error(`${failMsg}: ${error.message}`)
}

export interface SessionStatsInput {
  id: string
  date: string
  startedAt: string | null
  endedAt: string | null
  durationMin: number
  kcal: number
}

/**
 * Corrige duração e kcal do relógio de um treino já fechado (tela de resumo). A duração ancora no
 * started_at (ended_at = início + minutos); sem início, no ended_at; sem nenhum dos dois (registro
 * pelo chat), termina agora se for de hoje, senão começa ao meio-dia do dia do treino.
 */
export function useEditSessionStats() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: SessionStatsInput) => {
      const ms = v.durationMin * 60_000
      const iso = (t: number) => new Date(t).toISOString()
      let patch: { started_at: string; ended_at: string }
      if (v.startedAt) patch = { started_at: v.startedAt, ended_at: iso(Date.parse(v.startedAt) + ms) }
      else if (v.endedAt) patch = { started_at: iso(Date.parse(v.endedAt) - ms), ended_at: v.endedAt }
      else {
        const end = v.date === todaySP() ? Date.now() : Date.parse(`${v.date}T12:00:00-03:00`) + ms
        patch = { started_at: iso(end - ms), ended_at: iso(end) }
      }
      const { error } = await db().from('sessions').update(patch).eq('id', v.id)
      if (error) throw new Error(error.message)
      await saveSessionKcal(v.id, v.date, v.kcal, 'duração salva, mas as kcal não')
      return patch
    },
    onSuccess: (patch, v) => {
      qc.setQueryData<SessionRow | null>(['session', v.id], (old) => (old ? { ...old, ...patch, duration_min: v.durationMin } : old))
      qc.setQueryData(['session_kcal', v.id], v.kcal)
    },
    onSettled: (_d, _e, v) => {
      invalidateTraining(qc)
      qc.invalidateQueries({ queryKey: ['session_kcal', v.id] })
    },
  })
}

/** kcal ativas do relógio registradas para a sessão (null = sem leitura). */
export const useSessionKcal = (id: string) =>
  useQuery({
    queryKey: ['session_kcal', id],
    queryFn: async () => (await one<{ kcal: number }>(db().from('exercise_kcal').select('kcal').eq('session_id', id).limit(1)))?.kcal ?? null,
  })

/** Registra uma série. A chave do cache vem da própria série: funciona logo após criar a sessão. */
export function useLogSet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (s: SetLog) => {
      const { error } = await db().from('set_logs').insert({
        id: s.id, session_id: s.session_id, exercise_id: s.exercise_id, set_number: s.set_number,
        kg: s.kg, reps: s.reps, logged_at: s.logged_at, source: 'app',
      })
      if (error) throw new Error(error.message)
    },
    onMutate: async (s) => {
      const key = ['sets', s.session_id]
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<SetLog[]>(key)
      qc.setQueryData<SetLog[]>(key, (old = []) => [...old, s])
      return { prev }
    },
    onError: (_e, s, ctx) => qc.setQueryData(['sets', s.session_id], ctx?.prev),
    onSettled: (_d, _e, s) => {
      qc.invalidateQueries({ queryKey: ['sets', s.session_id] })
      qc.invalidateQueries({ queryKey: ['active_session'] })
    },
  })
}

export function useDeleteSet(sessionId: string) {
  const qc = useQueryClient()
  const key = ['sets', sessionId]
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().from('set_logs').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<SetLog[]>(key)
      qc.setQueryData<SetLog[]>(key, (old = []) => old.filter((s) => s.id !== id))
      return { prev }
    },
    onError: (_e, _id, ctx) => qc.setQueryData(key, ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}

// ---------------------------------------------------------------- evolução
export const useRecomposition = () =>
  useQuery({ queryKey: ['v_recomposition'], queryFn: () => one<Recomposition>(db().from('v_recomposition').select('*')) })

export const useWeightTrend = () =>
  useQuery({ queryKey: ['v_weight_trend'], queryFn: () => rows<WeightPoint>(db().from('v_weight_trend').select('*').order('date')) })

export const useBodyMetrics = () =>
  useQuery({ queryKey: ['body_metrics'], queryFn: () => rows<BodyMetric>(db().from('body_metrics').select('*').order('date')) })

export const useExerciseSessions = () =>
  useQuery({
    queryKey: ['v_e1rm_session'],
    queryFn: () => rows<ExerciseSession>(db().from('v_e1rm_session').select('*').order('date')),
  })

/** Só as séries que bateram recorde (lista de PRs). */
export const usePrs = () =>
  useQuery({
    queryKey: ['v_prs'],
    queryFn: () =>
      rows<PrRow>(db().from('v_prs').select('*').eq('is_pr', true).order('date', { ascending: false }).order('logged_at', { ascending: false })),
  })

export const useStreaks = () =>
  useQuery({ queryKey: ['v_streaks'], queryFn: () => rows<Streak>(db().from('v_streaks').select('*')) })

export const useWeeklySummary = () =>
  useQuery({ queryKey: ['v_weekly_summary'], queryFn: () => rows<PeriodSummary>(db().from('v_weekly_summary').select('*').order('period_start')) })

export const useMonthlySummary = () =>
  useQuery({ queryKey: ['v_monthly_summary'], queryFn: () => rows<MonthlySummary>(db().from('v_monthly_summary').select('*').order('period_start')) })

export const useMuscleVolume = () =>
  useQuery({
    queryKey: ['muscle_volume'],
    queryFn: () => rows<MuscleVolumeWeek>(db().from('v_muscle_volume_weekly').select('*').order('week_start')),
  })

// ---------------------------------------------------------------- nutrição
export const useDailyNutrition = () =>
  useQuery({ queryKey: ['v_daily_nutrition'], queryFn: () => rows<DailyNutrition>(db().from('v_daily_nutrition').select('*').order('date')) })

export const useNutritionTargets = () =>
  useQuery({
    queryKey: ['v_nutrition_targets'],
    staleTime: 5 * 60_000,
    queryFn: () => one<NutritionTargets>(db().from('v_nutrition_targets').select('*')),
  })

/** Faixa de proteína do dia (v_protein_target; regra em docs/proteina.md). */
export const useProteinTarget = () =>
  useQuery({
    queryKey: ['v_protein_target'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      try {
        return await one<ProteinTarget>(db().from('v_protein_target').select('*'))
      } catch (e) {
        if (!missingView(e)) throw e
        const [w, pf, g] = await Promise.all([
          one<{ date: string; peso_kg: number }>(db().from('body_metrics').select('date, peso_kg').not('peso_kg', 'is', null).order('date', { ascending: false }).limit(1)),
          one<{ height_cm: number | null }>(db().from('profile').select('height_cm').limit(1)),
          goalsRow(),
        ])
        return proteinTargetFrom({
          weightKg: w?.peso_kg ?? null, weightDate: w?.date ?? null, heightCm: pf?.height_cm ?? null,
          pesoRefKg: g?.peso_ref_kg == null ? null : Number(g.peso_ref_kg),
          gPerKg: { min: g?.protein_min_g_per_kg as number | null, ideal: g?.protein_ideal_g_per_kg as number | null, cap: g?.protein_cap_g_per_kg as number | null },
          bmiMax: g && 'protein_ref_bmi_max' in g ? (g.protein_ref_bmi_max == null ? null : Number(g.protein_ref_bmi_max)) : undefined,
        })
      }
    },
  })

export const useFoodLogs = (date: string) =>
  useQuery({
    queryKey: ['food_logs', date],
    queryFn: () => rows<FoodLog>(db().from('food_logs').select('*').eq('date', date).order('logged_at')),
  })

export const useMealPhotos = (date: string) =>
  useQuery({
    queryKey: ['meal_photos', date],
    queryFn: () => rows<MealPhoto>(db().from('meal_photos').select('*').eq('date', date).order('created_at')),
  })

// ---------------------------------------------------------------- calorias
/** Últimos `days` dias de v_energy_daily (basal + dia a dia + exercício × comida). */
export const useEnergyDaily = (days = 60) =>
  useQuery({
    queryKey: ['v_energy_daily', days],
    queryFn: () =>
      rows<EnergyDay>(db().from('v_energy_daily').select('*').gte('date', addDays(todaySP(), -(days - 1))).order('date')),
  })

/** v_energy_daily de um intervalo fechado de datas (semana ou mês, inclusive os anteriores à janela de 60 dias). */
export const useEnergyRange = (from: string, to: string, enabled = true) =>
  useQuery({
    queryKey: ['v_energy_daily', 'range', from, to],
    enabled,
    queryFn: () =>
      rows<EnergyDay>(db().from('v_energy_daily').select('*').gte('date', from).lte('date', to).order('date')),
  })

/** Passos por dia (daily_checks.steps, via `fit steps`). Só exibição: não entram no gasto. */
export const useDailySteps = (days = 60) =>
  useQuery({
    queryKey: ['daily_steps', days],
    queryFn: async () => {
      const list = await rows<{ date: string; steps: number }>(
        db().from('daily_checks').select('date, steps').not('steps', 'is', null).gte('date', addDays(todaySP(), -(days - 1))).order('date'),
      )
      return new Map(list.map((r) => [r.date, r.steps]))
    },
  })

export const useProfile = () =>
  useQuery({ queryKey: ['profile'], queryFn: () => one<Profile>(db().from('profile').select('id, height_cm, birth_date, sex, activity_factor').limit(1)) })

export function useSaveProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: Pick<Profile, 'id' | 'height_cm' | 'birth_date' | 'sex'>) => {
      const { error } = await db().from('profile')
        .update({ height_cm: v.height_cm, birth_date: v.birth_date, sex: v.sex, source: 'app' }).eq('id', v.id)
      if (error) throw new Error(error.message)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['profile'] })
      qc.invalidateQueries({ queryKey: ['v_energy_daily'] })
      qc.invalidateQueries({ queryKey: ['v_protein_target'] })
    },
  })
}

// ---------------------------------------------------------------- notas, fotos, status
export const useNotes = () =>
  useQuery({
    queryKey: ['bot_notes'],
    queryFn: () => rows<BotNote>(db().from('bot_notes').select('id, created_at, kind, text').order('created_at', { ascending: false }).limit(200)),
  })

export const usePhotos = () =>
  useQuery({ queryKey: ['progress_photos'], queryFn: () => rows<ProgressPhoto>(db().from('progress_photos').select('*').order('date')) })

/** Signed URLs de curta duração (10 min) para o bucket privado `progress`. */
/** Signed URLs (10 min) de um bucket privado: `progress` (fotos de progresso) ou `meals` (refeições). */
export const useSignedUrls = (paths: string[], bucket: 'progress' | 'meals' = 'progress') =>
  useQuery({
    queryKey: ['signed', bucket, paths],
    enabled: paths.length > 0,
    staleTime: 8 * 60_000,
    gcTime: 9 * 60_000,
    queryFn: async () => {
      const { data, error } = await db().storage.from(bucket).createSignedUrls(paths, 600)
      if (error) throw new Error(error.message)
      return Object.fromEntries((data ?? []).map((d) => [d.path ?? '', d.signedUrl])) as Record<string, string>
    },
  })

export const useLastData = () =>
  useQuery({
    queryKey: ['last_data'],
    queryFn: async () => {
      const tables = ['sessions', 'set_logs', 'body_metrics', 'food_logs', 'bot_notes', 'daily_checks'] as const
      const res = await Promise.all(
        tables.map((t) => one<{ updated_at: string }>(db().from(t).select('updated_at').order('updated_at', { ascending: false }).limit(1))),
      )
      const all = res.map((r, i) => ({ table: tables[i], at: r?.updated_at ?? null })).filter((r) => r.at)
      all.sort((a, b) => (a.at! < b.at! ? 1 : -1))
      return all[0] ?? null
    },
  })
