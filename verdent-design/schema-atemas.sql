create extension if not exists pgcrypto;

create table if not exists warehouses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  created_at timestamptz not null default now()
);

create table if not exists parties (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('cliente','fornecedor','vendedor','revendedor','transportadora')),
  name text not null,
  phone text,
  email text,
  doc text,
  birth_date date,
  address text,
  city text,
  commission_pct numeric(5,2) not null default 0,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text,
  barcode text,
  category text,
  description text,
  price numeric(12,2) not null default 0,
  cost numeric(12,2) not null default 0,
  stock numeric(12,3) not null default 0,
  min_stock numeric(12,3) not null default 0,
  warehouse_id uuid references warehouses(id) on delete set null,
  photos jsonb not null default '[]',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  seq bigserial unique,
  sale_date date not null default current_date,
  customer_id uuid references parties(id) on delete set null,
  seller_id uuid references parties(id) on delete set null,
  kind text not null default 'normal' check (kind in ('normal','consignada','condicional')),
  status text not null default 'aberta' check (status in ('aberta','faturada','devolvida','cancelada')),
  payment text not null default 'avista' check (payment in ('avista','crediario')),
  installments int not null default 1,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null default '',
  qty numeric(12,3) not null default 1,
  price numeric(12,2) not null default 0,
  returned_qty numeric(12,3) not null default 0
);

create table if not exists stock_moves (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  warehouse_id uuid references warehouses(id) on delete set null,
  qty numeric(12,3) not null,
  kind text not null check (kind in ('entrada','saida','ajuste','venda','devolucao')),
  note text,
  moved_at timestamptz not null default now()
);

create table if not exists receivables (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid references sales(id) on delete set null,
  description text not null,
  amount numeric(12,2) not null default 0,
  due_date date,
  paid_at date,
  status text not null default 'aberto' check (status in ('aberto','pago')),
  created_at timestamptz not null default now()
);

create table if not exists payables (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  supplier_id uuid references parties(id) on delete set null,
  amount numeric(12,2) not null default 0,
  due_date date,
  paid_at date,
  status text not null default 'aberto' check (status in ('aberto','pago')),
  created_at timestamptz not null default now()
);

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  login text not null unique,
  role text not null default 'vendedor' check (role in ('admin','gerente','vendedor')),
  permissions jsonb not null default '[]',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_parties_kind on parties(kind);
create index if not exists idx_products_name on products(name);
create index if not exists idx_sale_items_sale on sale_items(sale_id);
create index if not exists idx_stock_moves_product on stock_moves(product_id);
create index if not exists idx_receivables_status on receivables(status);
create index if not exists idx_payables_status on payables(status);

alter table warehouses enable row level security;
alter table parties enable row level security;
alter table products enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table stock_moves enable row level security;
alter table receivables enable row level security;
alter table payables enable row level security;
alter table app_users enable row level security;

create policy "app_all_warehouses" on warehouses for all using (true) with check (true);
create policy "app_all_parties" on parties for all using (true) with check (true);
create policy "app_all_products" on products for all using (true) with check (true);
create policy "app_all_sales" on sales for all using (true) with check (true);
create policy "app_all_sale_items" on sale_items for all using (true) with check (true);
create policy "app_all_stock_moves" on stock_moves for all using (true) with check (true);
create policy "app_all_receivables" on receivables for all using (true) with check (true);
create policy "app_all_payables" on payables for all using (true) with check (true);
create policy "app_all_app_users" on app_users for all using (true) with check (true);

grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;

insert into warehouses (name, location)
select 'Depósito Central', 'Matriz'
where not exists (select 1 from warehouses where name = 'Depósito Central');

insert into app_users (name, login, role, permissions)
values ('Administrador', 'admin', 'admin', '["*"]'::jsonb)
on conflict (login) do nothing;
