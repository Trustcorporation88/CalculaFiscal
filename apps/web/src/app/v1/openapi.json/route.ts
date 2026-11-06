import { documentoOpenApi } from '@/lib/api/openapi';

/** GET /v1/openapi.json: o contrato, público e sem token. */
export function GET() {
  return new Response(JSON.stringify(documentoOpenApi(), null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
