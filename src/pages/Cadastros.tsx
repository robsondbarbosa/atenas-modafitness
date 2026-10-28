import React, { useState } from 'react';
import { db, Party, PartyKind, Warehouse } from '../db';
import { Card, ConfirmDelete, DataTable, ErrorNote, Field, fmtDate, Modal, PageHead, useData } from '../ui';

type FieldType = 'text' | 'date' | 'number' | 'email' | 'tel';
interface FieldDef {
  key: keyof Party & string;
  label: string;
  type?: FieldType;
}

const BASE_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Nome *' },
  { key: 'phone', label: 'Telefone', type: 'tel' },
  { key: 'email', label: 'E-mail', type: 'email' },
  { key: 'doc', label: 'CPF / CNPJ' },
  { key: 'city', label: 'Cidade' },
  { key: 'address', label: 'Endereço' },
];

const KIND_CONFIG: Record<PartyKind, { title: string; what: string; fields: FieldDef[] }> = {
  cliente: {
    title: 'Clientes',
    what: 'cliente',
    fields: [...BASE_FIELDS, { key: 'birth_date', label: 'Nascimento', type: 'date' }],
  },
  fornecedor: { title: 'Fornecedores', what: 'fornecedor', fields: BASE_FIELDS },
  vendedor: {
    title: 'Vendedores',
    what: 'vendedor',
    fields: [...BASE_FIELDS, { key: 'commission_pct', label: 'Comissão (%)', type: 'number' }],
  },
  revendedor: { title: 'Revendedores', what: 'revendedor', fields: BASE_FIELDS },
  transportadora: { title: 'Transportadoras', what: 'transportadora', fields: BASE_FIELDS },
};

function PartyForm({ kind, initial, onClose, onSaved }: {
  kind: PartyKind;
  initial: Party | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const cfg = KIND_CONFIG[kind];
  const [form, setForm] = useState<Partial<Party>>(
    initial ?? { kind, name: '', commission_pct: kind === 'vendedor' ? 0 : undefined },
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    if (!form.name?.trim()) {
      setErr('Informe o nome.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      const payload = { ...form, kind };
      if (initial) await db.update('parties', initial.id, payload);
      else await db.insert('parties', payload);
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={initial ? `Editar ${cfg.what}` : `Novo ${cfg.what}`} onClose={onClose}>
      <ErrorNote message={err} />
      <div className='form-grid'>
        {cfg.fields.map((f) => (
          <Field key={f.key} label={f.label}>
            <input
              className='input'
              type={f.type ?? 'text'}
              value={(form as any)[f.key] ?? ''}
              onChange={(e) => set(f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)}
            />
          </Field>
        ))}
        <Field label='Observações'>
          <textarea className='input' rows={2} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
      <div className='modal-foot'>
        <button className='btn' onClick={onClose}>
          Cancelar
        </button>
        <button className='btn btn--primary' disabled={saving} onClick={save}>
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </Modal>
  );
}

export function PartyPage({ kind }: { kind: PartyKind }) {
  const cfg = KIND_CONFIG[kind];
  const { data: rows, error, reload } = useData<Party[]>(
    async () => (await db.list('parties', { eq: ['kind', kind], order: 'name', asc: true })) as Party[],
    [kind],
  );
  const [editing, setEditing] = useState<Party | null | 'new'>(null);

  return (
    <>
      <PageHead
        title={cfg.title}
        actions={
          <button className='btn btn--primary' onClick={() => setEditing('new')}>
            + Novo
          </button>
        }
      />
      <ErrorNote message={error} />
      <Card>
        <DataTable
          cols={[
            { key: 'name', label: 'Nome' },
            { key: 'phone', label: 'Telefone' },
            { key: 'city', label: 'Cidade' },
            ...(kind === 'vendedor'
              ? [{ key: 'commission_pct', label: 'Comissão', render: (p: Party) => (p.commission_pct ? `${p.commission_pct}%` : '—') }]
              : kind === 'cliente'
                ? [{ key: 'birth_date', label: 'Nascimento', render: (p: Party) => fmtDate(p.birth_date) }]
                : []),
          ]}
          rows={rows ?? []}
          actions={(row) => (
            <>
              <button className='btn-link' onClick={() => setEditing(row)}>
                Editar
              </button>
              <ConfirmDelete
                what={row.name}
                onDelete={async () => {
                  await db.remove('parties', row.id);
                  reload();
                }}
              />
            </>
          )}
        />
      </Card>
      {editing && (
        <PartyForm
          kind={kind}
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={reload}
        />
      )}
    </>
  );
}

/* ---------- Depósitos ---------- */

function WarehouseForm({ initial, onClose, onSaved }: {
  initial: Warehouse | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Warehouse>>(initial ?? { name: '' });
  const [err, setErr] = useState('');
  async function save() {
    if (!form.name?.trim()) {
      setErr('Informe o nome.');
      return;
    }
    try {
      if (initial) await db.update('warehouses', initial.id, form);
      else await db.insert('warehouses', form);
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e.message);
    }
  }
  return (
    <Modal title={initial ? 'Editar depósito' : 'Novo depósito'} onClose={onClose}>
      <ErrorNote message={err} />
      <div className='form-grid'>
        <Field label='Nome *'>
          <input className='input' value={form.name ?? ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label='Localização'>
          <input className='input' value={form.location ?? ''} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
        </Field>
      </div>
      <div className='modal-foot'>
        <button className='btn' onClick={onClose}>Cancelar</button>
        <button className='btn btn--primary' onClick={save}>Salvar</button>
      </div>
    </Modal>
  );
}

export function Depositos() {
  const { data: rows, error, reload } = useData<Warehouse[]>(() => db.list('warehouses', { order: 'name', asc: true }) as Promise<Warehouse[]>);
  const [editing, setEditing] = useState<Warehouse | null | 'new'>(null);
  return (
    <>
      <PageHead
        title='Depósitos'
        actions={<button className='btn btn--primary' onClick={() => setEditing('new')}>+ Novo</button>}
      />
      <ErrorNote message={error} />
      <Card>
        <DataTable
          cols={[
            { key: 'name', label: 'Nome' },
            { key: 'location', label: 'Localização' },
          ]}
          rows={rows ?? []}
          actions={(row) => (
            <>
              <button className='btn-link' onClick={() => setEditing(row)}>Editar</button>
              <ConfirmDelete
                what={row.name}
                onDelete={async () => {
                  await db.remove('warehouses', row.id);
                  reload();
                }}
              />
            </>
          )}
        />
      </Card>
      {editing && <WarehouseForm initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={reload} />}
    </>
  );
}
