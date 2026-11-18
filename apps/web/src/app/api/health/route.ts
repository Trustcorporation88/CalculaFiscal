import { VERSAO_MOTOR } from '@calculafiscal/motor-fiscal';
import { PACOTE_ASSINADO } from '@calculafiscal/regras/assinado';

export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({
    status: 'ok',
    servico: 'web',
    versaoMotor: VERSAO_MOTOR,
    versaoRegras: PACOTE_ASSINADO.versao,
  });
}
