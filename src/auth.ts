import { db, setSessionToken } from './db';

export interface SessionUser {
  id: string;
  name: string;
  login: string;
  role: 'admin' | 'gerente' | 'vendedor';
  permissions: string[];
}

const SESSION_KEY = 'atenas_session';

/** Página do sistema -> módulo de permissão correspondente. */
export const PAGE_PERMS: Record<string, string> = {
  dashboard: 'dashboard',
  'nova-venda': 'vendas',
  vendas: 'vendas',
  receber: 'financeiro',
  pagar: 'financeiro',
  produtos: 'estoque',
  estoque: 'estoque',
  compras: 'relatorios',
  clientes: 'cadastros',
  fornecedores: 'cadastros',
  vendedores: 'cadastros',
  revendedores: 'cadastros',
  transportadoras: 'cadastros',
  depositos: 'cadastros',
  catalogo: 'catalogo',
  lucro: 'relatorios',
  comissoes: 'relatorios',
  etiquetas: 'etiquetas',
  usuarios: 'usuarios',
  configuracoes: 'configuracoes',
};

export function canAccess(page: string, user: SessionUser | null): boolean {
  if (!user) return false;
  if (user.role === 'admin' || (user.permissions ?? []).includes('*')) return true;
  const mod = PAGE_PERMS[page];
  return !!mod && user.permissions.includes(mod);
}

export function getSession(): SessionUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s && s.id && s.login) return s as SessionUser;
  } catch {
    /* sessão inválida */
  }
  return null;
}

export async function login(loginValue: string, password: string): Promise<SessionUser> {
  // Validação no servidor via RPC — a senha nunca sai do banco em texto puro
  // e o acesso às tabelas exige o token de sessão assinado no servidor.
  const res = await db.rpc('login_usuario', { p_login: loginValue.trim(), p_senha: password });
  const payload = typeof res === 'string' ? JSON.parse(res) : res;
  if (payload?.erro) throw new Error(payload.erro);
  if (!payload?.token || !payload?.usuario) throw new Error('Resposta inválida do servidor.');
  const u = payload.usuario;
  let permissions: string[] = [];
  if (Array.isArray(u.permissions)) permissions = u.permissions;
  else if (typeof u.permissions === 'string') {
    try {
      permissions = JSON.parse(u.permissions);
    } catch {
      permissions = [];
    }
  }
  const session: SessionUser = {
    id: u.id,
    name: u.name,
    login: u.login,
    role: u.role,
    permissions,
  };
  setSessionToken(payload.token);
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function logout(): void {
  localStorage.removeItem(SESSION_KEY);
  setSessionToken(null);
}
