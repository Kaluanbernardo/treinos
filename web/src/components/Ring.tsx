import { useEffect, useState, type ReactNode } from 'react'

/**
 * Anel em SVG (stroke-dasharray): trilho `line`, arco arredondado na cor da métrica,
 * arco extra em âmbar acima da meta. Cresce ao abrir (respeita reduced-motion via CSS).
 */
export function Ring({ value, target, color, size = 120, stroke = 12, children, label }: {
  value: number; target: number | null; color: string; size?: number; stroke?: number; children?: ReactNode; label: string
}) {
  const [shown, setShown] = useState(0)
  useEffect(() => { const t = requestAnimationFrame(() => setShown(value)); return () => cancelAnimationFrame(t) }, [value])
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const frac = target ? Math.min(1, shown / target) : 0
  const over = target && shown > target ? Math.min(1, (shown - target) / target) : 0
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line)" strokeWidth={stroke} />
        {target ? (
          <circle className="ring-arc" cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} opacity={frac === 0 ? 0 : 1} />
        ) : null}
        {over > 0 && (
          <circle className="ring-arc" cx={size / 2} cy={size / 2} r={r - stroke * 0.95} fill="none" stroke="var(--color-warn)"
            strokeWidth={stroke * 0.45} strokeLinecap="round" strokeDasharray={2 * Math.PI * (r - stroke * 0.95)}
            strokeDashoffset={2 * Math.PI * (r - stroke * 0.95) * (1 - over)} />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}
