import type { SetLog, TemplateExercise } from './types'

/**
 * Progresso de um treino de ficha. Exercício pulado deixa de cobrar as séries que faltavam
 * (o anel pode fechar). Pular um exercício obrigatório deixa o treino `parcial`; pular um opcional
 * (ou deixar de fora as séries opcionais) não: a ficha já diz que pode.
 */
export function sessionProgress(
  exercises: TemplateExercise[], logged: Pick<SetLog, 'exercise_id' | 'warmup'>[], skipped: Set<string>,
) {
  const work = logged.filter((s) => !s.warmup)
  const count = (exId: string) => work.filter((s) => s.exercise_id === exId).length
  const planned = exercises.reduce((n, te) => n + te.sets, 0)
  const target = exercises.reduce((n, te) => n + (skipped.has(te.exercises.id) ? Math.min(count(te.exercises.id), te.sets) : te.sets), 0)
  const done = work.length
  const nSkipped = exercises.filter((te) => skipped.has(te.exercises.id)).length
  /** séries que contam para "feito": sem os exercícios opcionais e sem as últimas séries opcionais */
  const required = exercises.reduce((n, te) => n + (te.optional ? 0 : te.sets - (te.optional_sets ?? 0)), 0)
  const requiredDone = exercises.reduce((n, te) => n + (te.optional ? 0 : Math.min(count(te.exercises.id), te.sets - (te.optional_sets ?? 0))), 0)
  const skippedRequired = exercises.some((te) => !te.optional && skipped.has(te.exercises.id))
  const status: 'feito' | 'parcial' = !skippedRequired && requiredDone / Math.max(1, required) >= 0.8 ? 'feito' : 'parcial'
  /** exercício resolvido = todas as séries feitas ou pulado */
  const settled = (te: TemplateExercise) => skipped.has(te.exercises.id) || count(te.exercises.id) >= te.sets
  return { planned, target, done, nSkipped, status, count, settled }
}
