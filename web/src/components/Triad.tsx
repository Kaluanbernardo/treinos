import { ArrowDownRight, ArrowRight, ArrowUpRight, Hourglass } from 'lucide-react'
import type { Arrow, Recomposition } from '../lib/types'
import { addDays, dm, signed, todaySP } from '../lib/format'

/** Quando cada seta passa a existir (mesmas janelas de v_recomposition). */
export interface TriadReadiness {
  firstWeight?: string | null   // 1ª pesagem
  firstWaist?: string | null    // 1ª cintura
  firstStrength?: string | null // 1ª sessão com exercício multiarticular
}

interface Signal {
  key: 'peso' | 'cintura' | 'forca'
  label: string
  arrow: Arrow
  value: string
  goodWhen: 'down' | 'up'
  pending: string
}

const WORD: Record<'down' | 'flat' | 'up', string> = { down: 'caindo', flat: 'estável', up: 'subindo' }

function pendingText(first: string | null | undefined, offsetDays: number, none: string) {
  if (!first) return none
  const ready = addDays(first, offsetDays)
  return ready > todaySP() ? `seta em ${dm(ready)}` : 'falta registro recente'
}

export function signals(r: Recomposition | null | undefined, ready: TriadReadiness): Signal[] {
  return [
    {
      key: 'peso', label: 'Peso', arrow: r?.weight_arrow ?? null, goodWhen: 'down',
      value: `${signed(r?.weight_delta_kg)} kg`,
      pending: pendingText(ready.firstWeight, 28, 'sem pesagem'),
    },
    {
      key: 'cintura', label: 'Cintura', arrow: r?.waist_arrow ?? null, goodWhen: 'down',
      value: `${signed(r?.waist_delta_cm)} cm`,
      pending: pendingText(ready.firstWaist, 21, 'sem medida'),
    },
    {
      key: 'forca', label: 'Força', arrow: r?.strength_arrow ?? null, goodWhen: 'up',
      value: `${signed(r?.strength_delta_pct)}%`,
      pending: pendingText(ready.firstStrength, 28, 'sem treino'),
    },
  ]
}

/**
 * A tríade de recomposição: peso · cintura · força numa só régua.
 * Seta desenhada + palavra + valor (nunca só cor). Sem dado: ampulheta + quando a seta aparece.
 */
export function Triad({ data, ready, size = 'md' }: { data: Recomposition | null | undefined; ready: TriadReadiness; size?: 'md' | 'lg' }) {
  const list = signals(data, ready)
  return (
    <ul className="grid grid-cols-3 divide-x divide-line rounded-2xl bg-bg/60 ring-1 ring-line" aria-label="Recomposição: peso, cintura e força">
      {list.map((s) => {
        const tone = toneFor(s.arrow, s.goodWhen)
        const Icon = s.arrow === 'down' ? ArrowDownRight : s.arrow === 'up' ? ArrowUpRight : s.arrow === 'flat' ? ArrowRight : Hourglass
        return (
          <li key={s.key} className={`flex flex-col gap-1 px-3 ${size === 'lg' ? 'py-4' : 'py-3'}`}>
            <span className="text-[13px] text-muted">{s.label}</span>
            {s.arrow ? (
              <>
                <span className={`flex items-center gap-1 font-semibold ${tone}`}>
                  <Icon size={size === 'lg' ? 26 : 22} strokeWidth={2.5} className="shrink-0" aria-hidden="true" />
                  <span className={size === 'lg' ? 'text-lg' : 'text-base'}>{WORD[s.arrow]}</span>
                </span>
                <span className="text-[13px] tabular-nums text-muted">{s.value}</span>
              </>
            ) : (
              <span className="flex items-start gap-1.5 text-[15px] font-medium leading-snug text-fg/80">
                <Hourglass size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
                <span><span className="sr-only">coletando: </span>{s.pending}</span>
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function toneFor(arrow: Arrow, goodWhen: 'down' | 'up') {
  if (!arrow) return 'text-muted'
  if (arrow === 'flat') return 'text-fg'
  return arrow === goodWhen ? 'text-ok' : 'text-warn'
}

/** Frase de leitura do card (a do banco para leituras prontas; a nossa enquanto coleta). */
export function readingLine(r: Recomposition | null | undefined) {
  if (!r || r.reading === 'coletando_dados') return null
  return r.reading_text
}

export const READING_TONE: Record<Recomposition['reading'], string> = {
  no_rumo: 'text-ok',
  deficit_agressivo: 'text-warn',
  plato: 'text-warn',
  alerta_cintura: 'text-err',
  misto: 'text-fg',
  coletando_dados: 'text-muted',
}
