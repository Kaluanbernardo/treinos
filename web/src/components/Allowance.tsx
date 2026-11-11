import { Dumbbell, Hourglass } from 'lucide-react'
import type { DayAllowance } from '../lib/kcal'
import { remainingKcal } from '../lib/kcal'
import { signedInt } from '../lib/balance'
import { intFmt } from '../lib/format'

/**
 * Meta calórica de hoje (docs/calorias.md, "Meta fixa e permissão"): UMA meta, o saldo-alvo fixo (−300), treine
 * ou não. O treino aumenta o que dá para comer (a permissão), não a meta. Sem "com treino / sem treino".
 */

/** "−300" / "±0" e a palavra do saldo-alvo. */
export function targetWords(t: number | null) {
  if (t == null) return { value: '—', word: '' }
  return { value: signedInt(t), word: t < 0 ? 'déficit fixo, treine ou não' : t > 0 ? 'superávit fixo' : 'manutenção, treine ou não' }
}

/** "basal 1.854 + rotina 371 + treino 296 − 300" (a conta da permissão por extenso). */
export function allowanceSum(a: DayAllowance) {
  if (!a.dynamic || a.bmr == null || a.life == null) return null
  const t = a.targetBalance ?? 0
  const nb = (x: string) => x.replace(/ /g, '\u00a0')   // cada parcela inteira na mesma linha
  return [nb(`basal ${intFmt(a.bmr)}`), nb(`+ rotina ${intFmt(a.life)}`), a.exercise > 0 && nb(`+ treino ${intFmt(a.exercise)}`),
    t && nb(`${t < 0 ? '−' : '+'} ${intFmt(Math.abs(t))}`)].filter(Boolean).join(' ')
}

/** Três números (meta · pode consumir · ainda resta), a conta e o que o treino somou. */
export function AllowancePanel({ a, food, showRemaining = true, className = '' }: { a: DayAllowance; food: number; showRemaining?: boolean; className?: string }) {
  const left = remainingKcal(a, food)
  const tw = targetWords(a.targetBalance)
  const sum = allowanceSum(a)
  return (
    <div className={className}>
      <dl className={`grid gap-x-3 gap-y-3 ${showRemaining ? 'grid-cols-[1fr_1.2fr_1fr]' : 'grid-cols-2'}`}>
        <Cell label="Meta do dia" value={tw.value} unit="kcal" sub={a.dynamic ? tw.word : 'meta fixa (sem basal)'} />
        <Cell label="Pode consumir" value={a.allowance != null ? intFmt(a.allowance) : '—'} unit="kcal" sub={a.dynamic ? 'gasto + meta' : 'sem gasto calculado'} />
        {showRemaining && (
          <Cell label={left != null && left < 0 ? 'Passou' : 'Ainda resta'} value={left != null ? intFmt(Math.abs(left)) : '—'} unit="kcal"
            sub={`comido ${intFmt(food)}`} tone={left != null && left < 0 ? 'warn' : undefined} />
        )}
      </dl>
      {sum && <p className="mt-2 text-[13px] leading-snug tabular-nums text-muted">Pode consumir = {sum}</p>}
      <TrainingNote a={a} className="mt-3" />
    </div>
  )
}

/** O que o treino fez na permissão hoje (feito) e o aviso do que ainda vai somar (por fazer). */
export function TrainingNote({ a, className = '' }: { a: DayAllowance; className?: string }) {
  if (!a.dynamic || (a.exercise <= 0 && a.pendingCount === 0)) return null
  const t = a.targetBalance
  return (
    <ul className={`flex flex-col gap-1.5 text-[13px] leading-snug text-muted ${className}`}>
      {a.exercise > 0 && (
        <li className="flex items-start gap-2">
          <Dumbbell size={15} className="mt-px shrink-0 text-fg" aria-hidden="true" />
          <span>O treino de hoje somou <b className="font-semibold tabular-nums text-fg">+{intFmt(a.exercise)} kcal</b> na permissão{a.exerciseEstimated ? ' (estimado)' : ''}. A meta continua {t != null ? signedInt(t) : '—'}.</span>
        </li>
      )}
      {a.pendingCount > 0 && (
        <li className="flex items-start gap-2">
          <Hourglass size={15} className="mt-px shrink-0" aria-hidden="true" />
          <span>{a.pendingTitles.join(' e ')} ainda por fazer: quando registrar, a permissão sobe{a.pendingKcal > 0 ? <> ≈ <span className="tabular-nums">{intFmt(a.pendingKcal)}</span> kcal</> : ''}.</span>
        </li>
      )}
    </ul>
  )
}

function Cell({ label, value, unit, sub, tone }: { label: string; value: string; unit: string; sub?: string; tone?: 'warn' }) {
  return (
    <div className="min-w-0">
      <dt className="whitespace-nowrap text-[13px] text-muted">{label}</dt>
      <dd>
        <span className={`text-[22px] font-bold leading-tight tabular-nums ${tone === 'warn' ? 'text-warn' : ''}`}>{value}</span>
        <span className="ml-1 text-[13px] text-muted">{unit}</span>
        {sub && <span className="block text-[12px] leading-snug text-muted">{sub}</span>}
      </dd>
    </div>
  )
}
