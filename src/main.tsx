import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { canAccess, getSession, logout, SessionUser } from './auth';
import { PartyKind } from './db';
import { Depositos, PartyPage } from './pages/Cadastros';
import { Dashboard } from './pages/Dashboard';
import { Estoque } from './pages/Estoque';
import { Etiquetas } from './pages/Etiquetas';
import { Financeiro } from './pages/Financeiro';
import { Produtos } from './pages/Produtos';
import { Relatorios } from './pages/Relatorios';
import { Usuarios } from './pages/Usuarios';
import { NovaVendaPage, VendasPage } from './pages/Vendas';
import { Catalog, CatalogoInterno } from './pages/Catalog';
import { Configuracoes } from './pages/Configuracoes';
import { Login } from './pages/Login';

const NAV: { group: string; items: { id: string; label: string }[] }[] = [
  { group: '', items: [{ id: 'dashboard', label: 'Dashboard' }] },
  {
    group: 'Movimento',
    items: [
      { id: 'nova-venda', label: 'Nova venda' },
      { id: 'vendas', label: 'Vendas' },
      { id: 'receber', label: 'Contas a receber' },
      { id: 'pagar', label: 'Contas a pagar' },
    ],
  },
  {
    group: 'Estoque',
    items: [
      { id: 'produtos', label: 'Produtos' },
      { id: 'estoque', label: 'Controle de estoque' },
      { id: 'compras', label: 'Planejamento de compras' },
    ],
  },
  {
    group: 'Cadastros',
    items: [
      { id: 'clientes', label: 'Clientes' },
      { id: 'fornecedores', label: 'Fornecedores' },
      { id: 'vendedores', label: 'Vendedores' },
      { id: 'revendedores', label: 'Revendedores' },
      { id: 'transportadoras', label: 'Transportadoras' },
      { id: 'depositos', label: 'Depósitos' },
    ],
  },
  {
    group: 'Sistema',
    items: [
      { id: 'catalogo', label: 'Catálogo digital' },
      { id: 'lucro', label: 'Lucro e venda' },
      { id: 'comissoes', label: 'Comissões' },
      { id: 'etiquetas', label: 'Etiquetas e códigos' },
      { id: 'usuarios', label: 'Usuários e permissões' },
      { id: 'configuracoes', label: 'Configurações' },
    ],
  },
];

const PARTY_IDS: PartyKind[] = ['cliente', 'fornecedor', 'vendedor', 'revendedor', 'transportadora'];

function renderPage(
  page: string,
  go: (p: string) => void,
  etiquetaProduct: string,
  goEtiquetas: (id: string) => void,
  session: SessionUser,
) {
  if (page === 'dashboard') return <Dashboard go={go} />;
  if (page === 'catalogo') return <CatalogoInterno />;
  if (page === 'nova-venda') return <NovaVendaPage go={go} />;
  if (page === 'vendas') return <VendasPage go={go} />;
  if (page === 'produtos') return <Produtos onEtiquetas={canAccess('etiquetas', session) ? goEtiquetas : undefined} />;
  if (page === 'estoque') return <Estoque />;
  if (page === 'receber') return <Financeiro kind='receber' />;
  if (page === 'pagar') return <Financeiro kind='pagar' />;
  if (page === 'comissoes' || page === 'compras' || page === 'lucro') return <Relatorios view={page} />;
  if (page === 'etiquetas') return <Etiquetas key={etiquetaProduct} initialProductId={etiquetaProduct} />;
  if (page === 'usuarios') return <Usuarios />;
  if (page === 'configuracoes') return <Configuracoes />;
  if (page === 'depositos') return <Depositos />;
  if ((PARTY_IDS as string[]).includes(page)) return <PartyPage kind={page as PartyKind} />;
  return <Dashboard go={go} />;
}

function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

function App() {
  const hash = useHashRoute();
  const [session, setSession] = useState<SessionUser | null>(() => getSession());
  const [page, setPage] = useState('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [etiquetaProduct, setEtiquetaProduct] = useState('');

  const go = (p: string) => {
    setPage(p);
    setMenuOpen(false);
    if (p !== 'etiquetas') setEtiquetaProduct('');
    window.scrollTo({ top: 0 });
  };

  const goEtiquetas = (productId: string) => {
    setEtiquetaProduct(productId);
    go('etiquetas');
  };

  // Catálogo digital público — rota #/catalogo, sem o menu do sistema
  if (hash.startsWith('#/catalogo')) {
    return <Catalog />;
  }

  if (!session) {
    return <Login onLogin={setSession} />;
  }

  const nav = NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => canAccess(item.id, session)),
  })).filter((group) => group.items.length > 0);

  const doLogout = () => {
    logout();
    setSession(null);
    setPage('dashboard');
  };

  // Sem permissão para nenhum módulo — bloqueia em vez de cair no dashboard
  if (nav.length === 0) {
    return (
      <div className='login-wrap'>
        <div className='login-card'>
          <img src='/atenas-logo.jpg' alt='Atenas Moda Fitness' className='login-logo' />
          <span className='login-sub'>Sistema de Gestão</span>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: '0 0 16px' }}>
            {session.name}, seu usuário não tem permissão para acessar nenhum módulo do sistema. Procure o
            administrador.
          </p>
          <button className='btn btn--primary login-btn' onClick={doLogout}>
            Sair
          </button>
        </div>
      </div>
    );
  }

  const firstAllowed = nav[0].items[0].id;
  const current = canAccess(page, session) ? page : firstAllowed;

  return (
    <div className='app'>
      <button className='menu-toggle' onClick={() => setMenuOpen((v) => !v)} aria-label='Abrir menu'>
        ☰
      </button>
      <aside className={`sidebar${menuOpen ? ' sidebar--open' : ''}`}>
        <div className='sidebar-brand'>
          <img src='/atenas-logo.jpg' alt='Atenas Moda Fitness' />
          <span className='sidebar-brand-sub'>Sistema de Gestão</span>
        </div>
        <nav className='sidebar-nav'>
          {nav.map((group) => (
            <div key={group.group || 'main'} className='nav-group'>
              {group.group && <span className='nav-group-label'>{group.group}</span>}
              {group.items.map((item) => (
                <button
                  key={item.id}
                  className={`nav-item${current === item.id ? ' nav-item--active' : ''}`}
                  onClick={() => go(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className='sidebar-user'>
          <span className='sidebar-user-name'>{session.name}</span>
          <button className='sidebar-user-logout' onClick={doLogout}>
            Sair
          </button>
        </div>
      </aside>
      {menuOpen && <div className='sidebar-backdrop' onClick={() => setMenuOpen(false)} />}
      <main className='content'>{renderPage(current, go, etiquetaProduct, goEtiquetas, session)}</main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
