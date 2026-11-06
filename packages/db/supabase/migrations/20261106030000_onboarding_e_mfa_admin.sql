-- 1) Onboarding: o usuário logado cria a própria organização e vira dono.
--    Sem isso há um ovo e galinha: a política de memberships exige já ser dono/administrador.
-- 2) MFA obrigatório para administradores: ações administrativas exigem sessão AAL2 (TOTP verificado).

create or replace function private.sessao_aal2()
returns boolean
language sql stable set search_path = ''
as $$
  select coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2';
$$;
revoke all on function private.sessao_aal2() from public, anon;
grant execute on function private.sessao_aal2() to authenticated;

-- Exposta na API de propósito: é o único jeito de criar a primeira organização.
-- Security definer, valida a entrada e sempre usa auth.uid(), nunca um usuário vindo do cliente.
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

-- Ações administrativas passam a exigir AAL2.
drop policy org_update on public.organizations;
create policy org_update on public.organizations for update to authenticated
  using (private.tem_papel(id, array['dono', 'administrador']::public.papel_membro[]) and private.sessao_aal2())
  with check (private.tem_papel(id, array['dono', 'administrador']::public.papel_membro[]) and private.sessao_aal2());

drop policy mem_insert on public.memberships;
drop policy mem_update on public.memberships;
drop policy mem_delete on public.memberships;
create policy mem_insert on public.memberships for insert to authenticated
  with check (private.tem_papel(organization_id, array['dono', 'administrador']::public.papel_membro[]) and private.sessao_aal2());
create policy mem_update on public.memberships for update to authenticated
  using (private.tem_papel(organization_id, array['dono', 'administrador']::public.papel_membro[]) and private.sessao_aal2())
  with check (private.tem_papel(organization_id, array['dono', 'administrador']::public.papel_membro[]) and private.sessao_aal2());
create policy mem_delete on public.memberships for delete to authenticated
  using (private.tem_papel(organization_id, array['dono', 'administrador']::public.papel_membro[]) and private.sessao_aal2());

drop policy audit_select on public.audit_log;
create policy audit_select on public.audit_log for select to authenticated
  using (private.tem_papel(organization_id, array['dono', 'administrador']::public.papel_membro[]) and private.sessao_aal2());
