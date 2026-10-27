import type { Modality } from '../lib/types'

/** Cor por modalidade (sempre acompanhada do nome; nunca é o único sinal). */
export const MODALITY: Record<Modality, { label: string; color: string; bg: string; text: string }> = {
  musculacao: { label: 'Musculação', color: 'var(--color-lime)', bg: 'bg-lime', text: 'text-lime' },
  muay_thai: { label: 'Muay thai', color: 'var(--color-kcal)', bg: 'bg-kcal', text: 'text-kcal' },
  jiu_jitsu: { label: 'Jiu-jitsu', color: 'var(--color-fat)', bg: 'bg-fat', text: 'text-fat' },
  cross: { label: 'Cross', color: 'var(--color-protein)', bg: 'bg-protein', text: 'text-protein' },
  funcional: { label: 'Funcional', color: 'var(--color-ok)', bg: 'bg-ok', text: 'text-ok' },
}

export const MODALITIES = Object.keys(MODALITY) as Modality[]

export function ModalityDot({ modality, className = '' }: { modality: Modality; className?: string }) {
  return <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${MODALITY[modality].bg} ${className}`} />
}
