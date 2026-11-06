-- Tokens da API /v1: criação só por dono/administrador com MFA, hash nunca legível,
-- autenticação pelo hash, contagem para o limite e revogação imediata.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'dono@api.local'),
  ('00000000-0000-0000-0000-0000000000d2', 'analista@api.local'),
  ('00000000-0000-0000-0000-0000000000d3', 'outro@api.local');
insert into public.organizations (id, nome) values
  ('00000000-0000-0000-0000-00000000aa01', 'Escritório A'),
  ('00000000-0000-0000-0000-00000000aa02', 'Escritório B');
insert into public.memberships (organization_id, user_id, papel) values
  ('00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-0000000000d1', 'dono'),
  ('00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-0000000000d2', 'analista'),
  ('00000000-0000-0000-0000-00000000aa02', '00000000-0000-0000-0000-0000000000d3', 'dono');

create temporary table criado (id uuid, token text, prefixo text) on commit drop;
grant all on criado to authenticated, anon;

set local role authenticated;

-- Analista não cria token, nem com MFA.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated","aal":"aal2"}', true);
select throws_ok(
  $$select public.criar_token_api('00000000-0000-0000-0000-00000000aa01', 'ProContador', array['simular'])$$,
  '42501', null, 'analista não cria token');

-- Dono sem MFA (AAL1) não cria.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","aal":"aal1"}', true);
select throws_ok(
  $$select public.criar_token_api('00000000-0000-0000-0000-00000000aa01', 'ProContador', array['simular'])$$,
  '42501', null, 'dono sem MFA não cria token');

-- Dono com MFA cria; o token completo só aparece aqui.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","aal":"aal2"}', true);
select throws_ok(
  $$select public.criar_token_api('00000000-0000-0000-0000-00000000aa01', 'Escopo ruim', array['administrar'])$$,
  '23514', null, 'escopo desconhecido é recusado');
insert into criado
  select * from public.criar_token_api('00000000-0000-0000-0000-00000000aa01', 'ProContador', array['simular', 'regras:ler']);
select matches((select token from criado), '^cf_test_[0-9a-f]{64}$', 'token no formato cf_test_ + 64 hex');
select is((select prefixo from criado), (select left(token, 14) from criado), 'prefixo é o começo do token');
select is((select count(*) from public.api_tokens), 1::bigint, 'dono com MFA vê o token na lista');
select throws_ok($$select hash_segredo from public.api_tokens$$, '42501', null, 'hash não é legível');
select is(
  (select acao from public.audit_log where alvo = (select id::text from criado)),
  'api.token.criado', 'criação vai para a auditoria');

-- Dono de outra organização não vê o token.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated","aal":"aal2"}', true);
select is((select count(*) from public.api_tokens), 0::bigint, 'outra organização não vê o token');
select throws_ok(
  format('select public.revogar_token_api(%L)', (select id from criado)),
  '42501', null, 'outra organização não revoga o token');

-- Anônimo autentica com o hash e cada chamada conta para o limite.
reset role;
create temporary table hash_token on commit drop as
  select encode(extensions.digest(token, 'sha256'), 'hex') as h from criado;
grant all on hash_token to anon;
set local role anon;
select is(
  (select organization_id from public.api_autenticar((select h from hash_token))),
  '00000000-0000-0000-0000-00000000aa01'::uuid, 'hash certo autentica na organização do token');
select is(
  (select usados from public.api_autenticar((select h from hash_token))), 2,
  'segunda chamada no mesmo minuto conta 2');
select is(
  (select count(*) from public.api_autenticar(repeat('0', 64))), 0::bigint,
  'hash desconhecido não autentica');
select throws_ok($$select * from public.api_autenticar('nao-e-hash')$$, '22023', null,
  'entrada fora do formato é recusada');

-- Revogação imediata.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","aal":"aal2"}', true);
select lives_ok(format('select public.revogar_token_api(%L)', (select id from criado)),
  'dono com MFA revoga');
set local role anon;
select is(
  (select count(*) from public.api_autenticar((select h from hash_token))), 0::bigint,
  'token revogado não autentica mais');

select * from finish();
rollback;
