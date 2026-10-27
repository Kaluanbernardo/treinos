const TZ = 'America/Sao_Paulo'

export const hhmm = (time: string) => time.slice(0, 5).replace(/^0/, '')

export const todayLabel = () =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())

export const weekdayShort = (isoDate: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'short' }).format(new Date(`${isoDate}T12:00:00Z`))

export const num = (n: number | null | undefined, digits = 1) =>
  n == null ? '–' : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })

export const signed = (n: number | null | undefined, digits = 1) =>
  n == null ? '–' : `${n > 0 ? '+' : n < 0 ? '−' : '±'}${num(Math.abs(n), digits)}`
