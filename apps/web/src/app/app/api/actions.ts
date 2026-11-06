'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { exigirSessao } from '@/lib/sessao';

export type EstadoToken =
  | { readonly situacao: 'vazio' }
  | { readonly situacao: 'erro'; readonly mensagem: string }
  | { readonly situacao: 'criado'; readonly token: string; readonly nome: string };

const NovoToken = z.object({
  org: z.uuid(),
  nome: z.string().trim().min(3, 'Nome com pelo menos 3 letras.').max(80),
  escopos: z.array(z.enum(['simular', 'regras:ler'])).min(1, 'Escolha pelo menos um escopo.'),
});

/** staging = sandbox (cf_test_); produção = cf_live_. */
const ambiente = () => (process.env['APP_ENV'] === 'production' ? 'live' : 'test');

function mensagemDoBanco(codigo: string | undefined): string {
  if (codigo === '42501') {
    return 'Sem permissão: só dono ou administrador, com verificação em duas etapas, gerencia tokens.';
  }
  if (codigo === '23514') return 'Nome ou escopo inválido.';
  return 'Não foi possível concluir. Tente de novo.';
}

/** Cria o token no banco (que gera e guarda só o hash) e mostra o texto completo uma vez. */
export async function criarToken(_anterior: EstadoToken, form: FormData): Promise<EstadoToken> {
  const { supabase } = await exigirSessao();
  const dados = NovoToken.safeParse({
    org: form.get('org'),
    nome: form.get('nome'),
    escopos: form.getAll('escopos'),
  });
  if (!dados.success) {
    return { situacao: 'erro', mensagem: dados.error.issues[0]?.message ?? 'Dados inválidos.' };
  }
  const { data, error } = await supabase.rpc('criar_token_api', {
    org: dados.data.org,
    nome: dados.data.nome,
    escopos: dados.data.escopos,
    ambiente: ambiente(),
  });
  const [criado] = (data ?? []) as { id: string; token: string; prefixo: string }[];
  if (error || !criado) return { situacao: 'erro', mensagem: mensagemDoBanco(error?.code) };
  revalidatePath('/app/api');
  return { situacao: 'criado', token: criado.token, nome: dados.data.nome };
}

export async function revogarToken(form: FormData): Promise<void> {
  const { supabase } = await exigirSessao();
  const id = z.uuid().safeParse(form.get('id'));
  if (!id.success) return;
  await supabase.rpc('revogar_token_api', { token_id: id.data });
  revalidatePath('/app/api');
}
