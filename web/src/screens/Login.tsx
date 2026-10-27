import { useState, type FormEvent } from 'react'
import { AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setError(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message)
  }

  return (
    <div className="mx-auto flex min-h-full max-w-sm flex-col justify-center px-6">
      <h1 className="text-3xl font-bold">Fitness</h1>
      <p className="mb-8 mt-1 text-muted">Entre para ver o seu dia.</p>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm text-muted">E-mail</span>
          <input
            type="email" autoComplete="username" required value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-14 rounded-2xl border border-line bg-card px-4 text-fg outline-none focus:border-lime"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm text-muted">Senha</span>
          <input
            type="password" autoComplete="current-password" required value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-14 rounded-2xl border border-line bg-card px-4 text-fg outline-none focus:border-lime"
          />
        </label>
        {error && <p role="alert" className="flex items-center gap-2 text-err"><AlertTriangle size={18} aria-hidden="true" /> {error}</p>}
        <button
          type="submit" disabled={busy}
          className="mt-2 h-14 rounded-2xl action-fill text-lg font-semibold transition-opacity duration-150 disabled:opacity-60"
        >
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
