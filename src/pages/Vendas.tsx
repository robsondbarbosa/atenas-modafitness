import React, { useState } from 'react';
import { addDays, db, Party, Product, Sale, SaleItem, SaleKind } from '../db';
import { Badge, Card, ConfirmDelete, DataTable, ErrorNote, Field, fmtDate, fmtMoney, Modal, PageHead, today, useData } from '../ui';

const KIND_LABEL: Record<SaleKind, string> = { normal: 'Venda', consignada: 'Consignada', condicional: 'Condicional' };

export function statusTone(status: string) {
  return status === 'faturada' ? 'green' : status === 'aberta' ? 'gold' : 'gray';
}

/* ---------- Comprovante não fiscal ---------- */

export function Comprovante({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const { data: items } = useData<SaleItem[]>(() => db.list('sale_items', { eq: ['sale_id', sale.id] }) as Promise<SaleItem[]>, [sale.id]);
  const { data: parties } = useData<Party[]>(() => db.list('parties') as Promise<Party[]>, []);
  const customer = parties?.find((p) => p.id === sale.customer_id);
  const subtotal = (items ?? []).reduce((a, i) => a + Number(i.qty) * Number(i.price), 0);

  return (
    <Modal title={`Comprovante — Venda #${sale.seq}`} onClose={onClose} wide>
      <div id='print-area' className='receipt'>
        <h3>ATENAS MODA FITNESS</h3>
        <p className='muted'>Comprovante de venda — não fiscal</p>
        <div className='receipt-meta'>
          <span>Venda <strong>#{sale.seq}</strong></span>
          <span>Data: <strong>{fmtDate(sale.sale_date)}</strong></span>
          <span>Tipo: <strong>{KIND_LABEL[sale.kind]}</strong></span>
          <span>Situação: <strong>{sale.status}</strong></span>
        </div>
        <div className='receipt-meta'>
          <span>Cliente: <strong>{customer?.name ?? '—'}</strong></span>
          <span>Pagamento: <strong>{sale.payment === 'avista' ? 'À vista' : `Crediário ${sale.installments}x`}</strong></span>
        </div>
        <table className='table receipt-table'>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Qtd</th>
              <th>Preço</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((i) => (
              <tr key={i.id}>
                <td>{i.product_name}</td>
                <td>{Number(i.qty)}</td>
                <td>{fmtMoney(Number(i.price))}</td>
                <td>{fmtMoney(Number(i.qty) * Number(i.price))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className='receipt-totals'>
          <span>Subtotal: {fmtMoney(subtotal)}</span>
          <span>Desconto: {fmtMoney(Number(sale.discount))}</span>
          <strong>Total: {fmtMoney(Number(sale.total))}</strong>
        </div>
        {sale.notes && <p className='muted'>Obs.: {sale.notes}</p>}
      </div>
      <div className='modal-foot no-print'>
        <button className='btn' onClick={onClose}>Fechar</button>
        <button className='btn btn--primary' onClick={() => window.print()}>Imprimir</button>
      </div>
    </Modal>
  );
}

/* ---------- Faturar venda em aberto (consignada/condicional) ---------- */

function FaturarModal({ sale, onClose, onSaved }: { sale: Sale; onClose: () => void; onSaved: () => void }) {
  const [payment, setPayment] = useState<'avista' | 'crediario'>('avista');
  const [installments, setInstallments] = useState(2);
  const [err, setErr] = useState('');

  async function confirm() {
    setErr('');
    try {
      const n = payment === 'avista' ? 1 : Math.max(1, installments);
      const total = Number(sale.total);
      const per = Math.floor((total / n) * 100) / 100;
      const rows = Array.from({ length: n }, (_, i) => ({
        sale_id: sale.id,
        description: `Venda #${sale.seq} — parcela ${i + 1}/${n}`,
        amount: i === n - 1 ? Math.round((total - per * (n - 1)) * 100) / 100 : per,
        due_date: addDays(today(), 30 * i),
        status: 'aberto',
      }));
      await db.insertMany('receivables', rows);
      await db.update('sales', sale.id, { status: 'faturada', payment, installments: n });
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <Modal title={`Faturar venda #${sale.seq}`} onClose={onClose}>
      <ErrorNote message={err} />
      <div className='form-grid'>
        <Field label='Pagamento'>
          <select className='input' value={payment} onChange={(e) => setPayment(e.target.value as any)}>
            <option value='avista'>À vista</option>
            <option value='crediario'>Crediário (fiado)</option>
          </select>
        </Field>
        {payment === 'crediario' && (
          <Field label='Parcelas'>
            <input className='input' type='number' min={1} max={24} value={installments} onChange={(e) => setInstallments(Number(e.target.value))} />
          </Field>
        )}
      </div>
      <p className='muted'>
        Total: <strong>{fmtMoney(Number(sale.total))}</strong>
        {payment === 'crediario' && <> · {Math.max(1, installments)}x de {fmtMoney(Math.round((Number(sale.total) / Math.max(1, installments)) * 100) / 100)}</>}
      </p>
      <div className='modal-foot'>
        <button className='btn' onClick={onClose}>Cancelar</button>
        <button className='btn btn--primary' onClick={confirm}>Faturar e gerar títulos</button>
      </div>
    </Modal>
  );
}

/* ---------- Lista de vendas ---------- */

export function VendasPage({ go }: { go: (page: string) => void }) {
  const { data, error, reload } = useData(async () => {
    const [sales, parties] = await Promise.all([db.list('sales', { order: 'seq' }), db.list('parties')]);
    return { sales: sales as Sale[], parties: parties as Party[] };
  }, []);
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const [billing, setBilling] = useState<Sale | null>(null);
  const [filter, setFilter] = useState<'todas' | 'abertas' | 'faturadas'>('todas');

  const rows = (data?.sales ?? []).filter((s) =>
    filter === 'todas' ? true : filter === 'abertas' ? s.status === 'aberta' : s.status === 'faturada',
  );
  const partyName = (id?: string | null) => data?.parties.find((p) => p.id === id)?.name ?? '—';

  async function devolver(sale: Sale) {
    if (!window.confirm(`Devolver todos os itens da venda #${sale.seq} ao estoque?`)) return;
    try {
      const items = (await db.list('sale_items', { eq: ['sale_id', sale.id] })) as SaleItem[];
      for (const item of items) {
        if (item.product_id && Number(item.returned_qty) < Number(item.qty)) {
          const product = (await db.list('products', { eq: ['id', item.product_id] }))[0] as Product | undefined;
          if (product) {
            await db.update('products', product.id, { stock: Number(product.stock) + Number(item.qty) });
          }
          await db.insert('stock_moves', {
            product_id: item.product_id,
            qty: Number(item.qty),
            kind: 'devolucao',
            note: `Devolução venda #${sale.seq}`,
          });
          await db.update('sale_items', item.id, { returned_qty: item.qty });
        }
      }
      await db.update('sales', sale.id, { status: 'devolvida' });
      reload();
    } catch (e: any) {
      window.alert('Erro: ' + e.message);
    }
  }

  return (
    <>
      <PageHead
        title='Vendas'
        actions={<button className='btn btn--primary' onClick={() => go('nova-venda')}>+ Nova venda</button>}
      />
      <ErrorNote message={error} />
      <div className='filter-row'>
        {(['todas', 'abertas', 'faturadas'] as const).map((f) => (
          <button key={f} className={`chip${filter === f ? ' chip--on' : ''}`} onClick={() => setFilter(f)}>
            {f === 'todas' ? 'Todas' : f === 'abertas' ? 'Em aberto' : 'Faturadas'}
          </button>
        ))}
      </div>
      <Card>
        <DataTable
          cols={[
            { key: 'seq', label: '#', render: (s: Sale) => `#${s.seq}` },
            { key: 'sale_date', label: 'Data', render: (s: Sale) => fmtDate(s.sale_date) },
            { key: 'customer', label: 'Cliente', render: (s: Sale) => partyName(s.customer_id) },
            { key: 'seller', label: 'Vendedor', render: (s: Sale) => partyName(s.seller_id) },
            { key: 'kind', label: 'Tipo', render: (s: Sale) => KIND_LABEL[s.kind] },
            { key: 'payment', label: 'Pagamento', render: (s: Sale) => (s.payment === 'avista' ? 'À vista' : `${s.installments}x`) },
            { key: 'status', label: 'Situação', render: (s: Sale) => <Badge tone={statusTone(s.status)}>{s.status}</Badge> },
            { key: 'total', label: 'Total', render: (s: Sale) => fmtMoney(Number(s.total)) },
          ]}
          rows={rows}
          empty='Nenhuma venda encontrada.'
          actions={(s) => (
            <>
              <button className='btn-link' onClick={() => setReceipt(s)}>Comprovante</button>
              {s.kind !== 'normal' && s.status === 'aberta' && (
                <>
                  <button className='btn-link' onClick={() => setBilling(s)}>Faturar</button>
                  <button className='btn-link danger' onClick={() => devolver(s)}>Devolver</button>
                </>
              )}
              {s.status === 'faturada' && (
                <ConfirmDelete
                  what={`a venda #${s.seq}`}
                  onDelete={async () => {
                    await db.remove('sales', s.id);
                    reload();
                  }}
                />
              )}
            </>
          )}
        />
      </Card>
      {receipt && <Comprovante sale={receipt} onClose={() => setReceipt(null)} />}
      {billing && <FaturarModal sale={billing} onClose={() => setBilling(null)} onSaved={reload} />}
    </>
  );
}

/* ---------- Nova venda ---------- */

interface DraftItem {
  id: string;
  product_id: string;
  name: string;
  qty: number;
  price: number;
  stock: number;
}

export function NovaVendaPage({ go }: { go: (page: string) => void }) {
  const { data, error, reload } = useData(async () => {
    const [products, parties] = await Promise.all([
      db.list('products', { order: 'name', asc: true }),
      db.list('parties'),
    ]);
    return {
      products: products as Product[],
      customers: (parties as Party[]).filter((p) => p.kind === 'cliente'),
      sellers: (parties as Party[]).filter((p) => p.kind === 'vendedor'),
    };
  }, []);

  const [items, setItems] = useState<DraftItem[]>([]);
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(0);
  const [customerId, setCustomerId] = useState('');
  const [sellerId, setSellerId] = useState('');
  const [kind, setKind] = useState<SaleKind>('normal');
  const [payment, setPayment] = useState<'avista' | 'crediario'>('avista');
  const [installments, setInstallments] = useState(2);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [receipt, setReceipt] = useState<Sale | null>(null);

  const products = data?.products ?? [];
  const selected = products.find((p) => p.id === productId);

  function pickProduct(id: string) {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    if (p) setPrice(Number(p.price));
  }

  function addItem() {
    if (!selected) {
      setErr('Selecione um produto.');
      return;
    }
    setErr('');
    setItems((list) => {
      const existing = list.find((i) => i.product_id === selected.id);
      if (existing) {
        return list.map((i) => (i.product_id === selected.id ? { ...i, qty: i.qty + qty, price } : i));
      }
      return [...list, { id: selected.id, product_id: selected.id, name: selected.name, qty, price, stock: Number(selected.stock) }];
    });
    setProductId('');
    setQty(1);
    setPrice(0);
  }

  const subtotal = items.reduce((a, i) => a + i.qty * i.price, 0);
  const total = Math.max(0, subtotal - discount);

  async function save() {
    if (!items.length) {
      setErr('Adicione pelo menos um produto.');
      return;
    }
    const insufficient = items.filter((i) => kind === 'normal' && i.qty > i.stock);
    if (insufficient.length) {
      setErr(`Estoque insuficiente para: ${insufficient.map((i) => i.name).join(', ')}.`);
      return;
    }
    setSaving(true);
    setErr('');
    try {
      const status = kind === 'normal' ? 'faturada' : 'aberta';
      const sale = (await db.insert('sales', {
        sale_date: today(),
        customer_id: customerId || null,
        seller_id: sellerId || null,
        kind,
        status,
        payment: kind === 'normal' ? payment : 'avista',
        installments: kind === 'normal' && payment === 'crediario' ? Math.max(1, installments) : 1,
        discount,
        total,
        notes,
      })) as Sale;

      await db.insertMany(
        'sale_items',
        items.map((i) => ({ sale_id: sale.id, product_id: i.product_id, product_name: i.name, qty: i.qty, price: i.price })),
      );

      for (const i of items) {
        const p = products.find((x) => x.id === i.product_id);
        if (p) await db.update('products', p.id, { stock: Number(p.stock) - i.qty });
        await db.insert('stock_moves', { product_id: i.product_id, qty: i.qty, kind: 'venda', note: `Venda #${sale.seq}` });
      }

      if (kind === 'normal') {
        const n = payment === 'avista' ? 1 : Math.max(1, installments);
        const per = Math.floor((total / n) * 100) / 100;
        await db.insertMany(
          'receivables',
          Array.from({ length: n }, (_, idx) => ({
            sale_id: sale.id,
            description: `Venda #${sale.seq} — parcela ${idx + 1}/${n}`,
            amount: idx === n - 1 ? Math.round((total - per * (n - 1)) * 100) / 100 : per,
            due_date: addDays(today(), 30 * idx),
            status: 'aberto',
          })),
        );
      }

      setItems([]);
      setDiscount(0);
      setNotes('');
      reload();
      setReceipt(sale);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHead title='Nova venda' sub='Venda normal, consignada ou condicional' />
      <ErrorNote message={error} />
      <div className='two-col two-col--form'>
        <Card title='Produtos'>
          <div className='sale-picker'>
            <Field label='Produto'>
              <select className='input' value={productId} onChange={(e) => pickProduct(e.target.value)}>
                <option value=''>Selecione…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {fmtMoney(Number(p.price))} (estoque {p.stock})
                  </option>
                ))}
              </select>
            </Field>
            <Field label='Qtd'>
              <input className='input' type='number' min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
            </Field>
            <Field label='Preço (R$)'>
              <input className='input' type='number' step='0.01' value={price} onChange={(e) => setPrice(Number(e.target.value))} />
            </Field>
            <button className='btn btn--primary' onClick={addItem}>Adicionar</button>
          </div>

          <DataTable
            cols={[
              { key: 'name', label: 'Produto', render: (i: DraftItem) => i.name },
              { key: 'qty', label: 'Qtd' },
              { key: 'price', label: 'Preço', render: (i: DraftItem) => fmtMoney(i.price) },
              { key: 'sub', label: 'Subtotal', render: (i: DraftItem) => fmtMoney(i.qty * i.price) },
            ]}
            rows={items}
            empty='Nenhum item adicionado.'
            actions={(i) => (
              <button className='btn-link danger' onClick={() => setItems((list) => list.filter((x) => x.product_id !== i.product_id))}>
                Remover
              </button>
            )}
          />
        </Card>

        <Card title='Dados da venda'>
          <div className='form-grid'>
            <Field label='Cliente'>
              <select className='input' value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value=''>—</option>
                {(data?.customers ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
            <Field label='Vendedor'>
              <select className='input' value={sellerId} onChange={(e) => setSellerId(e.target.value)}>
                <option value=''>—</option>
                {(data?.sellers ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
            <Field label='Tipo de venda'>
              <select className='input' value={kind} onChange={(e) => setKind(e.target.value as SaleKind)}>
                <option value='normal'>Venda normal</option>
                <option value='consignada'>Consignada</option>
                <option value='condicional'>Condicional</option>
              </select>
            </Field>
            {kind === 'normal' && (
              <>
                <Field label='Pagamento'>
                  <select className='input' value={payment} onChange={(e) => setPayment(e.target.value as any)}>
                    <option value='avista'>À vista</option>
                    <option value='crediario'>Crediário (fiado)</option>
                  </select>
                </Field>
                {payment === 'crediario' && (
                  <Field label='Parcelas'>
                    <input className='input' type='number' min={1} max={24} value={installments} onChange={(e) => setInstallments(Number(e.target.value))} />
                  </Field>
                )}
              </>
            )}
            <Field label='Desconto (R$)'>
              <input className='input' type='number' step='0.01' value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
            </Field>
            <Field label='Observações'>
              <textarea className='input' rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>
          <div className='sale-totals'>
            <span>Subtotal: {fmtMoney(subtotal)}</span>
            <strong>Total: {fmtMoney(total)}</strong>
          </div>
          <ErrorNote message={err} />
          <div className='btn-row'>
            <button className='btn btn--primary btn--block' disabled={saving} onClick={save}>
              {saving ? 'Salvando…' : 'Finalizar venda'}
            </button>
            <button className='btn btn--block' onClick={() => go('vendas')}>Ver vendas</button>
          </div>
          {kind !== 'normal' && (
            <p className='muted'>
              Em vendas {KIND_LABEL[kind].toLowerCase()}s os itens saem do estoque e a venda fica <strong>em aberto</strong> até você faturar ou devolver.
            </p>
          )}
        </Card>
      </div>
      {receipt && <Comprovante sale={receipt} onClose={() => setReceipt(null)} />}
    </>
  );
}
