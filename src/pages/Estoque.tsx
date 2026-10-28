import React, { useState } from 'react';
import { db, Product, StockMove, Warehouse } from '../db';
import { Badge, Card, ErrorNote, Field, fmtDate, Modal, PageHead, useData } from '../ui';

function MoveModal({ product, mode, onClose, onSaved }: {
  product: Product;
  mode: 'entrada' | 'ajuste';
  onClose: () => void;
  onSaved: () => void;
}) {
  const [qty, setQty] = useState(mode === 'entrada' ? 1 : Number(product.stock));
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');

  async function save() {
    setErr('');
    const diff = mode === 'entrada' ? Number(qty) : Number(qty) - Number(product.stock);
    if (mode === 'entrada' ? qty <= 0 : diff === 0) {
      setErr('Informe uma quantidade válida.');
      return;
    }
    try {
      await db.update('products', product.id, { stock: Number(qty) });
      await db.insert('stock_moves', {
        product_id: product.id,
        qty: mode === 'entrada' ? Number(qty) : diff,
        kind: mode === 'entrada' ? 'entrada' : 'ajuste',
        note: note || undefined,
      });
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <Modal title={mode === 'entrada' ? `Entrada de estoque — ${product.name}` : `Ajustar estoque — ${product.name}`} onClose={onClose}>
      <ErrorNote message={err} />
      <div className='form-grid'>
        <Field label={mode === 'entrada' ? 'Quantidade a adicionar' : 'Estoque atualizado'}>
          <input className='input' type='number' value={qty} onChange={(e) => setQty(Number(e.target.value))} autoFocus />
        </Field>
        <Field label='Observação'>
          <input className='input' value={note} onChange={(e) => setNote(e.target.value)} placeholder='Ex.: compra fornecedor X' />
        </Field>
      </div>
      <p className='muted'>Estoque atual: <strong>{product.stock}</strong></p>
      <div className='modal-foot'>
        <button className='btn' onClick={onClose}>Cancelar</button>
        <button className='btn btn--primary' onClick={save}>Confirmar</button>
      </div>
    </Modal>
  );
}

function HistoryModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const { data: moves, error } = useData<StockMove[]>(
    () => db.list('stock_moves', { eq: ['product_id', product.id], order: 'moved_at' }) as Promise<StockMove[]>,
    [product.id],
  );
  return (
    <Modal title={`Histórico — ${product.name}`} onClose={onClose}>
      <ErrorNote message={error} />
      <div className='simple-list simple-list--scroll'>
        {(moves ?? []).length === 0 && <p className='muted'>Sem movimentações.</p>}
        {(moves ?? []).map((m) => (
          <div key={m.id} className='move-row'>
            <span className={`move-qty ${Number(m.qty) >= 0 ? 'pos' : 'neg'}`}>
              {Number(m.qty) >= 0 ? '+' : ''}{Number(m.qty)}
            </span>
            <span>{m.kind}</span>
            <span className='muted'>{fmtDate(m.moved_at)}{m.note ? ` · ${m.note}` : ''}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function Estoque() {
  const { data, error, reload } = useData(async () => {
    const [products, warehouses] = await Promise.all([
      db.list('products', { order: 'name', asc: true }),
      db.list('warehouses', { order: 'name', asc: true }),
    ]);
    return { products: products as Product[], warehouses: warehouses as Warehouse[] };
  }, []);
  const [modal, setModal] = useState<{ product: Product; mode: 'entrada' | 'ajuste' | 'historico' } | null>(null);
  const [search, setSearch] = useState('');

  const rows = (data?.products ?? []).filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <PageHead
        title='Controle de estoque'
        sub='Saldo por produto, entradas, ajustes e histórico de movimentações'
        actions={
          <input className='input input--search' placeholder='Buscar produto…' value={search} onChange={(e) => setSearch(e.target.value)} />
        }
      />
      <ErrorNote message={error} />
      <Card>
        <table className='table'>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Categoria</th>
              <th>Depósito</th>
              <th>Estoque</th>
              <th>Mínimo</th>
              <th>Situação</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className='empty-cell'>Nenhum produto cadastrado.</td>
              </tr>
            )}
            {rows.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.category ?? '—'}</td>
                <td>{data?.warehouses.find((w) => w.id === p.warehouse_id)?.name ?? '—'}</td>
                <td>{p.stock}</td>
                <td>{p.min_stock}</td>
                <td>
                  {Number(p.stock) <= Number(p.min_stock) ? <Badge tone='red'>Baixo</Badge> : <Badge tone='green'>OK</Badge>}
                </td>
                <td className='td-actions'>
                  <button className='btn-link' onClick={() => setModal({ product: p, mode: 'entrada' })}>Entrada</button>
                  <button className='btn-link' onClick={() => setModal({ product: p, mode: 'ajuste' })}>Ajustar</button>
                  <button className='btn-link' onClick={() => setModal({ product: p, mode: 'historico' })}>Histórico</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {modal && modal.mode !== 'historico' && (
        <MoveModal product={modal.product} mode={modal.mode} onClose={() => setModal(null)} onSaved={reload} />
      )}
      {modal && modal.mode === 'historico' && <HistoryModal product={modal.product} onClose={() => setModal(null)} />}
    </>
  );
}
