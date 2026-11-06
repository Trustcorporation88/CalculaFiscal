import { VERSAO_MOTOR } from '@calculafiscal/motor-fiscal';

export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ status: 'ok', servico: 'web', versaoMotor: VERSAO_MOTOR });
}
