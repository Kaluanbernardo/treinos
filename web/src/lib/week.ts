import type { PlanItem } from './types'
import type { DayMark, WeekDay } from '../components/viz'
import { addDays, capitalize, wdShort } from './format'

/** Estado visual de um item do plano (mesma regra em Hoje e Agenda). */
export function markOf(i: PlanItem): DayMark {
  if (!i.active) return 'skipped'
  if (i.session_status === 'feito' || i.session_status === 'parcial') return 'done'
  if (i.session_status === 'faltou') return 'missed'
  return 'pending' // sem registro (passado) ou a fazer: anel vazio, nunca falta inventada
}

/** Semana de segunda a domingo a partir dos itens do plano. */
export function weekDays(ws: string, items: PlanItem[], today: string): WeekDay[] {
  return Array.from({ length: 7 }, (_, k) => {
    const date = addDays(ws, k)
    return {
      date,
      label: capitalize(wdShort(date)).slice(0, 3),
      marks: items.filter((i) => i.date === date).map((i) => markOf(i)),
      today: date === today,
      future: date > today,
    }
  })
}
