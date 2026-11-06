-- API pública /v1: tokens de serviço por organização, com escopos e limite de requisições.
--
-- O token é gerado no banco (256 bits aleatórios) e devolvido uma única vez. Fica guardado só o
-- SHA-256: com segredo de alta entropia, o hash rápido é seguro e permite achar o token pelo hash
-- (argon2 serve para senhas fracas; ver ADR-007). A coluna do hash não é legível pelos usuários.
-- Criação e revogação só por funções, para registrar auditoria e exigir MFA (AAL2).

create table public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  nome text not null check (char_length(nome) between 3 and 80),
  -- Início visível do token (ex.: cf_test_1a2b3c), para reconhecer na lista.
  prefixo text not null,
  hash_segredo text not null unique check (hash_segredo ~ '^[0-9a-f]{64}$'),
  escopos text[] not null check (
    cardinality(escopos) > 0 and escopos <@ array['simular', 'regras:ler']::text[]
  ),
  ambiente text not null check (ambiente in ('test', 'live')),
  criado_por uuid not null,
  criado_em timestamptz not null default now(),
  ultimo_uso_em timestamptz,
  revogado_em timestamptz,
  expira_em timestamptz
);
create index api_tokens_org_idx on public.api_tokens (organization_id, criado_em desc);

alter table public.api_tokens enable row level security;

-- Leitura para dono e administrador com MFA, sem a coluna do hash.
revoke all on public.api_tokens from anon, authenticated;
grant select (
  id, organization_id, nome, prefixo, escopos, ambiente, criado_por, criado_em,
  ultimo_uso_em, revogado_em, expira_em
) on public.api_tokens to authenticated;
create policy api_tokens_select on public.api_tokens for select to authenticated
  using (
    private.tem_papel(organization_id, array['dono', 'administrador']::public.papel_membro[])
    and private.sessao_aal2()
  );

-- Contagem por token e janela de um minuto. Sem acesso direto: só pela função de autenticação.
create table public.api_uso (
  token_id uuid not null references public.api_tokens (id) on delete cascade,
  janela timestamptz not null,
  contagem integer not null default 0,
  primary key (token_id, janela)
);
alter table public.api_uso enable row level security;
revoke all on public.api_uso from anon, authenticated;

-- Cria um token e devolve o texto completo (a única vez em que ele aparece).
create or replace function public.criar_token_api(
  org uuid,
  nome text,
  escopos text[],
  ambiente text default 'test'
)
returns table (id uuid, token text, prefixo text)
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  nome_limpo text := btrim(nome);
  segredo text;
  completo text;
  novo uuid;
begin
  if uid is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  if not (
    private.tem_papel(org, array['dono', 'administrador']::public.papel_membro[])
    and private.sessao_aal2()
  ) then
    raise exception 'só dono ou administrador, com verificação em duas etapas, cria tokens'
      using errcode = '42501';
  end if;
  if ambiente not in ('test', 'live') then
    raise exception 'ambiente deve ser test ou live' using errcode = '22023';
  end if;

  segredo := encode(extensions.gen_random_bytes(32), 'hex');
  completo := 'cf_' || ambiente || '_' || segredo;

  insert into public.api_tokens (organization_id, nome, prefixo, hash_segredo, escopos, ambiente, criado_por)
  values (
    org,
    nome_limpo,
    'cf_' || ambiente || '_' || left(segredo, 6),
    encode(extensions.digest(completo, 'sha256'), 'hex'),
    escopos,
    ambiente,
    uid
  )
  returning api_tokens.id into novo;

  insert into public.audit_log (organization_id, user_id, acao, alvo, detalhes)
  values (org, uid, 'api.token.criado', novo::text,
          jsonb_build_object('nome', nome_limpo, 'escopos', escopos, 'ambiente', ambiente));

  return query select novo, completo, 'cf_' || ambiente || '_' || left(segredo, 6);
end;
$$;
revoke all on function public.criar_token_api(uuid, text, text[], text) from public, anon;
grant execute on function public.criar_token_api(uuid, text, text[], text) to authenticated;

-- Revogação imediata: a próxima requisição com o token já é recusada.
create or replace function public.revogar_token_api(token_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  org uuid;
begin
  select t.organization_id into org from public.api_tokens t where t.id = token_id;
  if uid is null or org is null or not (
    private.tem_papel(org, array['dono', 'administrador']::public.papel_membro[])
    and private.sessao_aal2()
  ) then
    raise exception 'token não encontrado ou sem permissão' using errcode = '42501';
  end if;
  update public.api_tokens set revogado_em = coalesce(revogado_em, now()) where id = token_id;
  insert into public.audit_log (organization_id, user_id, acao, alvo)
  values (org, uid, 'api.token.revogado', token_id::text);
end;
$$;
revoke all on function public.revogar_token_api(uuid) from public, anon;
grant execute on function public.revogar_token_api(uuid) to authenticated;

-- Chamada pelo servidor da API a cada requisição, com o SHA-256 do token recebido.
-- Exposta ao papel anon de propósito: sem o segredo não há como chegar ao hash.
-- Conta a requisição na janela do minuto e devolve o uso para o limite (429 fica com a API).
create or replace function public.api_autenticar(p_hash text)
returns table (
  token_id uuid,
  organization_id uuid,
  escopos text[],
  ambiente text,
  usados integer,
  reinicio timestamptz
)
language plpgsql security definer set search_path = ''
as $$
declare
  t public.api_tokens;
  agora timestamptz := now();
  janela_atual timestamptz := date_trunc('minute', now());
  total integer;
begin
  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'hash inválido' using errcode = '22023';
  end if;

  select * into t from public.api_tokens a
  where a.hash_segredo = p_hash
    and a.revogado_em is null
    and (a.expira_em is null or a.expira_em > agora);
  if not found then
    return;
  end if;

  insert into public.api_uso as u (token_id, janela, contagem)
  values (t.id, janela_atual, 1)
  -- Pela constraint: o nome de coluna token_id colidiria com a coluna de saída da função.
  on conflict on constraint api_uso_pkey do update set contagem = u.contagem + 1
  returning u.contagem into total;

  -- Limpeza das janelas antigas do próprio token e marca de uso (no máximo uma vez por minuto).
  delete from public.api_uso where api_uso.token_id = t.id and janela < janela_atual - interval '10 minutes';
  update public.api_tokens set ultimo_uso_em = agora
  where id = t.id and (ultimo_uso_em is null or ultimo_uso_em < agora - interval '1 minute');

  return query select t.id, t.organization_id, t.escopos, t.ambiente, total,
    janela_atual + interval '1 minute';
end;
$$;
revoke all on function public.api_autenticar(text) from public;
grant execute on function public.api_autenticar(text) to anon, authenticated;
