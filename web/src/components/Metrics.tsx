import type { CSSProperties } from 'react'

export interface Metric { label: string; value: string; unit?: string; tone?: string }

// larguras aproximadas no Inter bold tabular (em), com folga: dígito, separador, travessão, resto
const em = (s: string) => [...s].reduce((w, ch) => w + (/\d/.test(ch) ? 0.68 : ch === '.' || ch === ',' ? 0.32 : ch === '—' ? 1 : 0.72), 0) || 1
// unidade em text-sm (14px medium) + o espaço antes dela
const unitPx = (u?: string) => (u ? u.length * 8.5 + 6 : 0)

/**
 * font-size que faz "valor unidade" caber numa linha da célula (container query `cqi`): o menor
 * entre o teto e o que cada item precisa. Mesmo tamanho para todos os itens = linha consistente.
 */
export function fitSize(max: number, items: { value: string; unit?: string; unitPx?: number }[]): string {
  const caps = items.map((m) => `calc((100cqi - ${m.unitPx ?? unitPx(m.unit)}px) / ${em(m.value).toFixed(2)})`)
  return `min(${max}px, ${caps.join(', ')})`
}

/**
 * Números lado a lado em colunas iguais: rótulo em cima, valor com a unidade colada ao lado
 * (nunca quebra, nunca invade a coluna vizinha; o número encolhe se precisar).
 */
export function MetricGrid({ items, max = 26, cols = 3, divided = false, center = false, className = '' }: {
  items: Metric[]; max?: number; cols?: number; divided?: boolean; center?: boolean; className?: string
}) {
  const style: CSSProperties = { fontSize: fitSize(max, items) }
  return (
    <dl className={`grid gap-y-4 ${divided ? '' : 'gap-x-4'} ${className}`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {items.map((m) => (
        <div key={m.label} className={`@container min-w-0 ${center ? 'text-center' : ''} ${
          divided ? `border-l border-line first:border-l-0 ${center ? 'px-2' : 'px-3 first:pl-0 last:pr-0'}` : ''}`}>
          <dt className="truncate text-[13px] text-muted">{m.label}</dt>
          <dd className={`mt-1 whitespace-nowrap font-bold leading-none tracking-[-0.02em] tabular-nums ${m.tone ?? ''}`} style={style}>
            {m.value}{m.unit && <span className="ml-1 text-sm font-medium tracking-normal text-muted">{m.unit}</span>}
          </dd>
        </div>
      ))}
    </dl>
  )
}
