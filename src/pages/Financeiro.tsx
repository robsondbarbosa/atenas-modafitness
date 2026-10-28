import React, { useState } from 'react';
import { db, Party, Payable, Receivable } from '../db';
import { Badge, Card, ConfirmDelete, DataTable, ErrorNote, Field, fmtDate, fmtMoney, Modal, PageHead, today, useData } from '../ui';

type Title = Receivable & Partial<Payable>;

function TitleForm({ kind, suppliers, initial, onClose, onSaved }: {
  kind: 'receber' | 'pagar';
  suppliers: Party[];
  initial: any | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<any>(
    initial ?? { description: '', amount: 0, due_date: today(), status: 'aberto' },
  );
  const [err, setErr] = useState('');
  const table = kind === 'receber' ? 'receivables' : 'payables';

  async function save() {
    if (!form.description?.trim() || !Number(form.amount)) {
      setErr('Informe a descrição e o valor.');
      return;
    }
    try {
      if (initial) await db.update(table, initial.id, form);
      else await db.insert(table, form);
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <Modal title={initial ? 'Editar título' : kind === 'receber' ? 'Novo título a receber' : 'Novo título a pagar'} onClose={onClose}>
      <ErrorNote message={err} />
      <div className='form-grid'>
        <Field label='Descrição *'>
          <input className='input' value={form.description ?? ''} onChange={(e) => setForm((f: any) => ({ ...f, description: e.target.value }))} />
        </Field>
        <Field label='Valor (R$) *'>
          <input className='input' type='number' step='0.01' value={form.amount ?? 0} onChange={(e) => setForm((f: any) => ({ ...f, amount: Number(e.target.value) }))} />
        </Field>
        <Field label='Vencimento'>
          <input className='input' type='date' value={form.due_date ?? ''} onChange={(e) => setForm((f: any) => ({ ...f, due_date: e.target.value }))} />
        </Field>
        {kind === 'pagar' && (
          <Field label='Fornecedor'>
            <select className='input' value={form.supplier_id ?? ''} onChange={(e) => setForm((f: any) => ({ ...f, supplier_id: e.target.value || null }))}>
              <option value=''>—</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
        )}
      </div>
      <div className='modal-foot'>
        <button className='btn' onClick={onClose}>Cancelar</button>
        <button className='btn btn--primary' onClick={save}>Salvar</button>
      </div>
    </Modal>
  );
}

export function Financeiro({ kind }: { kind: 'receber' | 'pagar' }) {
  const receber = kind === 'receber';
  const { data, error, reload } = useData(async () => {
    const [titles, parties] = await Promise.all([
      db.list(receber ? 'receivables' : 'payables', { order: 'due_date', asc: true }),
      db.list('parties'),
    ]);
    return { titles: titles as Title[], parties: parties as Party[] };
  }, [kind]);

  const [filter, setFilter] = useState<'todos' | 'abertos' | 'pagos'>('abertos');
  const [editing, setEditing] = useState<any | null | 'new'>(null);

  const rows = (data?.titles ?? []).filter((t) =>
    filter === 'todos' ? true : filter === 'abertos' ? t.status === 'aberto' : t.status === 'pago',
  );
  const totalAberto = (data?.titles ?? []).filter((t) => t.status === 'aberto').reduce((a, t) => a + Number(t.amount), 0);
  const supplierName = (id?: string | null) => data?.parties.find((p) => p.id === id)?.name;

  async function togglePaid(t: Title) {
    const pago = t.status === 'pago';
    await db.update(receber ? 'receivables' : 'payables', t.id, { status: pago ? 'aberto' : 'pago', paid_at: pago ? null : today() });
    reload();
  }

  return (
    <>
      <PageHead
        title={receber ? 'Contas a receber' : 'Contas a pagar'}
        sub={`Total em aberto: ${fmtMoney(totalAberto)}${receber ? ' — inclui parcelas do crediário (fiado)' : ''}`}
        actions={<button className='btn btn--primary' onClick={() => setEditing('new')}>+ Novo título</button>}
      />
      <ErrorNote message={error} />
      <div className='filter-row'>
        {(['abertos', 'pagos', 'todos'] as const).map((f) => (
          <button key={f} className={`chip${filter === f ? ' chip--on' : ''}`} onClick={() => setFilter(f)}>
            {f === 'abertos' ? 'Em aberto' : f === 'pagos' ? 'Pagos' : 'Todos'}
          </button>
        ))}
      </div>
      <Card>
        <DataTable
          cols={[
            { key: 'description', label: 'Descrição' },
            ...(receber
              ? []
              : [{ key: 'supplier', label: 'Fornecedor', render: (t: Title) => supplierName(t.supplier_id) ?? '—' }]),
            { key: 'amount', label: 'Valor', render: (t: Title) => fmtMoney(Number(t.amount)) },
            { key: 'due_date', label: 'Vencimento', render: (t: Title) => fmtDate(t.due_date) },
            {
              key: 'status',
              label: 'Situação',
              render: (t: Title) => {
                const overdue = t.status === 'aberto' && t.due_date && t.due_date < today();
                return overdue ? <Badge tone='red'>Vencido</Badge> : <Badge tone={t.status === 'pago' ? 'green' : 'gold'}>{t.status}</Badge>;
              },
            },
            { key: 'paid_at', label: 'Pago em', render: (t: Title) => fmtDate(t.paid_at) },
          ]}
          rows={rows}
          empty='Nenhum título encontrado.'
          actions={(t) => (
            <>
              <button className='btn-link' onClick={() => togglePaid(t)}>
                {t.status === 'pago' ? 'Reabrir' : 'Marcar pago'}
              </button>
              <button className='btn-link' onClick={() => setEditing(t)}>Editar</button>
              <ConfirmDelete
                what={t.description}
                onDelete={async () => {
                  await db.remove(receber ? 'receivables' : 'payables', t.id);
                  reload();
                }}
              />
            </>
          )}
        />
      </Card>
      {editing && (
        <TitleForm
          kind={kind}
          suppliers={(data?.parties ?? []).filter((p) => p.kind === 'fornecedor')}
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={reload}
        />
      )}
    </>
  );
}
