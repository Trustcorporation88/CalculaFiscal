import { createHash } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { envPublico } from '../env';

/** Requisições por minuto por token (janela fixa de um minuto, contada no Postgres). */
export const LIMITE_POR_MINUTO = 60;

export type Escopo = 'simular' | 'regras:ler';

export interface Credencial {
  readonly tokenId: string;
  readonly organizationId: string;
  readonly escopos: readonly string[];
  readonly ambiente: 'test' | 'live';
  readonly usados: number;
  readonly reinicio: Date;
}

export type Autenticacao =
  | { readonly ok: true; readonly credencial: Credencial }
  | { readonly ok: false; readonly codigo: 'token-ausente' | 'token-invalido' };

const FORMATO_TOKEN = /^cf_(test|live)_[0-9a-f]{64}$/;

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

type LinhaAutenticacao = {
  token_id: string;
  organization_id: string;
  escopos: string[];
  ambiente: 'test' | 'live';
  usados: number;
  reinicio: string;
};

/** Consulta o banco pelo hash. Separada para os testes trocarem por uma versão em memória. */
export type ConsultaToken = (hash: string) => Promise<LinhaAutenticacao | null>;

let cliente: SupabaseClient | undefined;

/** Cliente sem sessão de usuário: a API só chama a função api_autenticar (papel anon). */
export const consultaSupabase: ConsultaToken = async (hash) => {
  if (!cliente) {
    const env = envPublico();
    cliente = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  const { data, error } = await cliente.rpc('api_autenticar', { p_hash: hash });
  if (error) throw new Error(`api_autenticar falhou: ${error.code ?? ''} ${error.message}`);
  const [linha] = (data ?? []) as LinhaAutenticacao[];
  return linha ?? null;
};

/** Lê "Authorization: Bearer cf_..." e autentica pelo hash; o token em si nunca sai do servidor. */
export async function autenticar(
  cabecalho: string | null,
  consultar: ConsultaToken = consultaSupabase,
): Promise<Autenticacao> {
  const [tipo, token] = (cabecalho ?? '').trim().split(/\s+/);
  if (!tipo || !token || tipo.toLowerCase() !== 'bearer')
    return { ok: false, codigo: 'token-ausente' };
  // Formato errado nem chega ao banco.
  if (!FORMATO_TOKEN.test(token)) return { ok: false, codigo: 'token-invalido' };
  const linha = await consultar(hashToken(token));
  if (!linha) return { ok: false, codigo: 'token-invalido' };
  return {
    ok: true,
    credencial: {
      tokenId: linha.token_id,
      organizationId: linha.organization_id,
      escopos: linha.escopos,
      ambiente: linha.ambiente,
      usados: linha.usados,
      reinicio: new Date(linha.reinicio),
    },
  };
}
