import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Check, Database, Info, LogOut, Moon, Smartphone, Sun, Wifi, WifiOff } from 'lucide-react'
import { useEnergyDaily, useLastData, useProfile, useSaveProfile } from '../lib/api'
import type { Profile } from '../lib/types'
import { supabase } from '../lib/supabase'
import { go } from '../lib/router'
import { intFmt, num, relTime, todaySP } from '../lib/format'
import { useTheme, type ThemePref } from '../lib/theme'
import { Button, Card, CardHead, ErrorState, IconButton, Segmented, Skeleton, haptic, toast } from '../components/ui'

declare const __APP_VERSION__: string
declare const __BUILD_SHA__: string
declare const __BUILD_DATE__: string

const TABLE_LABEL: Record<string, string> = {
  sessions: 'sessão', set_logs: 'série', body_metrics: 'peso/medida', food_logs: 'refeição', bot_notes: 'nota', daily_checks: 'creatina/água',
}

export function Config({ email }: { email: string }) {
  const last = useLastData()
  const ping = useQuery({
    queryKey: ['ping'],
    refetchInterval: 30_000,
    retry: 0,
    queryFn: async () => {
      const t = performance.now()
      const { error } = await supabase!.from('goals').select('id').limit(1)
      if (error) throw new Error(error.message)
      return Math.round(performance.now() - t)
    },
  })
  const online = ping.isSuccess

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-1 pt-1">
        <IconButton label="Voltar" onClick={() => (history.length > 1 ? history.back() : go('hoje'))}><ArrowLeft size={24} /></IconButton>
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em]">Configurações</h1>
      </header>

      <ProfileCard />

      <ThemeCard />

      <Card aria-labelledby="st-title">
        <CardHead id="st-title" title="Status" />
        <dl className="mt-3 divide-y divide-line">
          <Row icon={online ? <Wifi size={20} className="text-ok" /> : <WifiOff size={20} className="text-err" />} label="Conexão com o banco">
            {ping.isPending ? 'testando…' : online ? <span className="text-ok">ok · {ping.data} ms</span> : <span className="text-err">sem resposta</span>}
          </Row>
          <Row icon={<Database size={20} className="text-muted" />} label="Último dado">
            {last.isPending ? <Skeleton className="h-5 w-24 rounded-md" /> : last.data
              ? <>{relTime(last.data.at!)} <span className="text-muted">({TABLE_LABEL[last.data.table] ?? last.data.table})</span></>
              : <span className="text-muted">nenhum ainda</span>}
          </Row>
          <Row icon={<Info size={20} className="text-muted" />} label="Versão">
            <span className="tabular-nums">{__APP_VERSION__} · {__BUILD_SHA__}</span> <span className="text-muted">({__BUILD_DATE__})</span>
          </Row>
        </dl>
      </Card>

      <Card aria-labelledby="acc-title">
        <CardHead id="acc-title" title="Conta" sub={email} />
        <Button variant="danger" size="lg" className="mt-4 w-full" onClick={() => supabase?.auth.signOut()}>
          <LogOut size={20} aria-hidden="true" /> Sair
        </Button>
      </Card>

      <p className="px-1 text-sm leading-relaxed text-muted">
        App pessoal do Kaluan. Peso, medidas, refeições, fotos e remarcações entram pelo chat com o assistente; aqui ficam
        os registros de treino, a creatina e o perfil do basal. Horários em America/São Paulo.
      </p>
    </div>
  )
}

const THEME_OPTIONS: { value: ThemePref; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Claro', icon: <Sun size={18} /> },
  { value: 'dark', label: 'Escuro', icon: <Moon size={18} /> },
  { value: 'system', label: 'Sistema', icon: <Smartphone size={18} /> },
]

