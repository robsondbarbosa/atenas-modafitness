import React, { useEffect, useState } from 'react';

/* ---------- Formatação ---------- */

export function fmtMoney(v: number | null | undefined): string {
  return (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function fmtDate(s?: string | null): string {
  if (!s) return '—';
  const d = s.length === 10 ? new Date(s + 'T12:00:00') : new Date(s);
  if (isNaN(+d)) return '—';
  return d.toLocaleDateString('pt-BR');
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ---------- Hook de carregamento ---------- */

export function useData<T>(fn: () => Promise<T>, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [key, setKey] = useState(0);
  useEffect(() => {
    let alive = true;
    setError('');
    fn()
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        if (alive) setError(e.message ?? String(e));
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, key]);
  return { data, error, reload: () => setKey((k) => k + 1) };
}

/* ---------- Blocos visuais ---------- */

export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className='page-head'>
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {actions && <div className='page-head-actions'>{actions}</div>}
    </div>
  );
}

export function Card({ title, children, actions }: { title?: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className='card'>
      {(title || actions) && (
        <header className='card-head'>
          {title && <h2>{title}</h2>}
          {actions && <div className='card-actions'>{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Badge({ tone = 'gray', children }: { tone?: 'gray' | 'green' | 'gold' | 'red' | 'blue'; children: React.ReactNode }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className='field'>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className='modal-overlay' onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' modal--wide' : ''}`} role='dialog' aria-label={title}>
        <header className='modal-head'>
          <h3>{title}</h3>
          <button className='icon-btn' onClick={onClose} aria-label='Fechar'>
            ✕
          </button>
        </header>
        <div className='modal-body'>{children}</div>
      </div>
    </div>
  );
}

/* ---------- Tabela genérica ---------- */

export interface Col<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
}

export function DataTable<T extends { id: string }>({ cols, rows, actions, empty = 'Nenhum registro encontrado.' }: {
  cols: Col<T>[];
  rows: T[];
  actions?: (row: T) => React.ReactNode;
  empty?: string;
}) {
  return (
    <div className='table-wrap'>
      <table className='table'>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
            {actions && <th className='th-actions' />}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={cols.length + (actions ? 1 : 0)} className='empty-cell'>
                {empty}
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id}>
              {cols.map((c) => (
                <td key={c.key}>{c.render ? c.render(row) : (row as any)[c.key] ?? '—'}</td>
              ))}
              {actions && <td className='td-actions'>{actions(row)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  if (!message) return null;
  return <p className='error-note'>Erro: {message}</p>;
}

export function ConfirmDelete({ what, onDelete }: { what: string; onDelete: () => Promise<void> | void }) {
  return (
    <button
      className='btn-link danger'
      onClick={() => {
        if (window.confirm(`Excluir ${what}? Esta ação não pode ser desfeita.`)) void onDelete();
      }}
    >
      Excluir
    </button>
  );
}
