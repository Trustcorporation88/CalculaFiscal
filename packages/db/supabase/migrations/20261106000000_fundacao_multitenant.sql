-- Fundação multi-tenant do CalculaFiscal.
-- Toda tabela com dado de cliente tem organization_id e RLS. O papel é checado no banco, não só na tela.

create extension if not exists pgcrypto;

create type public.papel_membro as enum ('dono', 'administrador', 'analista', 'leitor');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 2 and 200),
  created_at timestamptz not null default now()
);

create table public.memberships (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  papel public.papel_membro not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  external_id text,
  cnpj char(14) not null check (cnpj ~ '^\d{14}$'),
  razao_social text not null,
  regime text not null check (regime in ('SIMPLES', 'PRESUMIDO', 'REAL')),
  uf char(2) not null,
  municipio_ibge char(7),
  created_at timestamptz not null default now(),
  unique (organization_id, cnpj),
  unique (organization_id, external_id)
);

-- Opção do Simples por semestre (IBS/CBS no DAS ou no regime regular).
create table public.company_simples_options (
  company_id uuid not null references public.companies (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  semestre text not null check (semestre ~ '^\d{4}-S[12]$'),
  forma text not null check (forma in ('DAS', 'REGULAR')),
  primary key (company_id, semestre)
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations (id) on delete cascade,
  user_id uuid,
  acao text not null,
  alvo text,
  detalhes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_org_idx on public.audit_log (organization_id, created_at desc);

-- Funções auxiliares (security definer, search_path fixo para evitar sequestro).
create or replace function public.org_ids_do_usuario()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select organization_id from public.memberships where user_id = (select auth.uid());
$$;

create or replace function public.tem_papel(org uuid, papeis public.papel_membro[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships
    where organization_id = org and user_id = (select auth.uid()) and papel = any (papeis)
  );
$$;

revoke all on function public.org_ids_do_usuario() from public;
revoke all on function public.tem_papel(uuid, public.papel_membro[]) from public;
grant execute on function public.org_ids_do_usuario() to authenticated;
grant execute on function public.tem_papel(uuid, public.papel_membro[]) to authenticated;

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.companies enable row level security;
alter table public.company_simples_options enable row level security;
alter table public.audit_log enable row level security;

-- Organizações: membro lê; só dono/administrador altera.
create policy org_select on public.organizations for select to authenticated
  using (id in (select public.org_ids_do_usuario()));
create policy org_update on public.organizations for update to authenticated
  using (public.tem_papel(id, array['dono', 'administrador']::public.papel_membro[]));

-- Membros: membro vê a lista; só dono/administrador gerencia.
create policy mem_select on public.memberships for select to authenticated
  using (organization_id in (select public.org_ids_do_usuario()));
create policy mem_write on public.memberships for all to authenticated
  using (public.tem_papel(organization_id, array['dono', 'administrador']::public.papel_membro[]))
  with check (public.tem_papel(organization_id, array['dono', 'administrador']::public.papel_membro[]));

-- Empresas e opções do Simples: membro lê; leitor não escreve.
create policy comp_select on public.companies for select to authenticated
  using (organization_id in (select public.org_ids_do_usuario()));
create policy comp_write on public.companies for all to authenticated
  using (public.tem_papel(organization_id, array['dono', 'administrador', 'analista']::public.papel_membro[]))
  with check (public.tem_papel(organization_id, array['dono', 'administrador', 'analista']::public.papel_membro[]));

create policy opt_select on public.company_simples_options for select to authenticated
  using (organization_id in (select public.org_ids_do_usuario()));
create policy opt_write on public.company_simples_options for all to authenticated
  using (public.tem_papel(organization_id, array['dono', 'administrador', 'analista']::public.papel_membro[]))
  with check (public.tem_papel(organization_id, array['dono', 'administrador', 'analista']::public.papel_membro[]));

-- Auditoria: só leitura para dono/administrador; escrita apenas pelo servidor (service role).
create policy audit_select on public.audit_log for select to authenticated
  using (public.tem_papel(organization_id, array['dono', 'administrador']::public.papel_membro[]));
