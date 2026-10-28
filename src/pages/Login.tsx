import React, { useState } from 'react';
import { login, SessionUser } from '../auth';

export function Login({ onLogin }: { onLogin: (u: SessionUser) => void }) {
  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const u = await login(loginValue, password);
      onLogin(u);
    } catch (e: any) {
      setErr(e.message || 'Não foi possível entrar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className='login-wrap'>
      <form className='login-card' onSubmit={submit}>
        <img src='/atenas-logo.jpg' alt='Atenas Moda Fitness' className='login-logo' />
        <span className='login-sub'>Sistema de Gestão</span>
        {err && <div className='login-error'>{err}</div>}
        <label className='login-label'>
          Login
          <input className='input' value={loginValue} onChange={(e) => setLoginValue(e.target.value)} autoFocus />
        </label>
        <label className='login-label'>
          Senha
          <input className='input' type='password' value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button className='btn btn--primary login-btn' disabled={busy || !loginValue || !password}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
