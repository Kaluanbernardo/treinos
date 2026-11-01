import type { Modality, PlanItem } from './types'

/** O que a sessão precisa para achar o item do plano do dia. */
export interface SessionLinkHint {
  id?: string
  modality: Modality
  template_id: string | null
  started_at?: string | null
}

/**
 * Item do plano ao qual a sessão deve gravar slot_id/override_id.
 * Mesma ficha, se houver uma; senão a única atividade daquela modalidade no dia.
 * Dois horários da mesma modalidade sem a ficha batendo: não chuta (a home já lê o status sem o vínculo).
 */
export function pickPlanLink(items: PlanItem[], session: SessionLinkHint): PlanItem | null {
  const open = items.filter((i) => i.active && (!i.session_id || (session.id != null && i.session_id === session.id)))
  const byTemplate = session.template_id ? open.filter((i) => i.template_id === session.template_id) : []
  if (byTemplate.length === 1) return byTemplate[0]
  if (byTemplate.length > 1) return closest(byTemplate, session.started_at)
  const byModality = open.filter((i) => i.modality === session.modality)
  return byModality.length === 1 ? byModality[0] : null
}

function closest(items: PlanItem[], startedAt?: string | null): PlanItem {
  const t = startedAt ? Date.parse(startedAt) : NaN
  if (Number.isNaN(t)) return [...items].sort((a, b) => a.start_time.localeCompare(b.start_time))[0]
  return items.reduce((best, item) =>
    Math.abs(Date.parse(item.starts_at) - t) < Math.abs(Date.parse(best.starts_at) - t) ? item : best)
}
