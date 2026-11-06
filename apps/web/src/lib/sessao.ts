import { redirect } from 'next/navigation';
import { usuarioAtual } from './supabase/server';

export type Vinculo = {
  organization_id: string;
  papel: string;
  organizations: { nome: string } | null;
};

const PAPEIS_ADMIN = new Set(['dono', 'administrador']);

/**
 * Garante sessão válida e aplica a regra de MFA:
 * - quem já tem fator TOTP verificado precisa estar em AAL2 (senão vai para /mfa);
 * - dono e administrador sem fator vão para /conta/seguranca ativar o MFA.
 * O RLS repete a exigência de AAL2 para as ações administrativas.
 */
export async function exigirSessao(opcoes: { permitirSemMfa?: boolean } = {}) {
  const { supabase, usuario } = await usuarioAtual();
  if (!usuario) redirect('/entrar');

  const { data: nivel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (nivel?.nextLevel === 'aal2' && nivel.currentLevel !== 'aal2') redirect('/mfa');

  const { data } = await supabase
    .from('memberships')
    .select('organization_id, papel, organizations(nome)')
    .eq('user_id', usuario.id);
  const vinculos = (data ?? []) as unknown as Vinculo[];

  const ehAdmin = vinculos.some((v) => PAPEIS_ADMIN.has(v.papel));
  const temMfa = nivel?.currentLevel === 'aal2';
  if (ehAdmin && !temMfa && !opcoes.permitirSemMfa)
    redirect('/conta/seguranca?aviso=mfa_obrigatorio');

  return { supabase, usuario, vinculos, temMfa };
}
