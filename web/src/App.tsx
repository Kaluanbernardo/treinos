import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { supabase, missingConfig } from './lib/supabase'
import { useRoute } from './lib/router'
import { AppShell } from './components/AppShell'
import type { NavId } from './components/SideNav'
import { Login } from './screens/Login'
import { Hoje } from './screens/Hoje'
import { Treino } from './screens/Treino'
import { Sessao } from './screens/Sessao'
import { Evolucao } from './screens/Evolucao'
import { Nutricao } from './screens/Nutricao'
import { Agenda } from './screens/Agenda'
import { Calorias } from './screens/Calorias'
import { Notas } from './screens/Notas'
import { Config } from './screens/Config'

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const route = useRoute()
  const qc = useQueryClient()

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (!s) qc.clear()
    })
    return () => data.subscription.unsubscribe()
  }, [qc])

  if (!supabase) return <ConfigMissing />
  if (session === undefined) return <div className="min-h-full" aria-busy="true" />
  if (!session) return <Login />

  const fullscreen = route.name === 'sessao'
  const NAV: string[] = ['hoje', 'treino', 'evolucao', 'nutricao', 'calorias', 'agenda', 'config']
  const active: NavId | null = NAV.includes(route.name) ? (route.name as NavId) : null

  return (
    <AppShell active={active} fullscreen={fullscreen}>
      {route.name === 'hoje' && <Hoje />}
      {route.name === 'treino' && <Treino />}
      {route.name === 'sessao' && <Sessao id={route.id} />}
      {route.name === 'evolucao' && <Evolucao />}
      {route.name === 'nutricao' && <Nutricao />}
      {route.name === 'agenda' && <Agenda />}
      {route.name === 'calorias' && <Calorias />}
      {route.name === 'notas' && <Notas email={session.user.email ?? ''} />}
      {route.name === 'config' && <Config email={session.user.email ?? ''} />}
    </AppShell>
  )
}

function ConfigMissing() {
  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center gap-4 px-6">
      <h1 className="text-2xl font-semibold">Quase lá</h1>
      <div className="rounded-[var(--radius-card)] bg-card p-5">
        <p className="text-muted">
          O app ainda não tem a configuração do Supabase. Falta definir no <code className="text-fg">.env.local</code>:
        </p>
        <ul className="mt-3 space-y-1">
          {missingConfig.map((k) => (
            <li key={k} className="font-mono text-warn">{k}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted">Depois é só rodar o build de novo.</p>
      </div>
    </div>
  )
}
