import React, { useEffect, useState } from 'react';
import { db, Product } from '../db';
import { fmtMoney, useData } from '../ui';

function CatalogCard({ product, whatsapp }: { product: Product; whatsapp: string }) {
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
      </div>
      <div className='cat-info'>
        {product.category && <span className='cat-category'>{product.category}</span>}
        <h3>{product.name}</h3>
        {product.description && <p className='cat-desc'>{product.description}</p>}
        <div className='cat-foot'>
          <strong className='cat-price'>{fmtMoney(Number(product.price))}</strong>
          {whatsapp ? (
            <a className='btn btn--primary btn--small' href={orderMessage()} target='_blank' rel='noreferrer'>
              Pedir no WhatsApp
            </a>
          ) : (
            <span className='cat-muted'>Consulte pelo WhatsApp</span>
          )}
        </div>
      </div>
    </article>
  );
}

export function Catalog() {
  const { data, error } = useData(async () => {
    const [products, settings] = await Promise.all([
      db.list('products', { order: 'name', asc: true }),
      db.list('settings'),
    ]);
    return {
      products: (products as Product[]).filter((p) => p.active),
      whatsapp: (settings.find((s: any) => s.key === 'whatsapp')?.value ?? '').replace(/\D/g, ''),
    };
  }, []);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [lastUpdate, setLastUpdate] = useState('');

  useEffect(() => {
    setLastUpdate(new Date().toLocaleDateString('pt-BR'));
  }, []);

  if (error) return <p className='cat-error'>Erro ao carregar o catálogo: {error}</p>;

  const products = data?.products ?? [];
  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))] as string[];
  const filtered = products.filter(
    (p) => (!category || p.category === category) && p.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className='catalog-page'>
      <header className='cat-header'>
        <div className='cat-header-inner'>
          <img src='/atenas-logo.jpg' alt='Atenas Moda Fitness' className='cat-logo' />
          <p className='cat-tagline'>Encontre a peça perfeita para valorizar o seu estilo</p>
          {data?.whatsapp && (
            <a
              className='btn btn--gold'
              href={`https://wa.me/${data.whatsapp}?text=${encodeURIComponent('Olá! Vim pelo catálogo da Atenas Moda Fitness.')}`}
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
            <CatalogCard key={p.id} product={p} whatsapp={data?.whatsapp ?? ''} />
          ))}
        </div>
      )}

      <footer className='cat-footer'>
        <span>Atenas Moda Fitness · Catálogo atualizado em {lastUpdate}</span>
      </footer>
    </div>
  );
}
