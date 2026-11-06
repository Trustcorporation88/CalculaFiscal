-- Isolamento entre organizações e restrição por papel, testado como o PostgREST executa:
-- papel authenticated e auth.uid() vindo de request.jwt.claims.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- Dados de teste (como superusuário, sem RLS).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'dono-a@teste.local'),
  ('00000000-0000-0000-0000-00000000000b', 'dono-b@teste.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'leitor-a@teste.local');

insert into public.organizations (id, nome) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Escritório A'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Escritório B');

insert into public.memberships (organization_id, user_id, papel) values
  ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000a', 'dono'),
  ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a2', 'leitor'),
  ('bbbbbbbb-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000b', 'dono');

insert into public.companies (id, organization_id, cnpj, razao_social, regime, uf) values
  ('cccccccc-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', '11222333000181', 'Cliente de A', 'SIMPLES', 'SP'),
  ('cccccccc-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000000', '44555666000181', 'Cliente de B', 'REAL', 'SP');

-- Usuário anônimo não vê nada.
set local role anon;
select is((select count(*) from public.companies), 0::bigint, 'anon não lê empresas');
select is((select count(*) from public.organizations), 0::bigint, 'anon não lê organizações');
reset role;

-- Dono de A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select is((select count(*) from public.organizations), 1::bigint, 'dono de A vê só a própria organização');
select is((select count(*) from public.companies), 1::bigint, 'dono de A vê só empresas de A');
select is(
  (select count(*) from public.companies where organization_id = 'bbbbbbbb-0000-0000-0000-000000000000'),
  0::bigint, 'dono de A não vê empresas de B mesmo filtrando pelo id (IDOR)');

select throws_ok(
  $$insert into public.companies (organization_id, cnpj, razao_social, regime, uf)
    values ('bbbbbbbb-0000-0000-0000-000000000000', '77888999000181', 'Invasor', 'REAL', 'SP')$$,
  '42501', null, 'dono de A não cria empresa em B');

update public.companies set razao_social = 'alterado' where id = 'cccccccc-0000-0000-0000-00000000000b';
delete from public.companies where id = 'cccccccc-0000-0000-0000-00000000000b';

select lives_ok(
  $$insert into public.companies (organization_id, cnpj, razao_social, regime, uf)
    values ('aaaaaaaa-0000-0000-0000-000000000000', '12345678000195', 'Nova de A', 'PRESUMIDO', 'SP')$$,
  'dono de A cria empresa em A');

select throws_ok(
  $$insert into public.memberships (organization_id, user_id, papel)
    values ('bbbbbbbb-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000a', 'dono')$$,
  '42501', null, 'dono de A não se inclui em B');

select is((select count(*) from public.audit_log), 0::bigint, 'auditoria de outras organizações não aparece');
reset role;

-- Conferência como superusuário: empresa de B intacta.
select is(
  (select razao_social from public.companies where id = 'cccccccc-0000-0000-0000-00000000000b'),
  'Cliente de B', 'update e delete de A não afetaram a empresa de B');

-- Leitor de A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);

select is((select count(*) from public.companies), 2::bigint, 'leitor de A lê as empresas de A');
select throws_ok(
  $$insert into public.companies (organization_id, cnpj, razao_social, regime, uf)
    values ('aaaaaaaa-0000-0000-0000-000000000000', '98765432000198', 'Leitor tentou', 'REAL', 'SP')$$,
  '42501', null, 'leitor não cria empresa');

update public.companies set razao_social = 'leitor alterou' where id = 'cccccccc-0000-0000-0000-00000000000a';
reset role;
select is(
  (select razao_social from public.companies where id = 'cccccccc-0000-0000-0000-00000000000a'),
  'Cliente de A', 'leitor não altera empresa');

-- Funções auxiliares não ficam expostas no schema public (API).
select is(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('org_ids_do_usuario', 'tem_papel')),
  0::bigint, 'funções do RLS fora do schema public');

select * from finish();
rollback;
