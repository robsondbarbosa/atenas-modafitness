import React, { useState } from 'react';
import { db, Product } from '../db';
import { Code39 } from '../barcode';
import { Badge, Card, ErrorNote, Field, fmtMoney, PageHead, useData } from '../ui';

type LabelSize = 'p' | 'm' | 'g';

const SIZES: { id: LabelSize; label: string; module: number; height: number; hint: string }[] = [
  { id: 'p', label: 'Pequena', module: 1.2, height: 26, hint: '≈ 3,8 × 2 cm' },
  { id: 'm', label: 'Média', module: 1.6, height: 36, hint: '≈ 5 × 2,5 cm' },
  { id: 'g', label: 'Grande', module: 2.1, height: 46, hint: '≈ 6,5 × 3,3 cm' },
];

const MAX_PER_PRODUCT = 60;
const MAX_TOTAL_LABELS = 500;

function ProductLabel({ product, size, showPrice }: { product: Product; size: LabelSize; showPrice: boolean }) {
  const cfg = SIZES.find((s) => s.id === size)!;
  const code = product.barcode || product.code || '';
  return (
    <div className={`label label--${size}`}>
      <span className='label-name' title={product.name}>{product.name}</span>
      {code ? (
        <Code39 value={code} height={cfg.height} module={cfg.module} showText={size !== 'p'} />
      ) : (
        <span className='label-nocode'>sem código</span>
      )}
      {showPrice && <span className='label-price'>{fmtMoney(Number(product.price))}</span>}
    </div>
  );
}

/** Distribui o teto MAX_TOTAL_LABELS igualmente entre os produtos com código.
 *  Retorna a fila de etiquetas e quantos produtos foram parcialmente cortados. */
function buildPrintQueue(
  selectedProducts: Product[],
  perProduct: number,
): { queue: { product: Product; index: number }[]; excludedCount: number } {
  const withCode = selectedProducts.filter((p) => p.barcode || p.code);
  if (withCode.length === 0) return { queue: [], excludedCount: 0 };

  // Distribui o cap igualmente; cada produto recebe no máximo perProduct
  const fairShare = Math.min(perProduct, Math.floor(MAX_TOTAL_LABELS / withCode.length));
  const perEach = Math.max(1, fairShare);

  const queue: { product: Product; index: number }[] = [];
  let excludedCount = 0;

  for (const p of withCode) {
    const actual = Math.min(perEach, MAX_TOTAL_LABELS - queue.length);
    if (actual <= 0) {
      excludedCount++;
      continue;
    }
    if (actual < perProduct) excludedCount++;
    for (let i = 0; i < actual; i++) queue.push({ product: p, index: i });
  }

  return { queue, excludedCount };
}

