import { Check, Footprints } from 'lucide-react'
import { intFmt } from '../lib/format'
import { Meter } from './viz'

/** Referência de passos/dia. Só exibição: passos não entram no gasto (docs/calorias.md). */
export const STEPS_GOAL = 10000

/**
 * Passos do dia contra 10 mil: número + barra. Movimento usa o `fg` neutro (como o gasto na aba Calorias);
 * ao bater a referência a barra vira `ok` com ✓ + texto, nunca só cor. Sem leitura: diz como registrar.
 */
export function StepsStat({ steps, hint, className = '' }: { steps: number | null | undefined; hint?: string; className?: string }) {
  const has = steps != null
  const hit = has && steps >= STEPS_GOAL
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex items-center gap-1.5 text-[13px] text-muted">
          <Footprints size={15} aria-hidden="true" /> Passos
        </span>
        {hit ? (
          <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-ok">
            <Check size={14} strokeWidth={3} aria-hidden="true" /> 10 mil
          </span>
        ) : has ? (
          <span className="text-[13px] tabular-nums text-muted">faltam {intFmt(STEPS_GOAL - steps)}</span>
        ) : null}
      </div>
      {has ? (
        <>
          <p className="text-[22px] font-bold leading-tight tabular-nums">
            {intFmt(steps)}<span className="text-[15px] font-medium text-muted">/{intFmt(STEPS_GOAL)}</span>
          </p>
          <Meter className="mt-1.5" height={6} value={steps} max={STEPS_GOAL} color={hit ? 'var(--color-ok)' : 'var(--color-fg)'}
            label={`Passos: ${intFmt(steps)} de ${intFmt(STEPS_GOAL)}`} />
        </>
      ) : (
        <p className="mt-0.5 text-[15px] text-muted">{hint ?? 'Sem leitura. Mande os passos no chat.'}</p>
      )}
    </div>
  )
}
