import React, { useState } from 'react';
import { db, Product, Warehouse, newBarcode } from '../db';
import { Badge, Card, ConfirmDelete, DataTable, ErrorNote, Field, fmtMoney, Modal, PageHead, useData } from '../ui';

function ProductForm({ initial, warehouses, onClose, onSaved }: {
  initial: Product | null;
  warehouses: Warehouse[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Product>>(
    initial ?? { name: '', price: 0, cost: 0, stock: 0, min_stock: 0, photos: [], active: true },
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (k: keyof Product, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const setPhoto = (i: number, v: string) =>
    setForm((f) => {
      const photos = [...(f.photos ?? [])];
      photos[i] = v;
      return { ...f, photos };
    });

  async function save() {
    if (!form.name?.trim()) {
      setErr('Informe o nome do produto.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      const photos = (form.photos ?? []).map((p) => p?.trim()).filter(Boolean).slice(0, 3);
      const payload = { ...form, photos };
      if (initial) await db.update('products', initial.id, payload);
      else await db.insert('products', payload);
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={initial ? 'Editar produto' : 'Novo produto'} onClose={onClose} wide>
      <ErrorNote message={err} />
      <div className='form-grid form-grid--3'>
        <Field label='Nome *'>
          <input className='input' value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label='Código interno'>
          <input className='input' value={form.code ?? ''} onChange={(e) => set('code', e.target.value)} />
        </Field>
        <Field label='Código de barras'>
          <div className='input-group'>
            <input className='input' value={form.barcode ?? ''} onChange={(e) => set('barcode', e.target.value)} />
            <button type='button' className='btn btn--small' onClick={() => set('barcode', newBarcode())} title='Gerar código de barras'>
              Gerar
            </button>
          </div>
        </Field>
        <Field label='Categoria'>
          <input className='input' value={form.category ?? ''} onChange={(e) => set('category', e.target.value)} />
        </Field>
        <Field label='Preço de venda (R$)'>
          <input className='input' type='number' step='0.01' value={form.price ?? 0} onChange={(e) => set('price', Number(e.target.value))} />
        </Field>
        <Field label='Custo (R$)'>
          <input className='input' type='number' step='0.01' value={form.cost ?? 0} onChange={(e) => set('cost', Number(e.target.value))} />
        </Field>
        <Field label='Estoque atual'>
          <input className='input' type='number' value={form.stock ?? 0} onChange={(e) => set('stock', Number(e.target.value))} />
        </Field>
        <Field label='Estoque mínimo'>
          <input className='input' type='number' value={form.min_stock ?? 0} onChange={(e) => set('min_stock', Number(e.target.value))} />
        </Field>
        <Field label='Depósito'>
          <select className='input' value={form.warehouse_id ?? ''} onChange={(e) => set('warehouse_id', e.target.value || null)}>
            <option value=''>—</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className='form-grid form-grid--3'>
        {[0, 1, 2].map((i) => (
          <Field key={i} label={`Foto ${i + 1} (URL)`}>
            <input className='input' value={form.photos?.[i] ?? ''} onChange={(e) => setPhoto(i, e.target.value)} placeholder='https://…' />
          </Field>
        ))}
      </div>
      <Field label='Descrição'>
        <textarea className='input' rows={2} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} />
      </Field>
      <div className='modal-foot'>
        <button className='btn' onClick={onClose}>Cancelar</button>
        <button className='btn btn--primary' disabled={saving} onClick={save}>
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </Modal>
  );
}

export function Produtos({ onEtiquetas }: { onEtiquetas?: (productId: string) => void }) {
  const { data, error, reload } = useData(async () => {
    const [products, warehouses] = await Promise.all([
      db.list('products', { order: 'name', asc: true }),
      db.list('warehouses', { order: 'name', asc: true }),
    ]);
    return { products: products as Product[], warehouses: warehouses as Warehouse[] };
  }, []);
  const [editing, setEditing] = useState<Product | null | 'new'>(null);
  const [search, setSearch] = useState('');

  const rows = (data?.products ?? []).filter((p) =>
    (p.name + ' ' + (p.code ?? '') + ' ' + (p.barcode ?? '')).toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <PageHead
        title='Produtos'
        sub='Até 3 fotos por produto e geração de código de barras'
        actions={
          <>
            <input className='input input--search' placeholder='Buscar produto…' value={search} onChange={(e) => setSearch(e.target.value)} />
            <button className='btn btn--primary' onClick={() => setEditing('new')}>+ Novo produto</button>
          </>
        }
      />
      <ErrorNote message={error} />
      <Card>
        <DataTable
          cols={[
            { key: 'name', label: 'Produto' },
            { key: 'code', label: 'Código', render: (p: Product) => p.code ?? '—' },
            { key: 'category', label: 'Categoria', render: (p: Product) => p.category ?? '—' },
            { key: 'price', label: 'Preço', render: (p: Product) => fmtMoney(Number(p.price)) },
            {
              key: 'stock',
              label: 'Estoque',
              render: (p: Product) =>
                Number(p.stock) <= Number(p.min_stock) ? (
                  <Badge tone='red'>{p.stock} (baixo)</Badge>
                ) : (
                  <Badge tone='green'>{p.stock}</Badge>
                ),
            },
            {
              key: 'warehouse',
              label: 'Depósito',
              render: (p: Product) => data?.warehouses.find((w) => w.id === p.warehouse_id)?.name ?? '—',
            },
          ]}
          rows={rows}
          actions={(row) => (
            <>
              {onEtiquetas && (
                <button className='btn-link' onClick={() => onEtiquetas(row.id)} title='Imprimir etiquetas deste produto'>
                  Etiquetas
                </button>
              )}
              <button className='btn-link' onClick={() => setEditing(row)}>Editar</button>
              <ConfirmDelete
                what={row.name}
                onDelete={async () => {
                  await db.remove('products', row.id);
                  reload();
                }}
              />
            </>
          )}
        />
      </Card>
      {editing && (
        <ProductForm
          initial={editing === 'new' ? null : editing}
          warehouses={data?.warehouses ?? []}
          onClose={() => setEditing(null)}
          onSaved={reload}
        />
      )}
    </>
  );
}
