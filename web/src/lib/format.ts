export const TZ = 'America/Sao_Paulo'

/** Data local (São Paulo) no formato ISO AAAA-MM-DD. */
export const todaySP = (d: Date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)

const noon = (iso: string) => new Date(`${iso}T12:00:00Z`)

export const addDays = (iso: string, n: number) => {
  const d = noon(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export const diffDays = (a: string, b: string) => Math.round((noon(a).getTime() - noon(b).getTime()) / 86_400_000)

/** Segunda-feira da semana (ISO) de uma data. */
export const weekStart = (iso: string) => {
  const dow = noon(iso).getUTCDay() || 7
  return addDays(iso, 1 - dow)
}

export const isoWeekday = (iso: string) => noon(iso).getUTCDay() || 7

const fmt = (iso: string, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', ...o }).format(noon(iso))

/** 27/10 */
export const dm = (iso: string) => fmt(iso, { day: '2-digit', month: '2-digit' })
/** ter */
export const wdShort = (iso: string) => fmt(iso, { weekday: 'short' }).replace('.', '')
/** 27 out */
export const dMon = (iso: string) => fmt(iso, { day: 'numeric', month: 'short' }).replace('.', '').replace(' de ', ' ')
/** outubro de 2026 → "outubro 2026" */
export const monthLabel = (iso: string) => fmt(iso, { month: 'long', year: 'numeric' }).replace(' de ', ' ')
export const monthShort = (iso: string) => fmt(iso, { month: 'short' }).replace('.', '')
/** terça-feira, 27 de outubro */
export const longDay = (iso: string) => fmt(iso, { weekday: 'long', day: 'numeric', month: 'long' })

export const hhmm = (time: string) => time.slice(0, 5)

export const num = (n: number | null | undefined, digits = 1) =>
  n == null || Number.isNaN(n)
    ? ''
    : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })

/** kg com 1 casa só quando precisa (82,5 / 80). */
export const kgFmt = (n: number | null | undefined) =>
  n == null ? '' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 1 })

export const intFmt = (n: number | null | undefined) =>
  n == null ? '' : Math.round(Number(n)).toLocaleString('pt-BR')

export const signed = (n: number | null | undefined, digits = 1) =>
  n == null ? '' : `${n > 0 ? '+' : n < 0 ? '−' : '±'}${num(Math.abs(n), digits)}`

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** "há 5 min", "há 3 h", "ontem", "27/10" */
export function relTime(ts: string | number | Date) {
  const t = new Date(ts).getTime()
  const s = Math.round((Date.now() - t) / 1000)
  if (s < 60) return 'agora'
  if (s < 3600) return `há ${Math.round(s / 60)} min`
  const day = todaySP(new Date(t))
  const today = todaySP()
  if (day === today) return `há ${Math.round(s / 3600)} h`
  if (diffDays(today, day) === 1) return 'ontem'
  return dm(day)
}

export const mmss = (sec: number) => {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** 1RM estimado (Epley), igual a v_e1rm: só 1–12 reps. */
export const epley = (kg: number, reps: number) => (reps >= 1 && reps <= 12 && kg > 0 ? kg * (1 + reps / 30) : null)

export const restLabel = (min: number | null, max: number | null) => {
  if (!min) return null
  const hi = max && max !== min ? max : null
  if (min % 60 === 0 && (!hi || hi % 60 === 0)) return `${min / 60}${hi ? `–${hi / 60}` : ''} min`
  if (min < 60 && (!hi || hi < 60)) return `${min}${hi ? `–${hi}` : ''} s`
  return `${mmss(min)}${hi ? `–${mmss(hi)}` : ''}`
}
