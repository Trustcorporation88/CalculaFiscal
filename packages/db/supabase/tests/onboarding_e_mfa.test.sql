-- Onboarding (criar_organizacao) e exigência de AAL2 para ações administrativas.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'novo@teste.local'),
  ('00000000-0000-0000-0000-0000000000c2', 'colega@teste.local');

-- Anônimo não cria organização.
set local role anon;
select throws_ok($$select public.criar_organizacao('Anônimo')$$, '42501', null, 'anon não executa criar_organizacao');
reset role;

-- Usuário logado (AAL1) cria a própria organização e vira dono.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated","aal":"aal1"}', true);

select throws_ok($$select public.criar_organizacao(' x ')$$, '22023', null, 'nome curto demais é rejeitado');
select lives_ok($$select public.criar_organizacao('Escritório Novo')$$, 'usuário cria a primeira organização');
select is((select papel::text from public.memberships), 'dono', 'criador vira dono');
select is((select count(*) from public.organizations), 1::bigint, 'dono enxerga a organização criada');

-- Em AAL1, o dono não executa ações administrativas.
select throws_ok(
  $$insert into public.memberships (organization_id, user_id, papel)
    select id, '00000000-0000-0000-0000-0000000000c2', 'analista' from public.organizations$$,
  '42501', null, 'sem MFA (AAL1) o dono não adiciona membros');
select is((select count(*) from public.audit_log), 0::bigint, 'sem MFA (AAL1) a auditoria não aparece');

-- Em AAL2 (TOTP verificado), pode.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated","aal":"aal2"}', true);
select lives_ok(
  $$insert into public.memberships (organization_id, user_id, papel)
    select id, '00000000-0000-0000-0000-0000000000c2', 'analista' from public.organizations$$,
  'com MFA (AAL2) o dono adiciona membros');
select is((select count(*) from public.audit_log), 1::bigint, 'com MFA (AAL2) a auditoria aparece');
reset role;

-- Limite de 5 organizações por dono (a trava contra corrida está na função).
set local role authenticated;
select public.criar_organizacao('Org ' || n) from generate_series(2, 5) as n;
select throws_ok($$select public.criar_organizacao('Sexta')$$, '54000', null, 'sexta organização é recusada');
select ok(
  (select prosrc like '%pg_advisory_xact_lock%' from pg_proc where proname = 'criar_organizacao'),
  'criar_organizacao serializa por usuário com trava transacional');
reset role;

-- O usuário não consegue se passar por outro: a função usa auth.uid().
select ok(
  (select bool_and(user_id = '00000000-0000-0000-0000-0000000000c1'::uuid)
   from public.memberships where papel = 'dono'),
  'dono gravado é sempre o usuário da sessão');

select * from finish();
rollback;
