-- ============================================================
--  CONFIGURAÇÃO DO BANCO NO SUPABASE
--  Cole TUDO isto no "SQL Editor" do Supabase e clique em RUN.
--  Pode ser rodado mais de uma vez sem problema.
--
--  OBS: se aparecer "Backend error! Retry your query", é uma
--  instabilidade temporária do Supabase - basta clicar em RUN
--  de novo.
-- ============================================================

-- Tabela de sabores
create table if not exists public.sabores (
  id bigint generated always as identity primary key,
  nome text not null,
  created_at timestamptz not null default now()
);

-- Tabela de pedidos (os itens ficam em um campo JSON)
create table if not exists public.pedidos (
  id bigint generated always as identity primary key,
  cliente text not null,
  itens jsonb not null default '[]'::jsonb,
  status text not null default 'pendente',   -- pendente | concluido
  created_at timestamptz not null default now()
);

-- Garante a coluna de status em bancos já existentes
alter table public.pedidos
  add column if not exists status text not null default 'pendente';

-- Segurança em nível de linha (RLS) ligada,
-- com acesso liberado pela chave pública (anon) para o evento.
alter table public.sabores enable row level security;
alter table public.pedidos enable row level security;

drop policy if exists "acesso_publico_sabores" on public.sabores;
create policy "acesso_publico_sabores" on public.sabores
  for all to anon using (true) with check (true);

drop policy if exists "acesso_publico_pedidos" on public.pedidos;
create policy "acesso_publico_pedidos" on public.pedidos
  for all to anon using (true) with check (true);

-- Ativar sincronização em TEMPO REAL nas duas tabelas
-- (ignora se a tabela já estiver ativada)
do $$ begin
  alter publication supabase_realtime add table public.sabores;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.pedidos;
exception when duplicate_object then null; end $$;
