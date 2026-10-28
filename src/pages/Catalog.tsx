import React, { useEffect, useState } from 'react';
import { db, Product } from '../db';
import { Card, ErrorNote, fmtMoney, Modal, PageHead, useData } from '../ui';

/* ---------- Card de produto (usado no catálogo público e no interno) ---------- */

function CatalogCard({ product, whatsapp, cartQty, onAdd, onOpenCart }: {
  product: Product;
  whatsapp: string;
  cartQty?: number;
  onAdd?: () => void;
  onOpenCart?: () => void;
}) {
  const photos = (product.photos ?? []).filter(Boolean);
  const [photoIndex, setPhotoIndex] = useState(0);
  const photo = photos[photoIndex];
  const hasMultiple = photos.length > 1;

  function orderMessage() {
    const text = `Olá! Vim pelo catálogo da Atenas Moda Fitness e tenho interesse em: ${product.name} — ${fmtMoney(Number(product.price))}`;
    return `https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}`;
  }

  return (
    <article className='cat-card'>
      <div className='cat-photo' onClick={() => hasMultiple && setPhotoIndex((i) => (i + 1) % photos.length)}>
        {photo ? (
          <img src={photo} alt={product.name} loading='lazy' />
        ) : (
          <span className='cat-photo-placeholder'>{product.name.charAt(0).toUpperCase()}</span>
        )}
        {hasMultiple && <span className='cat-photo-count'>{photoIndex + 1}/{photos.length}</span>}
        {onAdd && (
          <button
            className='cat-add'
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            title='Adicionar ao pedido'
            aria-label={`Adicionar ${product.name} ao pedido`}
          >
            + Pedir
          </button>
        )}
      </div>
      <div className='cat-info'>
        {product.category && <span className='cat-category'>{product.category}</span>}
        <h3>{product.name}</h3>
        {product.description && <p className='cat-desc'>{product.description}</p>}
        <div className='cat-foot'>
          <strong className='cat-price'>{fmtMoney(Number(product.price))}</strong>
          {whatsapp ? (
            onOpenCart ? (
              cartQty && cartQty > 0 ? (
                <button className='btn btn--primary btn--small' onClick={onOpenCart}>
                  No pedido ({cartQty})
                </button>
              ) : (
                <button className='btn btn--primary btn--small' onClick={onAdd}>
                  Pedir no WhatsApp
                </button>
              )
            ) : (
              <a className='btn btn--primary btn--small' href={orderMessage()} target='_blank' rel='noreferrer'>
                Pedir no WhatsApp
              </a>
            )
          ) : (
            <span className='cat-muted'>Consulte pelo WhatsApp</span>
          )}
        </div>
      </div>
    </article>
  );
}

/* ---------- Dados compartilhados do catálogo ---------- */

function useCatalogData() {
  return useData(async () => {
    const [products, settings] = await Promise.all([
      db.list('products', { order: 'name', asc: true }),
      db.list('settings'),
    ]);
    return {
      products: (products as Product[]).filter((p) => p.active),
      whatsapp: (settings.find((s: any) => s.key === 'whatsapp')?.value ?? '').replace(/\D/g, ''),
    };
  }, []);
}

function useCategoryFilter(products: Product[]) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))] as string[];
  const filtered = products.filter(
    (p) =>
      (!category || p.category === category) &&
      (p.name + ' ' + (p.code ?? '') + ' ' + (p.barcode ?? '')).toLowerCase().includes(search.toLowerCase()),
  );
  return { search, setSearch, category, setCategory, categories, filtered };
}

/* ---------- Catálogo público (rota #/catalogo) ---------- */

