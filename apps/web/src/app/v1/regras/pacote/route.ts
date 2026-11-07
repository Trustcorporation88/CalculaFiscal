import { respostaPacote } from '@/lib/api/pacote-regras';
import { rotaPublica } from '@/lib/api/publica';

export const dynamic = 'force-dynamic';

/** GET /v1/regras/pacote: pacote de regras assinado com Ed25519, para o app. Público. */
export const GET = rotaPublica({ nome: 'GET /v1/regras/pacote' }, respostaPacote);
