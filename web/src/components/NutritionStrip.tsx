import { ChevronRight } from 'lucide-react'
import { useDailyNutrition, useNutritionTargets, useToggleCreatine } from '../lib/api'
import { go } from '../lib/router'
import { intFmt, todaySP } from '../lib/format'
import { Ring } from './Ring'
import { haptic, toast } from './ui'
import { CreatineButton } from '../screens/Nutricao'

/** Hoje: mini-anéis de kcal/proteína (toque abre Nutrição) + creatina em 1 toque. */
export function NutritionStrip() {
  const daily = useDailyNutrition()
  const targets = useNutritionTargets()
  const toggle = useToggleCreatine()
  const date = todaySP()
  if (daily.isPending || targets.isPending) return null
  const d = daily.data?.find((x) => x.date === date)
  const t = targets.data
  const kcal = d?.kcal ?? 0
  const p = d?.protein_g ?? 0
  const creatine = d?.creatine ?? false

  return (
    <div className="grid grid-cols-1 gap-3">
      <button type="button" onClick={() => go('nutricao')} aria-label="Abrir Nutrição"
        className="flex items-center gap-3 rounded-[var(--radius-card)] bg-card p-4 text-left hover:bg-card-2">
        <Ring value={kcal} target={t?.kcal_target ?? null} color="var(--color-kcal)" size={56} stroke={6} label={`${intFmt(kcal)} kcal`}>
          <span className="text-[11px] font-semibold text-kcal">kcal</span>
        </Ring>
        <Ring value={p} target={t?.protein_min_g ?? null} color="var(--color-protein)" size={56} stroke={6} label={`${intFmt(p)} g de proteína`}>
          <span className="text-[11px] font-semibold text-protein">prot</span>
        </Ring>
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-muted">Nutrição de hoje</span>
          <span className="block text-[17px] font-semibold tabular-nums">{intFmt(kcal)}{t?.kcal_target ? <span className="font-normal text-muted">/{intFmt(t.kcal_target)}</span> : null} kcal</span>
          <span className="block text-[15px] tabular-nums text-muted"><b className="font-semibold text-fg">{intFmt(p)}</b>{t?.protein_min_g ? `/${t.protein_min_g}` : ''} g de proteína</span>
        </span>
        <ChevronRight size={20} className="shrink-0 text-muted" aria-hidden="true" />
      </button>
      <div>
        <CreatineButton on={creatine} onToggle={() => {
          haptic(15)
          toggle.mutate({ date, value: !creatine }, { onError: () => toast('Não salvou a creatina. Tente de novo.', { tone: 'err' }) })
        }} />
      </div>
    </div>
  )
}
