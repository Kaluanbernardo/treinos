import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Check, CheckCheck } from 'lucide-react'
import { type ProteinBand, type ProteinZone, ZONE, proteinZone, scaleMax, zoneLabel, zoneSegments } from '../lib/protein'
import { intFmt } from '../lib/format'
import { Badge } from './ui'

/**
 * Proteína por zonas (abaixo · ok · ideal · acima do teto útil) em vez de "faltam X g".
 * Regra e fontes: lib/protein.ts e docs/proteina.md.
 */

const ZONE_BG: Record<ProteinZone, string> = { abaixo: 'bg-warn/30', ok: 'bg-protein/35', ideal: 'bg-ok/45', acima: 'bg-warn/30' }
// ✓ = mínimo ok, ✓✓ = ideal (nada de traço, que pareceria "menos")
const ICON: Record<ProteinZone, typeof Check> = { abaixo: ArrowDown, ok: Check, ideal: CheckCheck, acima: ArrowUp }

export function ZoneChip({ zone, inProgress = false, className = '' }: { zone: ProteinZone; inProgress?: boolean; className?: string }) {
  const Icon = ICON[zone]
  return (
    <Badge tone={ZONE[zone].tone} className={className}>
      <Icon size={13} strokeWidth={3} aria-hidden="true" /> {zoneLabel(zone, inProgress)}
    </Badge>
  )
}

/** Só a palavra colorida (linhas compactas do Hoje). */
export function ZoneWord({ zone, className = '' }: { zone: ProteinZone; className?: string }) {
  const Icon = ICON[zone]
  const tone = ZONE[zone].tone
  return (
    <span className={`inline-flex items-center gap-0.5 text-[13px] font-semibold ${tone === 'ok' ? 'text-ok' : tone === 'warn' ? 'text-warn' : 'text-protein'} ${className}`}>
      <Icon size={13} strokeWidth={3} aria-hidden="true" />{ZONE[zone].short}
    </span>
  )
}

/**
 * Barra em duas camadas: em cima o consumido (cor da proteína, cresce ao abrir); embaixo a faixa de
 * zonas com os limites em gramas. `compact` esconde os números dos limites.
 */
export function ProteinZoneBar({ grams, band, compact = false, className = '', label }: {
  grams: number; band: ProteinBand; compact?: boolean; className?: string; label: string
}) {
  const [shown, setShown] = useState(0)
  useEffect(() => { const t = requestAnimationFrame(() => setShown(grams)); return () => cancelAnimationFrame(t) }, [grams])
  const max = scaleMax(band, grams)
  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`
  const segs = zoneSegments(band, max)
  return (
    <div className={className}>
      <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={Math.round(max)} aria-valuenow={Math.round(grams)}
        className="relative h-2 w-full rounded-full bg-line">
        <div className="meter-fill absolute inset-y-0 left-0 rounded-full bg-protein" style={{ width: pct(shown) }} aria-hidden="true" />
      </div>
      <div className="mt-1 flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
        {segs.map(([a, b, z]) => <span key={z} className={`h-full ${ZONE_BG[z]}`} style={{ width: `${((b - a) / max) * 100}%` }} />)}
      </div>
      {!compact && (
        <div className="relative mt-1 h-4 text-[11px] tabular-nums text-muted" aria-hidden="true">
          {[band.min, band.ideal, band.cap].map((v) => (
            <span key={v} className="absolute -translate-x-1/2" style={{ left: pct(v) }}>{intFmt(v)}</span>
          ))}
        </div>
      )}
    </div>
  )
}

/** Linha de legenda das zonas, com os gramas de cada uma. */
export function ZoneLegend({ band, className = '' }: { band: ProteinBand; className?: string }) {
  const items: [ProteinZone, string][] = [
    ['abaixo', `< ${band.min}`], ['ok', `${band.min}–${band.ideal - 1}`], ['ideal', `${band.ideal}–${band.cap}`], ['acima', `> ${band.cap}`],
  ]
  return (
    <ul className={`flex flex-wrap gap-x-3 gap-y-1 text-[12px] tabular-nums text-muted ${className}`}>
      {items.map(([z, g]) => (
        <li key={z} className="flex items-center gap-1.5">
          <span className={`h-2 w-3 rounded-sm ${ZONE_BG[z]}`} aria-hidden="true" />{ZONE[z].short} {g} g
        </li>
      ))}
    </ul>
  )
}

export { proteinZone }
