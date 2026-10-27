import { Flame, PlayCircle } from 'lucide-react'
import type { Template, TemplateExercise } from '../lib/types'
import { kgFmt, restLabel } from '../lib/format'

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

/** Ficha somente leitura (Treino e Agenda). */
export function FichaDetail({ template }: { template: Template }) {
  return (
    <div>
      {template.warmup && (
        <p className="flex gap-2 rounded-2xl bg-card-2 p-4 text-[15px] leading-relaxed text-muted">
          <Flame size={18} className="mt-0.5 shrink-0 text-kcal" aria-hidden="true" />
          <span><span className="font-medium text-fg">Aquecimento:</span> {template.warmup}</span>
        </p>
      )}
      {template.note && <p className="mt-3 text-[15px] text-warn">{template.note}</p>}
      <ol className="mt-2 divide-y divide-line">
        {template.template_exercises.map((te) => (
          <li key={te.id} className="flex gap-3 py-3.5">
            <span className="mt-0.5 w-6 shrink-0 text-right font-semibold tabular-nums text-muted">{te.position}</span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{te.exercises.name}</p>
              <p className="mt-0.5 text-[15px] text-muted">{targetLine(te)}</p>
              {(te.carga_alvo != null || te.note) && (
                <p className="mt-0.5 text-sm text-muted">
                  {te.carga_alvo != null && <span className="text-fg">carga-alvo {kgFmt(te.carga_alvo)} kg</span>}
                  {te.carga_alvo != null && te.note && ' · '}
                  {te.note}
                </p>
              )}
            </div>
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
        ))}
      </ol>
    </div>
  )
}
