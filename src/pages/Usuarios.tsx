import React, { useState } from 'react';
import { AppUser, db } from '../db';
import { Card, ConfirmDelete, DataTable, ErrorNote, Field, Modal, PageHead, useData } from '../ui';

const MODULES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'vendas', label: 'Vendas' },
  { id: 'estoque', label: 'Estoque' },
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'cadastros', label: 'Cadastros' },
  { id: 'relatorios', label: 'Relatórios' },
  { id: 'etiquetas', label: 'Etiquetas' },
  { id: 'catalogo', label: 'Catálogo digital' },
  { id: 'usuarios', label: 'Usuários' },
  { id: 'configuracoes', label: 'Configurações' },
];

function UserForm({ initial, onClose, onSaved }: { initial: AppUser | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<AppUser>>(initial ?? { name: '', login: '', role: 'vendedor', permissions: [], active: true });
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) =>
    setForm((f) => {
      const list = f.permissions ?? [];
      return { ...f, permissions: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] };
    });

  async function save() {
    if (!form.name?.trim() || !form.login?.trim()) {
      setErr('Informe nome e login.');
      return;
    }
    const patch: Partial<AppUser> = { ...form };
    if (initial) {
      if (!patch.password) delete patch.password;
    } else if (!patch.password || patch.password.length < 4) {
      setErr('Informe uma senha com pelo menos 4 caracteres.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      if (initial) await db.update('app_users', initial.id, patch);
      else await db.insert('app_users', patch);
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e.message.includes('duplicate') ? 'Este login já existe.' : e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={initial ? 'Editar usuário' : 'Novo usuário'} onClose={onClose}>
      <ErrorNote message={err} />
      <div className='form-grid'>
        <Field label='Nome *'>
          <input className='input' value={form.name ?? ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label='Login *'>
          <input className='input' value={form.login ?? ''} onChange={(e) => setForm((f) => ({ ...f, login: e.target.value }))} />
        </Field>
        <Field label={initial ? 'Nova senha (vazio = manter)' : 'Senha *'}>
          <input
            className='input'
            type='password'
            value={form.password ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            autoComplete='new-password'
          />
        </Field>
        <Field label='Perfil'>
          <select className='input' value={form.role ?? 'vendedor'} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as any }))}>
            <option value='admin'>Administrador</option>
            <option value='gerente'>Gerente</option>
            <option value='vendedor'>Vendedor</option>
          </select>
        </Field>
      </div>
      <fieldset className='perm-group'>
        <legend>Permissões de acesso</legend>
        <div className='perm-grid'>
          {MODULES.map((m) => (
            <label key={m.id} className='check-row'>
              <input type='checkbox' checked={(form.permissions ?? []).includes(m.id)} onChange={() => toggle(m.id)} />
              <span>{m.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className='modal-foot'>
        <button className='btn' onClick={onClose}>Cancelar</button>
        <button className='btn btn--primary' disabled={saving} onClick={save}>{saving ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </Modal>
  );
}

export function Usuarios() {
  const { data: rows, error, reload } = useData<AppUser[]>(() => db.list('app_users', { order: 'name', asc: true }) as Promise<AppUser[]>);
  const [editing, setEditing] = useState<AppUser | null | 'new'>(null);

  return (
    <>
      <PageHead
        title='Usuários e permissões'
        sub='Controle de acesso por módulo do sistema'
        actions={<button className='btn btn--primary' onClick={() => setEditing('new')}>+ Novo usuário</button>}
      />
      <ErrorNote message={error} />
      <Card>
        <DataTable
          cols={[
            { key: 'name', label: 'Nome' },
            { key: 'login', label: 'Login' },
            { key: 'role', label: 'Perfil', render: (u: AppUser) => (u.role === 'admin' ? 'Administrador' : u.role === 'gerente' ? 'Gerente' : 'Vendedor') },
            {
              key: 'permissions',
              label: 'Permissões',
              render: (u: AppUser) => {
                const perms = u.permissions ?? [];
                return perms.includes('*') ? 'Todos os módulos' : perms.length ? `${perms.length} módulo(s)` : '—';
              },
            },
            { key: 'active', label: 'Ativo', render: (u: AppUser) => (u.active ? 'Sim' : 'Não') },
          ]}
          rows={rows ?? []}
          actions={(u) => (
            <>
              <button className='btn-link' onClick={() => setEditing(u)}>Editar</button>
              <ConfirmDelete
                what={u.name}
                onDelete={async () => {
                  await db.remove('app_users', u.id);
                  reload();
                }}
              />
            </>
          )}
        />
      </Card>
      {editing && <UserForm initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={reload} />}
    </>
  );
}
