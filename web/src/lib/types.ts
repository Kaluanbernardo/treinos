export type Modality = 'musculacao' | 'muay_thai' | 'jiu_jitsu' | 'cross' | 'funcional'
export type SessionStatus = 'em_andamento' | 'feito' | 'parcial' | 'faltou'

/** Linha de v_today / v_week / plan_with_sessions(). */
export interface PlanItem {
  date: string
  start_time: string
  duration_min: number
  starts_at: string
  ends_at: string
  modality: Modality
  modality_label: string
  title: string
  plan_kind: 'base' | 'substituido' | 'adicionado' | 'pulado'
  active: boolean
  motivo: string | null
  slot_id: string | null
  override_id: string | null
  template_id: string | null
  template_slug: string | null
  template_name: string | null
  template_warmup: string | null
  template_note: string | null
  est_minutes: number | null
  exercise_count: number
  session_id: string | null
  session_status: SessionStatus | null
}

export type Arrow = 'down' | 'flat' | 'up' | null

export interface Recomposition {
  weight_now_kg: number | null
  weight_prev_kg: number | null
  weight_delta_kg: number | null
  weight_pace_pct_week: number | null
  weight_arrow: Arrow
  waist_now_cm: number | null
  waist_prev_cm: number | null
  waist_delta_cm: number | null
  waist_arrow: Arrow
  strength_delta_pct: number | null
  strength_n_exercises: number | null
  strength_arrow: Arrow
  reading: 'no_rumo' | 'deficit_agressivo' | 'plato' | 'alerta_cintura' | 'misto' | 'coletando_dados'
  reading_text: string
}

export interface WeightPoint {
  date: string
  peso_kg: number
  avg_7d: number
  n_7d: number
  delta_7d: number | null
  delta_28d: number | null
  pace_pct_week: number | null
  pace_pct_week_28d: number | null
  max_loss_pct_week: number | null
  above_cap: boolean
}

export interface BodyMetric {
  date: string
  peso_kg: number | null
  cintura_cm: number | null
  abdomen_cm: number | null
  quadril_cm: number | null
  peito_cm: number | null
  braco_cm: number | null
  coxa_cm: number | null
  gordura_pct: number | null
  nota: string | null
}

export interface Exercise {
  id: string
  slug: string
  name: string
  muscle_group: string
  main_lift: boolean
  video_url: string | null
  tips: string | null
}

export interface TemplateExercise {
  id: string
  position: number
  sets: number
  reps_min: number | null
  reps_max: number | null
  reps_unit: 'reps' | 's' | 'm' | 'max'
  per_side: boolean
  rir: string | null
  rest_s_min: number | null
  rest_s_max: number | null
  carga_alvo: number | null
  reps_alvo: number | null
  warmup: string | null
  note: string | null
  exercises: Exercise
}

export interface Template {
  id: string
  slug: string
  name: string
  modality: Modality
  warmup: string | null
  note: string | null
  est_minutes: number | null
  template_exercises: TemplateExercise[]
}

export interface SessionRow {
  id: string
  date: string
  modality: Modality
  modality_label: string
  template_id: string | null
  template_slug: string | null
  title: string
  status: SessionStatus
  started_at: string | null
  ended_at: string | null
  note: string | null
  source: 'app' | 'bot'
  duration_min: number | null
  n_sets: number
  n_exercises: number
  volume_kg: number
  n_prs: number
  /** exercícios pulados (migração 20261028180000; ausente antes dela) */
  n_skipped?: number
}

/** session_exercise_status: estado por exercício dentro da sessão (sem linha = não pulado). */
export interface ExerciseStatus {
  session_id: string
  exercise_id: string
  skipped: boolean
}

export interface SetLog {
  id: string
  session_id: string
  exercise_id: string
  set_number: number
  kg: number | null
  reps: number | null
  warmup: boolean
  logged_at: string
}

export interface PrevSet {
  exercise_id: string
  session_id: string
  date: string
  set_number: number
  kg: number | null
  reps: number | null
}

export interface PrevBest {
  exercise_id: string
  best_kg: number | null
  best_e1rm: number | null
}

