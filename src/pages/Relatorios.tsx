import React, { useState } from 'react';
import { db, Party, Product, Sale, SaleItem } from '../db';
import { Badge, Card, ErrorNote, fmtMoney, PageHead, useData } from '../ui';

/* ---------- Relatório de comissão dos vendedores ---------- */

function Comissoes() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const { data, error } = useData(async () => {
    const [sales, parties] = await Promise.all([db.list('sales'), db.list('parties', { eq: ['kind', 'vendedor'] })]);
    return { sales: sales as Sale[], sellers: parties as Party[] };
  }, []);

  const rows = (data?.sellers ?? []).map((seller) => {
    const sales = (data?.sales ?? []).filter(
      (s) => s.seller_id === seller.id && s.status === 'faturada' && (s.sale_date ?? '').startsWith(month),
    );
    const total = sales.reduce((a, s) => a + Number(s.total), 0);
    const pct = Number(seller.commission_pct ?? 0);
    return { id: seller.id, name: seller.name, count: sales.length, total, pct, commission: Math.round(total * pct) / 100 };
  });

  return (
    <>
      <PageHead title='Relatório de comissões' sub='Comissão por vendedor sobre vendas faturadas no mês' />
      <ErrorNote message={error} />
      <Card title='Mês de referência'>
        <input className='input input--month' type='month' value={month} onChange={(e) => setMonth(e.target.value)} />
        <table className='table'>
          <thead>
            <tr>
              <th>Vendedor</th>
              <th>Vendas</th>
              <th>Total vendido</th>
              <th>Comissão</th>
              <th>Valor da comissão</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className='empty-cell'>Nenhum vendedor cadastrado.</td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.count}</td>
                <td>{fmtMoney(r.total)}</td>
                <td>{r.pct}%</td>
                <td>
                  <strong>{fmtMoney(r.commission)}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className='muted'>Configure o percentual de cada vendedor no cadastro de vendedores.</p>
      </Card>
    </>
  );
}

/* ---------- Planejamento de compras ---------- */

function Compras() {
  const { data, error } = useData(() => db.list('products', { order: 'name', asc: true }) as Promise<Product[]>, []);
  const low = (data ?? []).filter((p) => Number(p.stock) <= Number(p.min_stock));
  const rows = low.map((p) => {
    const suggest = Math.max(0, Number(p.min_stock) * 2 - Number(p.stock));
    return { ...p, suggest, costEstimate: suggest * Number(p.cost) };
  });
  const totalEstimate = rows.reduce((a, r) => a + r.costEstimate, 0);

  return (
    <>
      <PageHead title='Planejamento de compras' sub='Produtos que atingiram o estoque mínimo e sugestão de reposição' />
      <ErrorNote message={error} />
      <Card>
        <table className='table'>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Estoque</th>
              <th>Mínimo</th>
              <th>Sugestão de compra</th>
              <th>Custo estimado</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className='empty-cell'>Nenhum produto abaixo do estoque mínimo. Tudo em ordem!</td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td><Badge tone='red'>{r.stock}</Badge></td>
                <td>{r.min_stock}</td>
                <td><strong>{r.suggest}</strong></td>
                <td>{fmtMoney(r.costEstimate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 0 && (
          <p className='compras-total'>
            Custo total estimado: <strong>{fmtMoney(totalEstimate)}</strong>
          </p>
        )}
        <p className='muted'>A sugestão repõe o estoque até o dobro do mínimo cadastrado. Ajuste o mínimo em cada produto conforme sua rotação.</p>
      </Card>
    </>
  );
}

/* ---------- Relatório de lucro e venda ---------- */

function Lucro() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const { data, error } = useData(async () => {
    const [sales, items, products] = await Promise.all([
      db.list('sales'),
      db.list('sale_items'),
      db.list('products'),
    ]);
    return {
      sales: sales as Sale[],
      items: items as SaleItem[],
      products: products as Product[],
    };
  }, []);

  if (error) return <ErrorNote message={error} />;

  const costOf = (productId?: string | null) => {
    const p = data?.products.find((x) => x.id === productId);
    return p ? Number(p.cost) : 0;
  };

  const monthSales = (data?.sales ?? []).filter(
    (s) => s.status === 'faturada' && (s.sale_date ?? '').startsWith(month),
  );
  const monthSalesIds = new Set(monthSales.map((s) => s.id));
  const monthItems = (data?.items ?? []).filter((i) => monthSalesIds.has(i.sale_id));

  const revenue = monthSales.reduce((a, s) => a + Number(s.total), 0);
  const cost = monthItems.reduce((a, i) => a + Number(i.qty) * costOf(i.product_id), 0);
  const profit = revenue - cost;
  const margin = revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0;

  const byProduct = new Map<string, { name: string; qty: number; revenue: number; cost: number }>();
  for (const i of monthItems) {
    const key = i.product_id ?? i.product_name;
    const row = byProduct.get(key) ?? { name: i.product_name, qty: 0, revenue: 0, cost: 0 };
    row.qty += Number(i.qty);
    row.revenue += Number(i.qty) * Number(i.price);
    row.cost += Number(i.qty) * costOf(i.product_id);
    byProduct.set(key, row);
  }
  const rows = [...byProduct.values()]
    .map((r) => ({ ...r, profit: r.revenue - r.cost }))
    .sort((a, b) => b.revenue - a.revenue);

  return (
    <>
      <PageHead title='Relatório de lucro e venda' sub='Faturamento, custo e lucro das vendas faturadas no mês' />
      <div className='filter-row'>
        <input className='input input--month' type='month' value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>
      <div className='stat-grid'>
        <div className='stat stat--gold'>
          <span className='stat-label'>Faturamento</span>
          <strong className='stat-value'>{fmtMoney(revenue)}</strong>
          <span className='stat-hint'>{monthSales.length} venda(s) faturada(s)</span>
        </div>
        <div className='stat stat--red'>
          <span className='stat-label'>Custo dos produtos</span>
          <strong className='stat-value'>{fmtMoney(cost)}</strong>
          <span className='stat-hint'>baseado no custo cadastrado</span>
        </div>
        <div className='stat stat--green'>
          <span className='stat-label'>Lucro</span>
          <strong className='stat-value'>{fmtMoney(profit)}</strong>
          <span className='stat-hint'>margem de {margin}%</span>
        </div>
      </div>
      <Card title='Vendas por produto'>
        <table className='table'>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Qtd vendida</th>
              <th>Faturamento</th>
              <th>Custo</th>
              <th>Lucro</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className='empty-cell'>Nenhuma venda faturada neste mês.</td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.name}>
                <td>{r.name}</td>
                <td>{r.qty}</td>
                <td>{fmtMoney(r.revenue)}</td>
                <td>{fmtMoney(r.cost)}</td>
                <td className={r.profit >= 0 ? 'lucro-pos' : 'lucro-neg'}>
                  <strong>{fmtMoney(r.profit)}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className='muted'>O custo usa o valor cadastrado hoje em cada produto. Para mais precisão, mantenha o custo atualizado.</p>
      </Card>
    </>
  );
}

/* ---------- Roteador de relatórios ---------- */

export function Relatorios({ view }: { view: 'comissoes' | 'compras' | 'lucro' }) {
  if (view === 'comissoes') return <Comissoes />;
  if (view === 'lucro') return <Lucro />;
  return <Compras />;
}