export function Etiquetas({ initialProductId = '' }: { initialProductId?: string }) {
  const { data: products, error } = useData<Product[]>(
    () => db.list('products', { order: 'name', asc: true }) as Promise<Product[]>,
    [],
  );
  const [selected, setSelected] = useState<Record<string, boolean>>(
    initialProductId ? { [initialProductId]: true } : {},
  );
  const [search, setSearch] = useState('');
  // Store raw string so the user can clear the field and retype freely
  const [qtyRaw, setQtyRaw] = useState('6');
  const [showPrice, setShowPrice] = useState(true);
  const [size, setSize] = useState<LabelSize>('m');

  const all = products ?? [];
  const term = search.toLowerCase().trim();
  const rows = all.filter((p) =>
    (p.name + ' ' + (p.code ?? '') + ' ' + (p.barcode ?? '')).toLowerCase().includes(term),
  );
  const selectedProducts = all.filter((p) => selected[p.id]);
  const hasSelection = selectedProducts.length > 0;

  // Parse qty only for display/logic; keep raw string in the input
  const perProduct = Math.max(1, Math.min(MAX_PER_PRODUCT, Math.floor(Number(qtyRaw)) || 1));
  const uncappedTotal = selectedProducts.reduce((a, p) => a + (p.barcode || p.code ? perProduct : 0), 0);
  const capped = uncappedTotal > MAX_TOTAL_LABELS;
  const withoutCode = selectedProducts.filter((p) => !p.barcode && !p.code).length;

  const { queue, excludedCount } = buildPrintQueue(selectedProducts, perProduct);
  const totalLabels = queue.length;

  const toggle = (id: string) => setSelected((s) => ({ ...s, [id]: !s[id] }));

  function commitQty(raw: string) {
    const n = Math.max(1, Math.min(MAX_PER_PRODUCT, Math.floor(Number(raw)) || 1));
    setQtyRaw(String(n));
  }

  return (
    <>
      <PageHead
        title='Etiquetas e códigos de barras'
        sub='Selecione os produtos, escolha o tamanho e imprima na impressora comum (padrão Code 39)'
      />
      <ErrorNote message={error} />
      <div className='two-col two-col--labels no-print'>
        <Card title='Produtos'>
          <input
            className='input'
            placeholder='Buscar por nome, código ou código de barras…'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginBottom: 10 }}
          />
          <div className='label-picker'>
            {rows.length === 0 && (
              <p className='muted'>
                {all.length === 0
                  ? 'Nenhum produto cadastrado.'
                  : 'Nenhum produto encontrado para esta busca.'}
              </p>
            )}
            {rows.map((p) => (
              <label key={p.id} className={`label-pick${selected[p.id] ? ' label-pick--on' : ''}`}>
                <input type='checkbox' checked={!!selected[p.id]} onChange={() => toggle(p.id)} />
                <span className='label-pick-name'>{p.name}</span>
                <span className='label-pick-code'>{p.barcode || p.code || '—'}</span>
              </label>
            ))}
          </div>
          {/* "Marcar todos" only when rows exist; "Limpar seleção" whenever there is an active selection */}
          {(rows.length > 0 || hasSelection) && (
            <div className='btn-row'>
              {rows.length > 0 && (
                <button
                  className='btn btn--small'
                  onClick={() =>
                    setSelected((s) => {
                      const next = { ...s };
                      rows.forEach((p) => (next[p.id] = true));
                      return next;
                    })
                  }
                >
                  Marcar todos
                </button>
              )}
              {hasSelection && (
                <button className='btn btn--small' onClick={() => setSelected({})}>
                  Limpar seleção
                </button>
              )}
            </div>
          )}
        </Card>

        <Card title='Impressão'>
          <div className='form-grid'>
            <Field label={`Etiquetas por produto (1–${MAX_PER_PRODUCT})`}>
              <input
                className='input'
                type='number'
                min={1}
                max={MAX_PER_PRODUCT}
                value={qtyRaw}
                onChange={(e) => setQtyRaw(e.target.value)}
                onBlur={(e) => commitQty(e.target.value)}
              />
            </Field>
            <Field label='Tamanho da etiqueta'>
              <select className='input' value={size} onChange={(e) => setSize(e.target.value as LabelSize)}>
                {SIZES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label} — {s.hint}</option>
                ))}
              </select>
            </Field>
          </div>
          <label className='check-row' style={{ marginBottom: 12 }}>
            <input type='checkbox' checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} />
            <span>Incluir preço na etiqueta</span>
          </label>
          {withoutCode > 0 && (
            <p className='muted'>
              <Badge tone='gold'>{withoutCode}</Badge> produto(s) sem código de barras — gere o código
              no cadastro do produto (botão "Gerar") para incluí-los na impressão.
            </p>
          )}
          <p className='muted'>
            Selecionados: <strong>{selectedProducts.length}</strong> produto(s) ·{' '}
            <strong>{totalLabels}</strong> etiqueta(s)
            {capped && (
              <>
                {' '}
                <Badge tone='gold'>limite de {MAX_TOTAL_LABELS}</Badge>
                {excludedCount > 0 && (
                  <> — {excludedCount} produto(s) com etiquetas reduzidas ou omitidos</>
                )}
              </>
            )}
          </p>
          <button
            className='btn btn--primary btn--block no-print'
            onClick={() => window.print()}
            disabled={totalLabels === 0}
          >
            Imprimir {totalLabels > 0 ? `${totalLabels} etiquetas` : ''}
          </button>
        </Card>
      </div>

      <Card title='Pré-visualização'>
        <div id='print-area' className='labels-grid labels-grid--print'>
          {queue.map(({ product, index }) => (
            <ProductLabel key={product.id + '-' + index} product={product} size={size} showPrice={showPrice} />
          ))}
          {totalLabels === 0 && (
            <p className='muted'>Selecione pelo menos um produto com código de barras para ver as etiquetas.</p>
          )}
        </div>
      </Card>
    </>
  );
}
