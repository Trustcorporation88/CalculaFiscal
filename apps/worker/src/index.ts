import { createServer } from 'node:http';
import { VERSAO_MOTOR } from '@calculafiscal/motor-fiscal';

/**
 * Worker de jobs assíncronos (lotes, importação de XML, oráculo, webhooks).
 * Nesta fase só expõe o health check; a fila pg-boss entra junto com a conexão ao Supabase.
 */
const porta = Number(process.env['PORT'] ?? 8080);

const servidor = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', servico: 'worker', versaoMotor: VERSAO_MOTOR }));
    return;
  }
  res.writeHead(404).end();
});

servidor.listen(porta, () => {
  console.log(JSON.stringify({ nivel: 'info', msg: 'worker iniciado', porta }));
});

process.on('SIGTERM', () => servidor.close(() => process.exit(0)));
