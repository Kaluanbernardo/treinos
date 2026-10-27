import { Flame, PlayCircle } from 'lucide-react'
import type { ExerciseSession, Template, TemplateExercise } from '../lib/types'
import { kgFmt, restLabel } from '../lib/format'
import { Spark } from './viz'

export function repsLabel(te: Pick<TemplateExercise, 'reps_min' | 'reps_max' | 'reps_unit' | 'per_side'>) {
  if (te.reps_unit === 'max') return 'máx.'
  const range = te.reps_min == null ? 'máx.' : te.reps_max && te.reps_max !== te.reps_min ? `${te.reps_min}–${te.reps_max}` : `${te.reps_min}`
  const unit = te.reps_unit === 's' ? ' s' : te.reps_unit === 'm' ? ' m' : ''
  return `${range}${unit}${te.per_side ? '/lado' : ''}`
}

export function targetLine(te: TemplateExercise) {
  return [
    `${te.sets} × ${repsLabel(te)}`,
    te.rir ? `RIR ${te.rir}` : null,
    restLabel(te.rest_s_min, te.rest_s_max) ? `descanso ${restLabel(te.rest_s_min, te.rest_s_max)}` : null,
  ].filter(Boolean).join(' · ')
}

/** Ficha somente leitura (Treino e Agenda). Com `history`, cada exercício mostra a última melhor série e a curva de 1RM. */
export function FichaDetail({ template, history }: { template: Template; history?: Map<string, ExerciseSession[]> }) {
  return (
    <div>
      {template.warmup && (
        <p className="flex gap-2 rounded-2xl bg-card-2 px-4 py-3 text-[15px] text-muted">
          <Flame size={18} className="mt-0.5 shrink-0 text-kcal" aria-hidden="true" />
          <span className="line-clamp-3"><span className="font-medium text-fg">Aquecimento</span> · {template.warmup}</span>
        </p>
      )}
      {template.note && <p className="mt-3 text-[15px] text-warn">{template.note}</p>}
      <ol className="mt-2 divide-y divide-line">
        {template.template_exercises.map((te) => {
          const h = history?.get(te.exercises.id) ?? []
          const last = h[h.length - 1]
          const e1rm = h.map((r) => r.top_e1rm).filter((v): v is number => v != null)
          const rest = restLabel(te.rest_s_min, te.rest_s_max)
          return (
            <li key={te.id} className="flex items-center gap-3 py-3.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card-2 text-sm font-semibold tabular-nums text-muted" aria-hidden="true">{te.position}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-snug">{te.exercises.name}</p>
                <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-[15px] text-muted">
                  <span className="text-lg font-bold tabular-nums text-fg">{te.sets}×{repsLabel(te)}</span>
                  {te.rir && <span>RIR {te.rir}</span>}
                  {rest && <span>· {rest}</span>}
                </p>
                {(last?.top_kg || te.carga_alvo != null || te.note) && (
                  <p className="mt-0.5 text-sm text-muted">
                    {last?.top_kg ? <>último <b className="font-semibold text-fg tabular-nums">{kgFmt(last.top_kg)}×{last.top_reps}</b></>
                      : te.carga_alvo != null ? <>alvo <b className="font-semibold text-fg tabular-nums">{kgFmt(te.carga_alvo)} kg</b></> : null}
                    {te.note && <>{(last?.top_kg || te.carga_alvo != null) && ' · '}{te.note}</>}
                  </p>
                )}
              </div>
              {e1rm.length >= 2 && <Spark values={e1rm.slice(-8)} color="var(--color-lime)" width={56} height={28} label={`1RM estimado de ${te.exercises.name} nas últimas sessões`} />}
              {te.exercises.video_url && (
                <a
                  href={te.exercises.video_url} target="_blank" rel="noreferrer"
                  className="-my-1 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-card-2 hover:text-fg"
                  aria-label={`Vídeo de execução: ${te.exercises.name}`}
                >
                  <PlayCircle size={24} aria-hidden="true" />
                </a>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** Histórico por exercício (ordem cronológica) para a ficha. */
export function historyByExercise(rows: ExerciseSession[] | undefined) {
  const m = new Map<string, ExerciseSession[]>()
  for (const r of rows ?? []) m.set(r.exercise_id, [...(m.get(r.exercise_id) ?? []), r])
  return m
}
