import type { SetLog, TemplateExercise } from './types'

/**
 * Progresso de um treino de ficha. Exercício pulado deixa de cobrar as séries que faltavam
 * (o anel pode fechar), mas o treino fica `parcial`: pular nunca conta como feito.
 */
export function sessionProgress(exercises: TemplateExercise[], logged: Pick<SetLog, 'exercise_id' | 'warmup'>[], skipped: Set<string>) {
  const work = logged.filter((s) => !s.warmup)
  const count = (exId: string) => work.filter((s) => s.exercise_id === exId).length
  const planned = exercises.reduce((n, te) => n + te.sets, 0)
  const target = exercises.reduce((n, te) => n + (skipped.has(te.exercises.id) ? Math.min(count(te.exercises.id), te.sets) : te.sets), 0)
  const done = work.length
  const nSkipped = exercises.filter((te) => skipped.has(te.exercises.id)).length
  const status: 'feito' | 'parcial' = nSkipped === 0 && done / Math.max(1, planned) >= 0.8 ? 'feito' : 'parcial'
  /** exercício resolvido = todas as séries feitas ou pulado */
  const settled = (te: TemplateExercise) => skipped.has(te.exercises.id) || count(te.exercises.id) >= te.sets
  return { planned, target, done, nSkipped, status, count, settled }
}