export function Catalog() {
  const { data, error } = useCatalogData();
  const products = data?.products ?? [];
  const { search, setSearch, category, setCategory, categories, filtered } = useCategoryFilter(products);
  const [lastUpdate, setLastUpdate] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    setLastUpdate(new Date().toLocaleDateString('pt-BR'));
  }, []);

  if (error) return <p className='cat-error'>Erro ao carregar o catálogo: {error}</p>;
  if (!data) return <p className='loading' style={{ padding: '40px 20px' }}>Carregando catálogo…</p>;

  const whatsapp = data.whatsapp;
  const cartItems = products.filter((p) => cart[p.id] > 0);
  const cartCount = cartItems.reduce((a, p) => a + cart[p.id], 0);
  const cartTotal = cartItems.reduce((a, p) => a + cart[p.id] * Number(p.price), 0);

  function addToCart(id: string) {
    setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  }

  function setCartQty(id: string, qty: number) {
    setCart((c) => {
      const next = { ...c };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  }

  function sendOrder() {
    const lines = cartItems.map(
      (p) => `• ${cart[p.id]}x ${p.name} — ${fmtMoney(cart[p.id] * Number(p.price))}`,
    );
    const text = [
      'Olá! Quero fazer um pedido pelo catálogo da Atenas Moda Fitness:',
      '',
      ...lines,
      '',
      `Total: ${fmtMoney(cartTotal)}`,
    ].join('\n');
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}`, '_blank');
  }

  return (
    <div className='catalog-page'>
      <header className='cat-header'>
        <div className='cat-header-inner'>
          <img src='/atenas-logo.jpg' alt='Atenas Moda Fitness' className='cat-logo' />
          <p className='cat-tagline'>Encontre a peça perfeita para valorizar o seu estilo</p>
          {whatsapp && (
            <a
              className='btn btn--gold'
              href={`https://wa.me/${whatsapp}?text=${encodeURIComponent('Olá! Vim pelo catálogo da Atenas Moda Fitness.')}`}
              target='_blank'
              rel='noreferrer'
            >
              Falar no WhatsApp
            </a>
          )}
        </div>
      </header>

      <div className='cat-toolbar'>
        <input className='input' placeholder='Buscar produto…' value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className='input' value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value=''>Todas as categorias</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className='cat-empty'>Nenhum produto disponível no momento.</p>
      ) : (
        <div className='cat-grid'>
          {filtered.map((p) => (
            <CatalogCard
              key={p.id}
              product={p}
              whatsapp={whatsapp}
              cartQty={cart[p.id] ?? 0}
              onAdd={() => addToCart(p.id)}
              onOpenCart={() => setCartOpen(true)}
            />
          ))}
        </div>
      )}

      <footer className='cat-footer'>
        <span>Atenas Moda Fitness · Catálogo atualizado em {lastUpdate}</span>
      </footer>

      {whatsapp && cartCount > 0 && (
        <button className='cat-cart-bar' onClick={() => setCartOpen(true)}>
          <span className='cat-cart-count'>{cartCount}</span>
          <span className='cat-cart-label'>Ver pedido</span>
          <span className='cat-cart-total'>{fmtMoney(cartTotal)}</span>
        </button>
      )}

      {cartOpen && cartCount > 0 && (
        <Modal title='Meu pedido' onClose={() => setCartOpen(false)}>
          <div className='cart-list'>
            {cartItems.map((p) => (
              <div key={p.id} className='cart-row'>
                <div className='cart-row-info'>
                  <strong>{p.name}</strong>
                  <span className='muted'>{fmtMoney(Number(p.price))} un.</span>
                </div>
                <div className='cart-row-qty'>
                  <button className='qty-btn' onClick={() => setCartQty(p.id, cart[p.id] - 1)} aria-label='Diminuir'>−</button>
                  <span>{cart[p.id]}</span>
                  <button className='qty-btn' onClick={() => setCartQty(p.id, cart[p.id] + 1)} aria-label='Aumentar'>+</button>
                </div>
                <strong className='cart-row-total'>{fmtMoney(cart[p.id] * Number(p.price))}</strong>
              </div>
            ))}
          </div>
          <div className='cart-total-row'>
            <span>Total do pedido</span>
            <strong>{fmtMoney(cartTotal)}</strong>
          </div>
          <p className='muted'>
            Ao enviar, o WhatsApp abre com o pedido pronto — basta apertar enviar para a loja.
          </p>
          <div className='modal-foot'>
            <button className='btn' onClick={() => setCartOpen(false)}>Continuar comprando</button>
            <button className='btn btn--primary' onClick={sendOrder}>
              Enviar pedido no WhatsApp
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------- Catálogo dentro do sistema (grade de produtos) ---------- */

export function CatalogoInterno() {
  const { data, error } = useCatalogData();
  const products = data?.products ?? [];
  const { search, setSearch, category, setCategory, categories, filtered } = useCategoryFilter(products);
  const [copied, setCopied] = useState('');

  if (error) return <ErrorNote message={error} />;
  if (!data) return <p className='loading'>Carregando catálogo…</p>;

  const catalogUrl = `${window.location.origin}${window.location.pathname}#/catalogo`;

  return (
    <>
      <PageHead
        title='Catálogo digital'
        sub='Grade de produtos que seus clientes veem no catálogo público — com pedido direto no WhatsApp'
        actions={
          <>
            <a className='btn' href={catalogUrl} target='_blank' rel='noreferrer'>
              Abrir catálogo público
            </a>
            <button
              className='btn btn--primary'
              onClick={() => {
                void navigator.clipboard?.writeText(catalogUrl);
                setCopied('Link copiado! Cole na bio do WhatsApp ou envie para seus clientes.');
                window.setTimeout(() => setCopied(''), 4000);
              }}
            >
              Copiar link
            </button>
          </>
        }
      />
      {!data?.whatsapp && (
        <p className='muted' style={{ marginTop: 0 }}>
          Configure o WhatsApp da loja em <strong>Configurações</strong> para receber os pedidos do catálogo.
        </p>
      )}
      {copied && <p className='ok-note'>{copied}</p>}
      <div className='filter-row' style={{ marginTop: 8 }}>
        <input
          className='input'
          style={{ maxWidth: 260 }}
          placeholder='Buscar produto…'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className='input' style={{ maxWidth: 200 }} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value=''>Todas as categorias</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      {filtered.length === 0 ? (
        <Card>
          <p className='muted'>
            Nenhum produto ativo no catálogo. Cadastre produtos em <strong>Produtos</strong> — eles
            aparecem aqui automaticamente.
          </p>
        </Card>
      ) : (
        <div className='cat-grid cat-grid--system'>
          {filtered.map((p) => (
            <CatalogCard key={p.id} product={p} whatsapp={data?.whatsapp ?? ''} />
          ))}
        </div>
      )}
    </>
  );
}