/** v_e1rm_session: por sessão × exercício. */
export interface ExerciseSession {
  date: string
  session_id: string
  exercise_id: string
  exercise_name: string
  main_lift: boolean
  n_sets: number
  volume_kg: number
  top_kg: number | null
  top_reps: number | null
  top_e1rm: number | null
  is_volume_pr: boolean
}

/** v_prs (cada série válida com flags). */
export interface PrRow {
  set_id: string
  session_id: string
  date: string
  exercise_id: string
  exercise_name: string
  kg: number
  reps: number
  e1rm: number | null
  is_load_pr: boolean
  is_e1rm_pr: boolean
  is_pr: boolean
}

export interface Streak {
  modality: Modality | 'total'
  current_streak_weeks: number
  best_streak_weeks: number
  weeks_tracked: number
  this_week_planned: number
  this_week_done: number
  sessions_since_miss: number | null
}

export interface PeriodSummary {
  period_start: string
  period_end: string
  planned: number
  done: number
  by_modality: Record<string, { planned: number; done: number }>
  n_sets: number
  volume_kg: number
  n_prs: number
  days_logged: number
  days_in_period: number
  kcal_avg: number | null
  protein_avg_g: number | null
  kcal_target: number | null
  protein_target_min_g: number | null
  protein_target_max_g: number | null
  weight_avg7_end: number | null
  weight_delta_kg: number | null
  waist_last_cm: number | null
  creatine_days: number
}

export interface MonthlySummary extends PeriodSummary {
  first_metrics: Partial<Record<MetricKey, number>> | null
  last_metrics: Partial<Record<MetricKey, number>> | null
  n_photos: number
}

export type MetricKey =
  | 'peso_kg' | 'cintura_cm' | 'abdomen_cm' | 'quadril_cm' | 'peito_cm' | 'braco_cm' | 'coxa_cm' | 'gordura_pct'

export interface DailyNutrition {
  date: string
  kcal: number
  protein_g: number
  carb_g: number
  fat_g: number
  n_items: number
  has_estimated: boolean
  food_logged: boolean
  creatine: boolean
  creatine_g: number | null
  water_ml: number | null
}

export interface NutritionTargets {
  kcal_target: number | null
  ref_weight_kg: number | null
  protein_min_g: number | null
  protein_max_g: number | null
  fat_min_g: number | null
  fat_max_g: number | null
  carb_target_g: number | null
  water_min_ml: number | null
  water_max_ml: number | null
}

export interface FoodLog {
  id: string
  date: string
  meal: string | null
  description: string
  grams: number | null
  portion_label: string | null
  portion_qty: number | null
  kcal: number
  protein_g: number
  carb_g: number
  fat_g: number
  estimated: boolean
  logged_at: string
  note: string | null
}

export interface BotNote {
  id: string
  created_at: string
  kind: 'nota' | 'decisao' | 'carga' | 'remarcacao' | 'alerta' | 'resumo'
  text: string
}

export interface ProgressPhoto {
  id: string
  date: string
  pose: 'frente' | 'lado' | 'costas'
  path: string
  thumb_path: string | null
  nota: string | null
}

export interface MuscleVolumeWeek {
  week_start: string
  muscle_group: string
  n_sets: number
  volume_kg: number
}

/** Linha de v_energy_daily (regra em docs/calorias.md). Basal/gasto/saldo NULL sem perfil completo. */
export interface EnergyDay {
  date: string
  weight_kg: number | null
  height_cm: number | null
  age_years: number | null
  sex: 'M' | 'F' | null
  activity_factor: number
  bmr_kcal: number | null
  daily_life_kcal: number | null
  exercise_watch_kcal: number
  exercise_est_kcal: number
  exercise_kcal: number
  is_estimate: boolean
  n_sessions_estimated: number
  food_kcal: number
  food_logged: boolean
  food_has_estimated: boolean
  out_kcal: number | null
  balance_kcal: number | null
  target_balance_kcal: number | null
  bmr_missing: string[]
}

export interface Profile {
  id: string
  height_cm: number | null
  birth_date: string | null
  sex: 'M' | 'F' | null
  activity_factor: number
}
