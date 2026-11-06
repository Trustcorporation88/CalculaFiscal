-- As funções auxiliares do RLS não devem ser chamáveis pela API (/rest/v1/rpc).
-- Movidas para um schema que o PostgREST não expõe. As políticas referenciam a função
-- pelo OID, então continuam valendo sem recriação.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter function public.org_ids_do_usuario() set schema private;
alter function public.tem_papel(uuid, public.papel_membro[]) set schema private;

revoke all on function private.org_ids_do_usuario() from public, anon;
revoke all on function private.tem_papel(uuid, public.papel_membro[]) from public, anon;
grant execute on function private.org_ids_do_usuario() to authenticated;
grant execute on function private.tem_papel(uuid, public.papel_membro[]) to authenticated;
