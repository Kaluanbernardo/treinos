export type Modality = 'musculacao' | 'muay_thai' | 'jiu_jitsu' | 'cross' | 'funcional'

/** Linha de v_today / v_week (plan_with_sessions). */
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
  template_id: string | null
  template_name: string | null
  est_minutes: number | null
  exercise_count: number
  session_id: string | null
  session_status: 'em_andamento' | 'feito' | 'parcial' | 'faltou' | null
}

export type Arrow = 'down' | 'flat' | 'up' | null

export interface Recomposition {
  weight_now_kg: number | null
  weight_delta_kg: number | null
  weight_arrow: Arrow
  waist_now_cm: number | null
  waist_delta_cm: number | null
  waist_arrow: Arrow
  strength_delta_pct: number | null
  strength_arrow: Arrow
  reading: 'no_rumo' | 'deficit_agressivo' | 'plato' | 'alerta_cintura' | 'misto' | 'coletando_dados'
  reading_text: string
}
