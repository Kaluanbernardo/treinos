import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { todaySP } from './format'
import type {
  BodyMetric, BotNote, DailyNutrition, ExerciseSession, FoodLog, MonthlySummary, MuscleVolumeWeek,
  NutritionTargets, PeriodSummary, PlanItem, PrRow, PrevBest, PrevSet, ProgressPhoto, Recomposition,
  SessionRow, SessionStatus, SetLog, Streak, Template, WeightPoint,
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
  'id, slug, name, modality, warmup, note, est_minutes, template_exercises(id, position, sets, reps_min, reps_max, reps_unit, per_side, rir, rest_s_min, rest_s_max, carga_alvo, warmup, note, exercises(id, slug, name, muscle_group, main_lift, video_url, tips))'

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

export const useSessionSets = (id: string) =>
  useQuery({
    queryKey: ['sets', id],
    queryFn: () => rows<SetLog>(db().from('set_logs').select('*').eq('session_id', id).order('logged_at')),
  })

export const usePrevSets = (id: string) =>
  useQuery({
    queryKey: ['prev_sets', id],
    staleTime: Infinity,
    queryFn: () => rows<PrevSet>(db().rpc('prev_sets', { p_session: id })),
  })

export const usePrevBests = (id: string) =>
  useQuery({
    queryKey: ['prev_bests', id],
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

/** Invalida tudo que depende de sessões/séries (Hoje, Agenda, Evolução). */
export function invalidateTraining(qc: QueryClient) {
  for (const k of ['v_today', 'v_week', 'plan', 'v_sessions', 'active_session', 'session', 'v_e1rm_session',
    'v_prs', 'v_streaks', 'v_weekly_summary', 'v_monthly_summary', 'v_recomposition', 'muscle_volume', 'session_exercises', 'session_prs'])
    qc.invalidateQueries({ queryKey: [k] })
}

export interface StartSessionInput {
  template_id: string | null
  modality: PlanItem['modality']
  slot_id?: string | null
  override_id?: string | null
}

export function useStartSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: StartSessionInput) => {
      const id = crypto.randomUUID()
      const { error } = await db().from('sessions').insert({
        id, date: todaySP(), status: 'em_andamento', started_at: new Date().toISOString(), source: 'app',
        template_id: input.template_id, modality: input.modality,
        slot_id: input.slot_id ?? null, override_id: input.override_id ?? null,
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

export function useFinishSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'feito' | 'parcial' }) => {
      const { error } = await db().from('sessions').update({ status, ended_at: new Date().toISOString() }).eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSettled: () => invalidateTraining(qc),
  })
}

export function useLogSet(sessionId: string) {
  const qc = useQueryClient()
  const key = ['sets', sessionId]
  return useMutation({
    mutationFn: async (s: SetLog) => {
      const { error } = await db().from('set_logs').insert({
        id: s.id, session_id: s.session_id, exercise_id: s.exercise_id, set_number: s.set_number,
        kg: s.kg, reps: s.reps, logged_at: s.logged_at, source: 'app',
      })
      if (error) throw new Error(error.message)
    },
    onMutate: async (s) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<SetLog[]>(key)
      qc.setQueryData<SetLog[]>(key, (old = []) => [...old, s])
      return { prev }
    },
    onError: (_e, _s, ctx) => qc.setQueryData(key, ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
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

export const useFoodLogs = (date: string) =>
  useQuery({
    queryKey: ['food_logs', date],
    queryFn: () => rows<FoodLog>(db().from('food_logs').select('*').eq('date', date).order('logged_at')),
  })

export function useToggleCreatine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ date, value }: { date: string; value: boolean }) => {
      const { error } = await db().from('daily_checks')
        .upsert({ date, creatine: value, source: 'app' }, { onConflict: 'date' })
      if (error) throw new Error(error.message)
    },
    onMutate: async ({ date, value }) => {
      await qc.cancelQueries({ queryKey: ['v_daily_nutrition'] })
      const prev = qc.getQueryData<DailyNutrition[]>(['v_daily_nutrition'])
      qc.setQueryData<DailyNutrition[]>(['v_daily_nutrition'], (old = []) => {
        const hit = old.some((d) => d.date === date)
        return hit
          ? old.map((d) => (d.date === date ? { ...d, creatine: value } : d))
          : [...old, { date, kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0, n_items: 0, has_estimated: false, food_logged: false, creatine: value, creatine_g: null, water_ml: null }]
      })
      return { prev }
    },
    onError: (_e, _v, ctx) => qc.setQueryData(['v_daily_nutrition'], ctx?.prev),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['v_daily_nutrition'] })
      qc.invalidateQueries({ queryKey: ['v_weekly_summary'] })
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
export const useSignedUrls = (paths: string[]) =>
  useQuery({
    queryKey: ['signed', paths],
    enabled: paths.length > 0,
    staleTime: 8 * 60_000,
    gcTime: 9 * 60_000,
    queryFn: async () => {
      const { data, error } = await db().storage.from('progress').createSignedUrls(paths, 600)
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
