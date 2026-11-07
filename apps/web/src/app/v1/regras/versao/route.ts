import { respostaVersao } from '@/lib/api/pacote-regras';
import { rotaPublica } from '@/lib/api/publica';

export const dynamic = 'force-dynamic';

/** GET /v1/regras/versao: versão e data do pacote de regras assinado. Público, sem token. */
export const GET = rotaPublica({ nome: 'GET /v1/regras/versao' }, () => respostaVersao());