function ThemeCard() {
  const { pref, theme, setPref } = useTheme()
  return (
    <Card aria-labelledby="theme-title">
      <CardHead id="theme-title" title="Tema"
        sub={pref === 'system' ? `Segue o celular · ${theme === 'light' ? 'claro' : 'escuro'} agora` : 'Fixo neste aparelho'} />
      <div className="mt-4">
        <Segmented label="Tema do app" value={pref} options={THEME_OPTIONS} onChange={setPref} track="bg-bg/70 ring-1 ring-line" />
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------- perfil (basal)
type Sex = 'M' | 'F'
const SEX_OPTIONS: { value: Sex; label: string }[] = [{ value: 'M', label: 'Masculino' }, { value: 'F', label: 'Feminino' }]

/** Mifflin-St Jeor, igual a v_energy_daily. */
const mifflin = (kg: number, cm: number, age: number, sex: Sex) => 10 * kg + 6.25 * cm - 5 * age + (sex === 'M' ? 5 : -161)
const ageAt = (birth: string, on: string) => {
  const [by, bm, bd] = birth.split('-').map(Number)
  const [y, m, d] = on.split('-').map(Number)
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0)
}

function ProfileCard() {
  const profile = useProfile()
  if (profile.isError) return <ErrorState what="o perfil" message={profile.error.message} onRetry={() => profile.refetch()} />
  if (profile.isPending) return <Skeleton className="h-80" />
  if (!profile.data) return null
  return <ProfileForm key={profile.data.id + (profile.dataUpdatedAt ?? 0)} p={profile.data} />
}

function ProfileForm({ p }: { p: Profile }) {
  const save = useSaveProfile()
  const energy = useEnergyDaily(1)
  const [height, setHeight] = useState(p.height_cm != null ? String(p.height_cm).replace('.', ',') : '')
  const [birth, setBirth] = useState(p.birth_date ?? '')
  const [sex, setSex] = useState<Sex | null>(p.sex)
  const today = todaySP()

  useEffect(() => {
    if (!/\/perfil$/.test(window.location.hash)) return
    const t = setTimeout(() => {
      const el = document.getElementById('perfil')
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      el?.querySelector<HTMLInputElement>('input:placeholder-shown')?.focus({ preventScroll: true })
    }, 50)
    return () => clearTimeout(t)
  }, [])

  const cm = height.trim() ? Number(height.replace(',', '.')) : null
  const cmBad = cm != null && (!Number.isFinite(cm) || cm < 100 || cm > 250)
  const birthBad = !!birth && (birth > today || birth < '1900-01-02')
  const dirty = (cm ?? null) !== (p.height_cm != null ? Number(p.height_cm) : null) || (birth || null) !== p.birth_date || sex !== p.sex
  const kg = energy.data?.at(-1)?.weight_kg ?? null
  const bmr = cm && !cmBad && birth && !birthBad && sex && kg ? Math.round(mifflin(Number(kg), cm, ageAt(birth, today), sex)) : null
  const complete = p.height_cm != null && p.birth_date != null && p.sex != null

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (cmBad || birthBad || !dirty) return
    save.mutate({ id: p.id, height_cm: cm, birth_date: birth || null, sex }, {
      onSuccess: () => { haptic(15); toast('Perfil salvo. O basal já entra em Calorias.', { tone: 'lime' }) },
      onError: () => toast('Não salvou o perfil. Tente de novo.', { tone: 'err' }),
    })
  }

  const input = 'h-14 w-full rounded-2xl border bg-bg/60 px-4 text-lg tabular-nums text-fg caret-lime outline-none transition-colors duration-150 placeholder:text-muted/70 focus:border-lime'
  return (
    <Card as="section" aria-labelledby="perfil-title" id="perfil" className="scroll-mt-4">
      <CardHead id="perfil-title" title="Perfil" sub={complete ? 'Usado no basal (Mifflin-St Jeor)' : 'Necessário para o basal em Calorias'} />
      <form className="mt-4 flex flex-col gap-4" onSubmit={submit} noValidate>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-muted">Altura (cm)</span>
            <input className={`${input} ${cmBad ? 'border-err' : 'border-line'}`} inputMode="decimal" placeholder="—" value={height}
              onChange={(e) => setHeight(e.target.value.replace(/[^\d,.]/g, ''))} aria-invalid={cmBad || undefined} autoComplete="off" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-muted">Nascimento</span>
            <input type="date" className={`${input} text-base ${birthBad ? 'border-err' : 'border-line'} ${birth ? '' : 'text-muted'}`} value={birth} max={today} min="1900-01-02"
              placeholder="—" onChange={(e) => setBirth(e.target.value)} aria-invalid={birthBad || undefined} />
          </label>
        </div>
        {(cmBad || birthBad) && <p role="alert" className="-mt-2 text-sm text-err">{cmBad ? 'Altura entre 100 e 250 cm.' : 'Data de nascimento inválida.'}</p>}
        <div className="flex flex-col gap-1.5">
          <span id="sexo-label" className="text-[13px] text-muted">Sexo (fórmula do basal)</span>
          <SexPicker value={sex} onChange={setSex} />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-bg/60 px-4 py-3 ring-1 ring-line">
          <span className="text-[15px] text-muted">Basal estimado</span>
          <span className="text-right tabular-nums">
            {bmr != null ? <><b className="text-xl font-bold text-fg">{intFmt(bmr)}</b> <span className="text-muted">kcal · {num(Number(kg), 1)} kg</span></>
              : <span className="text-muted">{kg ? 'preencha os 3 campos' : 'falta uma pesagem'}</span>}
          </span>
        </div>
        <Button type="submit" variant="secondary" size="lg" className="w-full" disabled={!dirty || cmBad || birthBad || save.isPending}>
          <Check size={20} aria-hidden="true" /> {save.isPending ? 'Salvando…' : dirty ? 'Salvar perfil' : 'Salvo'}
        </Button>
      </form>
    </Card>
  )
}

function SexPicker({ value, onChange }: { value: Sex | null; onChange: (v: Sex) => void }) {
  return (
    <div role="radiogroup" aria-labelledby="sexo-label" className="flex rounded-xl bg-bg/70 p-1 ring-1 ring-line">
      {SEX_OPTIONS.map((o) => {
        const on = o.value === value
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)}
            className={`flex h-11 flex-1 items-center justify-center rounded-lg text-[15px] font-medium transition-colors duration-150 ${
              on ? 'bg-card-2 text-fg shadow-[0_1px_0_0_var(--color-line)_inset]' : 'text-muted hover:text-fg'}`}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span aria-hidden="true">{icon}</span>
      <dt className="flex-1 text-[15px] text-muted">{label}</dt>
      <dd className="text-right text-[15px]">{children}</dd>
    </div>
  )
}
