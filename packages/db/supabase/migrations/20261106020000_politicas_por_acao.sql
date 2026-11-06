-- Políticas de escrita separadas por ação (insert/update/delete) para que o SELECT
-- avalie uma única política permissiva. Mesmo efeito de permissão da migration anterior.

create index if not exists company_simples_options_org_idx
  on public.company_simples_options (organization_id);

-- memberships: só dono/administrador gerencia
drop policy mem_write on public.memberships;
create policy mem_insert on public.memberships for insert to authenticated
  with check (private.tem_papel(organization_id, array['dono', 'administrador']::public.papel_membro[]));
create policy mem_update on public.memberships for update to authenticated
  using (private.tem_papel(organization_id, array['dono', 'administrador']::public.papel_membro[]))
  with check (private.tem_papel(organization_id, array['dono', 'administrador']::public.papel_membro[]));
create policy mem_delete on public.memberships for delete to authenticated
  using (private.tem_papel(organization_id, array['dono', 'administrador']::public.papel_membro[]));

-- companies: leitor não escreve
drop policy comp_write on public.companies;
create policy comp_insert on public.companies for insert to authenticated
  with check (private.tem_papel(organization_id, array['dono', 'administrador', 'analista']::public.papel_membro[]));
create policy comp_update on public.companies for update to authenticated
  using (private.tem_papel(organization_id, array['dono', 'administrador', 'analista']::public.papel_membro[]))
  with check (private.tem_papel(organization_id, array['dono', 'administrador', 'analista']::public.papel_membro[]));
create policy comp_delete on public.companies for delete to authenticated
  using (private.tem_papel(organization_id, array['dono', 'administrador', 'analista']::public.papel_membro[]));

-- company_simples_options: leitor não escreve
drop policy opt_write on public.company_simples_options;
create policy opt_insert on public.company_simples_options for insert to authenticated
  with check (private.tem_papel(organization_id, array['dono', 'administrador', 'analista']::public.papel_membro[]));
create policy opt_update on public.company_simples_options for update to authenticated
  using (private.tem_papel(organization_id, array['dono', 'administrador', 'analista']::public.papel_membro[]))
  with check (private.tem_papel(organization_id, array['dono', 'administrador', 'analista']::public.papel_membro[]));
create policy opt_delete on public.company_simples_options for delete to authenticated
  using (private.tem_papel(organization_id, array['dono', 'administrador', 'analista']::public.papel_membro[]));
