import { useEffect, useRef, useSyncExternalStore, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { AlertTriangle, Hourglass, RotateCw, X } from 'lucide-react'

export const haptic = (pattern: number | number[] = 15) => {
  try { navigator.vibrate?.(pattern) } catch { /* sem suporte */ }
}

// ---------------------------------------------------------------- superfícies
export function Card({ className = '', tone = 'base', children, as: Tag = 'section', ...rest }: {
  className?: string; tone?: 'base' | 'raised'; children?: ReactNode; as?: 'section' | 'div' | 'article'
} & Record<string, unknown>) {
  const bg = tone === 'raised' ? 'bg-card-2' : 'bg-card'
  return <Tag className={`rounded-[var(--radius-card)] ${bg} p-5 ${className}`} {...rest}>{children}</Tag>
}

/** Cabeçalho de card: título real (h2) + ação/selo à direita. */
export function CardHead({ title, aside, sub, id }: { title: ReactNode; aside?: ReactNode; sub?: ReactNode; id?: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="text-lg font-semibold leading-tight text-fg">{title}</h2>
        {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
      </div>
      {aside}
    </div>
  )
}

type Tone = 'lime' | 'warn' | 'ok' | 'err' | 'muted' | 'protein' | 'kcal' | 'fat'
const TONES: Record<Tone, string> = {
  lime: 'bg-lime/15 text-lime',
  warn: 'bg-warn/15 text-warn',
  ok: 'bg-ok/15 text-ok',
  err: 'bg-err/15 text-err',
  muted: 'bg-line/60 text-muted',
  protein: 'bg-protein/15 text-protein',
  kcal: 'bg-kcal/15 text-kcal',
  fat: 'bg-fat/15 text-fat',
}

export function Badge({ tone = 'muted', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold leading-none ${TONES[tone]} ${className}`}>
      {children}
    </span>
  )
}

// ---------------------------------------------------------------- botões
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'md' | 'lg' | 'xl' }

export function Button({ variant = 'secondary', size = 'md', className = '', children, ...rest }: BtnProps) {
  const v = {
    primary: 'bg-lime text-bg font-semibold hover:brightness-105',
    secondary: 'bg-card-2 text-fg border border-line hover:border-muted/60',
    ghost: 'text-muted hover:text-fg',
    danger: 'bg-err/12 text-err border border-err/30',
  }[variant]
  const s = { md: 'h-12 px-4 text-base rounded-xl', lg: 'h-14 px-5 text-lg rounded-2xl', xl: 'h-16 px-6 text-xl rounded-2xl' }[size]
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 transition-[transform,filter,border-color,opacity] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 ${v} ${s} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export function IconButton({ label, className = '', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button" aria-label={label} title={label}
      className={`relative inline-flex h-12 w-12 items-center justify-center rounded-xl text-muted transition-colors duration-150 hover:bg-card hover:text-fg ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

/** Controle segmentado (4 sem · 3 meses · tudo). */
export function Segmented<T extends string>({ value, options, onChange, label, size = 'md' }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string; size?: 'sm' | 'md'
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-xl bg-card p-1">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)}
            className={`flex-1 rounded-lg font-medium transition-colors duration-150 ${size === 'sm' ? 'h-10 text-sm' : 'h-11 text-[15px]'} ${
              on ? 'bg-card-2 text-fg shadow-[0_1px_0_0_var(--color-line)_inset]' : 'text-muted hover:text-fg'}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------- estados
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton rounded-[var(--radius-card)] ${className}`} />
}

/** "Coletando dados": diz o que falta, nunca um gráfico vazio. */
export function Collecting({ title, children, progress, icon }: {
  title: ReactNode; children?: ReactNode; progress?: { have: number; need: number; unit: string }; icon?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-4 py-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-muted" aria-hidden="true">{icon ?? <Hourglass size={20} />}</span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-fg">{title}</p>
          {children && <div className="mt-1 text-sm leading-relaxed text-muted">{children}</div>}
          {progress && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-muted">
                <span>{progress.have} de {progress.need} {progress.unit}</span>
                <span>faltam {Math.max(0, progress.need - progress.have)}</span>
              </div>
              <div className="mt-1.5 flex gap-1" aria-hidden="true">
                {Array.from({ length: progress.need }, (_, i) => (
                  <span key={i} className={`h-1.5 flex-1 rounded-full ${i < progress.have ? 'bg-lime' : 'bg-line'}`} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function ErrorState({ message, onRetry, what = 'os dados' }: { message?: string; onRetry?: () => void; what?: string }) {
  const offline = typeof navigator !== 'undefined' && !navigator.onLine
  return (
    <div role="alert" className="rounded-2xl border border-err/30 bg-err/8 p-4">
      <p className="flex items-center gap-2 font-medium text-err"><AlertTriangle size={18} aria-hidden="true" /> Não consegui carregar {what}.</p>
      <p className="mt-1 text-sm text-muted">{offline ? 'Sem conexão. Confira o sinal e tente de novo.' : message || 'Erro inesperado.'}</p>
      {onRetry && (
        <Button className="mt-3" onClick={onRetry}><RotateCw size={18} aria-hidden="true" /> Tentar de novo</Button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- toast
interface ToastMsg { id: number; text: string; tone?: 'ok' | 'err' | 'lime'; action?: { label: string; run: () => void } }
let toasts: ToastMsg[] = []
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function toast(text: string, opts: Omit<ToastMsg, 'id' | 'text'> & { ms?: number } = {}) {
  const id = Date.now() + Math.random()
  toasts = [...toasts.slice(-2), { id, text, ...opts }]
  emit()
  setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); emit() }, opts.ms ?? (opts.action ? 6000 : 3500))
}

export function Toaster() {
  const list = useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb) }, () => toasts)
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+88px)] z-50 mx-auto flex max-w-lg flex-col gap-2 px-4">
      {list.map((t) => (
        <div key={t.id} className={`toast-in pointer-events-auto flex items-center justify-between gap-3 rounded-2xl border bg-card-2 px-4 py-3 shadow-[0_8px_24px_-8px_rgb(0_0_0/0.6)] ${
          t.tone === 'err' ? 'border-err/40' : t.tone === 'lime' ? 'border-lime/50' : 'border-line'}`}>
          <p className={`text-[15px] ${t.tone === 'err' ? 'text-err' : t.tone === 'lime' ? 'text-lime' : 'text-fg'}`}>{t.text}</p>
          {t.action && (
            <button type="button" className="h-10 shrink-0 rounded-lg px-3 font-semibold text-lime" onClick={() => {
              t.action!.run(); toasts = toasts.filter((x) => x.id !== t.id); emit()
            }}>
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- bottom sheet
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) { d.showModal(); d.focus() }
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref} onClose={onClose} aria-label={title} tabIndex={-1}
      onClick={(e) => { if (e.target === ref.current) onClose() }}
      className="sheet m-0 mt-auto w-full max-w-none bg-transparent p-0 text-fg outline-none backdrop:bg-black/60"
    >
      <div className="mx-auto max-h-[85dvh] max-w-lg overflow-y-auto rounded-t-[24px] outline-none border-t border-line bg-card px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+20px)]">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" aria-hidden="true" />
        <div className="flex items-start justify-between gap-3">
          <h2 className="pt-2 text-xl font-semibold">{title}</h2>
          <IconButton label="Fechar" onClick={onClose}><X size={22} /></IconButton>
        </div>
        <div className="mt-2">{children}</div>
      </div>
    </dialog>
  )
}
