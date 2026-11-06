-- Corrige corrida no limite de 5 organizações por dono: duas chamadas simultâneas podiam ler
-- a mesma contagem antes de inserir. A trava transacional por usuário serializa a checagem e os inserts.

create or replace function public.criar_organizacao(nome text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  nova uuid;
  nome_limpo text := btrim(nome);
begin
  if uid is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  if nome_limpo is null or char_length(nome_limpo) not between 2 and 200 then
    raise exception 'nome da organização deve ter entre 2 e 200 caracteres' using errcode = '22023';
  end if;

  -- Liberada no fim da transação. Chave derivada do usuário: só serializa chamadas do mesmo usuário.
  perform pg_advisory_xact_lock(hashtextextended('criar_organizacao:' || uid::text, 0));

  if (select count(*) from public.memberships where user_id = uid and papel = 'dono') >= 5 then
    raise exception 'limite de organizações por usuário atingido' using errcode = '54000';
  end if;

  insert into public.organizations (nome) values (nome_limpo) returning id into nova;
  insert into public.memberships (organization_id, user_id, papel) values (nova, uid, 'dono');
  insert into public.audit_log (organization_id, user_id, acao, alvo)
    values (nova, uid, 'organizacao.criada', nova::text);
  return nova;
end;
$$;

revoke all on function public.criar_organizacao(text) from public, anon;
grant execute on function public.criar_organizacao(text) to authenticated;
