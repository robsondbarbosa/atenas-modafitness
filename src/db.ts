import { createClient } from '@supabase/supabase-js';

const DIRECT_URL = 'https://supabase-api-prod.verdent.ai/p/p79ea6afab1d725efbe34';
// Chave publishable (pública) — configuração pública do projeto, sem segredos de servidor.
const DIRECT_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoyMTA4ODE2MTAyLCJpYXQiOjE3OTMxOTY5MDIsImlzcyI6InN1cGFiYXNlIiwicHJvamVjdF9yZWYiOiJwNzllYTZhZmFiMWQ3MjVlZmJlMzQiLCJyb2xlIjoiYW5vbiJ9._SWDOsgT0HShfwk7a7PKGSGdyYs0aehbKDGgaqeDrpE';

function resolveClient() {
  const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const envKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (envUrl && envKey) return { url: envUrl, key: envKey };
  // Chave publishable é config pública — funciona em qualquer hospedagem (Vercel, Verdent, etc.).
  return { url: DIRECT_URL, key: DIRECT_KEY };
}

const resolved = resolveClient();
export const supabase = createClient(resolved.url, resolved.key, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export const db = {
  async list(
    table: string,
    opts: { eq?: [string, any]; order?: string; asc?: boolean; select?: string } = {},
  ): Promise<any[]> {
    let q = supabase.from(table).select(opts.select ?? '*');
    if (opts.eq) q = q.eq(opts.eq[0], opts.eq[1]);
    if (opts.order) q = q.order(opts.order, { ascending: opts.asc ?? false });
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async insert(table: string, row: any): Promise<any> {
    const { data, error } = await supabase.from(table).insert(row).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async insertMany(table: string, rows: any[]): Promise<void> {
    if (!rows.length) return;
    const { error } = await supabase.from(table).insert(rows);
    if (error) throw new Error(error.message);
  },

  async update(table: string, id: string, patch: any): Promise<any> {
    const { data, error } = await supabase.from(table).update(patch).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async remove(table: string, id: string): Promise<void> {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};

/* ---------- Tipos ---------- */

export type PartyKind = 'cliente' | 'fornecedor' | 'vendedor' | 'revendedor' | 'transportadora';

export interface Party {
  id: string;
  kind: PartyKind;
  name: string;
  phone?: string;
  email?: string;
  doc?: string;
  birth_date?: string;
  address?: string;
  city?: string;
  commission_pct?: number;
  notes?: string;
  active: boolean;
}

export interface Warehouse {
  id: string;
  name: string;
  location?: string;
}

export interface Product {
  id: string;
  name: string;
  code?: string;
  barcode?: string;
  category?: string;
  description?: string;
  price: number;
  cost: number;
  stock: number;
  min_stock: number;
  warehouse_id?: string | null;
  photos: string[];
  active: boolean;
}

export type SaleKind = 'normal' | 'consignada' | 'condicional';
export type SaleStatus = 'aberta' | 'faturada' | 'devolvida' | 'cancelada';

export interface Sale {
  id: string;
  seq: number;
  sale_date: string;
  customer_id?: string | null;
  seller_id?: string | null;
  kind: SaleKind;
  status: SaleStatus;
  payment: 'avista' | 'crediario';
  installments: number;
  discount: number;
  total: number;
  notes?: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id?: string | null;
  product_name: string;
  qty: number;
  price: number;
  returned_qty: number;
}

export interface StockMove {
  id: string;
  product_id: string;
  warehouse_id?: string | null;
  qty: number;
  kind: 'entrada' | 'saida' | 'ajuste' | 'venda' | 'devolucao';
  note?: string;
  moved_at: string;
}

export interface Receivable {
  id: string;
  sale_id?: string | null;
  description: string;
  amount: number;
  due_date?: string;
  paid_at?: string | null;
  status: 'aberto' | 'pago';
}

export interface Payable {
  id: string;
  description: string;
  supplier_id?: string | null;
  amount: number;
  due_date?: string;
  paid_at?: string | null;
  status: 'aberto' | 'pago';
}

export interface AppUser {
  id: string;
  name: string;
  login: string;
  role: 'admin' | 'gerente' | 'vendedor';
  permissions: string[];
  active: boolean;
}

/* ---------- Auxiliares ---------- */

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function newBarcode(): string {
  return Date.now().toString().slice(-12) + Math.floor(Math.random() * 10).toString();
}
