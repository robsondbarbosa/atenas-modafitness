import React from 'react';
import { db, Party, Product, Receivable, Sale } from '../db';
import { Badge, Card, DataTable, ErrorNote, fmtDate, fmtMoney, PageHead, useData } from '../ui';

function daysToBirthday(bd: string): number {
  const [, m, d] = bd.split('-').map(Number);
  if (!m || !d) return 999;
  const now = new Date();
  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), m - 1, d);
  if (next < today0) next = new Date(now.getFullYear() + 1, m - 1, d);
  return Math.round((+next - +today0) / 86400000);
}

export function Dashboard({ go }: { go: (page: string) => void }) {
  const month = new Date().toISOString().slice(0, 7);

  const { data, error } = useData(async () => {
    const [sales, receivables, payables, parties, products] = await Promise.all([
      db.list('sales', { order: 'created_at' }),
      db.list('receivables'),
      db.list('payables'),
      db.list('parties'),
      db.list('products'),
    ]);
    return {
      sales: sales as Sale[],
      receivables: receivables as Receivable[],
      payables: payables as any[],
      parties: parties as Party[],
      products: products as Product[],
    };
  }, []);

  if (error) return <ErrorNote message={error} />;
  if (!data) return <p className='loading'>Carregando…</p>;

  const { sales, receivables, payables, parties, products } = data;

  const monthSales = sales.filter((s) => s.status === 'faturada' && (s.sale_date ?? '').startsWith(month));
  const monthTotal = monthSales.reduce((acc, s) => acc + Number(s.total), 0);
  const toReceive = receivables.filter((r) => r.status === 'aberto').reduce((a, r) => a + Number(r.amount), 0);
  const toPay = payables.filter((p) => p.status === 'aberto').reduce((a, p) => a + Number(p.amount), 0);
  const openSales = sales.filter((s) => s.kind !== 'normal' && s.status === 'aberta').length;
  const lowStock = products.filter((p) => Number(p.stock) <= Number(p.min_stock)).length;

  const birthdays = parties
    .filter((p) => p.kind === 'cliente' && p.birth_date && daysToBirthday(p.birth_date) <= 30)
    .map((p) => ({ ...p, days: daysToBirthday(p.birth_date!) }))
    .sort((a, b) => a.days - b.days)
    .slice(0, 8);

  const recent = [...sales].sort((a, b) => (b.seq ?? 0) - (a.seq ?? 0)).slice(0, 8);

  const partyName = (id?: string | null) => parties.find((p) => p.id === id)?.name ?? '—';

  const cards = [
    { label: 'Vendas faturadas no mês', value: fmtMoney(monthTotal), hint: `${monthSales.length} venda(s)`, tone: 'gold' },
    { label: 'A receber (em aberto)', value: fmtMoney(toReceive), hint: `${receivables.filter((r) => r.status === 'aberto').length} título(s)`, tone: 'green' },
    { label: 'A pagar (em aberto)', value: fmtMoney(toPay), hint: `${payables.filter((p) => p.status === 'aberto').length} título(s)`, tone: 'red' },
    { label: 'Vendas em aberto', value: String(openSales), hint: 'consignada / condicional', tone: 'blue' },
  ];

  return (
    <>
      <PageHead title='Dashboard' sub='Visão geral do seu negócio' />
      <div className='stat-grid'>
        {cards.map((c) => (
          <div key={c.label} className={`stat stat--${c.tone}`}>
            <span className='stat-label'>{c.label}</span>
            <strong className='stat-value'>{c.value}</strong>
            <span className='stat-hint'>{c.hint}</span>
          </div>
        ))}
      </div>

      <div className='two-col'>
        <Card title='Próximos aniversariantes'>
          {birthdays.length === 0 ? (
            <p className='muted'>Nenhum aniversariante nos próximos 30 dias.</p>
          ) : (
            <ul className='simple-list'>
              {birthdays.map((p) => (
                <li key={p.id}>
                  <span>{p.name}</span>
                  <span className='muted'>
                    {fmtDate(p.birth_date)} · {p.days === 0 ? 'hoje!' : `em ${p.days} dia(s)`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title='Produtos com estoque baixo'>
          {lowStock === 0 ? (
            <p className='muted'>Todos os produtos com estoque saudável.</p>
          ) : (
            <p>
              <strong className='text-gold-deep'>{lowStock}</strong> produto(s) atingiram o estoque mínimo.{' '}
              <button className='btn-link' onClick={() => go('compras')}>
                Ver planejamento de compras →
              </button>
            </p>
          )}
        </Card>
      </div>

      <Card title='Últimas vendas' actions={<button className='btn btn--small' onClick={() => go('vendas')}>Ver todas</button>}>
        <DataTable
          cols={[
            { key: 'seq', label: '#', render: (s: Sale) => `#${s.seq}` },
            { key: 'sale_date', label: 'Data', render: (s: Sale) => fmtDate(s.sale_date) },
            { key: 'customer', label: 'Cliente', render: (s: Sale) => partyName(s.customer_id) },
            { key: 'kind', label: 'Tipo', render: (s: Sale) => (s.kind === 'normal' ? 'Venda' : s.kind === 'consignada' ? 'Consignada' : 'Condicional') },
            { key: 'status', label: 'Situação', render: (s: Sale) => <Badge tone={s.status === 'faturada' ? 'green' : s.status === 'aberta' ? 'gold' : 'gray'}>{s.status}</Badge> },
            { key: 'total', label: 'Total', render: (s: Sale) => fmtMoney(Number(s.total)) },
          ]}
          rows={recent}
          empty='Nenhuma venda registrada ainda. Comece em "Nova venda".'
        />
      </Card>
    </>
  );
}
