import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Check, CheckCheck } from 'lucide-react'
import { type ProteinBand, scaleMax, zoneSegments } from '../lib/protein'
import { type Macro, macroZoneLabel } from '../lib/macros'
import type { MacroZoneName } from '../lib/types'
import { intFmt } from '../lib/format'
import { Badge } from './ui'

/**
 * Macros por zonas (abaixo · mínimo ok · ideal · acima) em vez de "faltam X g": proteína (docs/proteina.md),
 * carbo e gordura (docs/macros.md). A cor nunca vai sozinha: sempre ícone + palavra.
 */

type ProteinZone = MacroZoneName
const OK_BG: Record<Macro, string> = { protein: 'bg-protein/35', carb: 'bg-carb/35', fat: 'bg-fat/40' }
const FILL: Record<Macro, string> = { protein: 'bg-protein', carb: 'bg-carb', fat: 'bg-fat' }
const OK_TEXT: Record<Macro, string> = { protein: 'text-protein', carb: 'text-carb', fat: 'text-fat' }
const zoneBg = (z: ProteinZone, m: Macro) => (z === 'ok' ? OK_BG[m] : z === 'ideal' ? 'bg-ok/45' : 'bg-warn/30')
const SHORT: Record<ProteinZone, string> = { abaixo: 'abaixo', ok: 'ok', ideal: 'ideal', acima: 'acima' }
// ✓ = mínimo ok, ✓✓ = ideal (nada de traço, que pareceria "menos")
const ICON: Record<ProteinZone, typeof Check> = { abaixo: ArrowDown, ok: Check, ideal: CheckCheck, acima: ArrowUp }

export function ZoneChip({ zone, inProgress = false, macro = 'protein', className = '' }: { zone: ProteinZone; inProgress?: boolean; macro?: Macro; className?: string }) {
  const Icon = ICON[zone]
  const tone = zone === 'ideal' ? 'ok' : zone === 'ok' ? macro : 'warn'
  return (
    <Badge tone={tone} className={className}>
      <Icon size={13} strokeWidth={3} aria-hidden="true" /> {macroZoneLabel(macro, zone, inProgress)}
    </Badge>
  )
}

/** Só a palavra colorida (linhas compactas do Hoje e dos resumos). */
export function ZoneWord({ zone, macro = 'protein', className = '' }: { zone: ProteinZone; macro?: Macro; className?: string }) {
  const Icon = ICON[zone]
  const color = zone === 'ideal' ? 'text-ok' : zone === 'ok' ? OK_TEXT[macro] : 'text-warn'
  return (
    <span className={`inline-flex items-center gap-0.5 text-[13px] font-semibold ${color} ${className}`} title={macroZoneLabel(macro, zone)}>
      <Icon size={13} strokeWidth={3} aria-hidden="true" />{SHORT[zone]}
    </span>
  )
}

/**
 * Barra em duas camadas: em cima o consumido (cor do macro, cresce ao abrir); embaixo a faixa de zonas com os
 * limites em gramas. `compact` esconde os números dos limites. Zona de largura zero (ex.: carbo sem "mínimo ok"
 * num dia de permissão baixa) simplesmente não aparece.
 */
export function MacroZoneBar({ grams, band, macro = 'protein', compact = false, className = '', label }: {
  grams: number; band: ProteinBand; macro?: Macro; compact?: boolean; className?: string; label: string
}) {
  const [shown, setShown] = useState(0)
  useEffect(() => { const t = requestAnimationFrame(() => setShown(grams)); return () => cancelAnimationFrame(t) }, [grams])
  const max = scaleMax(band, grams)
  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`
  const segs = zoneSegments(band, max).filter(([a, b]) => b > a)
  const marks = [...new Set([band.min, band.ideal, band.cap])]
  return (
    <div className={className}>
      <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={Math.round(max)} aria-valuenow={Math.round(grams)}
        className="relative h-2 w-full rounded-full bg-line">
        <div className={`meter-fill absolute inset-y-0 left-0 rounded-full ${FILL[macro]}`} style={{ width: pct(shown) }} aria-hidden="true" />
      </div>
      <div className="mt-1 flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
        {segs.map(([a, b, z]) => <span key={z} className={`h-full ${zoneBg(z, macro)}`} style={{ width: `${((b - a) / max) * 100}%` }} />)}
      </div>
      {!compact && (
        <div className="relative mt-1 h-4 text-[11px] tabular-nums text-muted" aria-hidden="true">
          {marks.map((v) => (
            <span key={v} className="absolute -translate-x-1/2" style={{ left: pct(v) }}>{intFmt(v)}</span>
          ))}
        </div>
      )}
    </div>
  )
}

export const ProteinZoneBar = (p: Omit<Parameters<typeof MacroZoneBar>[0], 'macro'>) => <MacroZoneBar {...p} macro="protein" />

/** Linha de legenda das zonas, com os gramas de cada uma (zonas vazias somem). */
export function ZoneLegend({ band, macro = 'protein', className = '' }: { band: ProteinBand; macro?: Macro; className?: string }) {
  const items: [ProteinZone, string][] = [
    ['abaixo', `< ${band.min}`], ['ok', `${band.min}–${band.ideal - 1}`], ['ideal', `${band.ideal}–${band.cap}`], ['acima', `> ${band.cap}`],
  ]
  return (
    <ul className={`flex flex-wrap gap-x-3 gap-y-1 text-[12px] tabular-nums text-muted ${className}`}>
      {items.filter(([z]) => z !== 'ok' || band.ideal > band.min).map(([z, g]) => (
        <li key={z} className="flex items-center gap-1.5">
          <span className={`h-2 w-3 rounded-sm ${zoneBg(z, macro)}`} aria-hidden="true" />{SHORT[z]} {g} g
        </li>
      ))}
    </ul>
  )
}

export { proteinZone } from '../lib/protein'
