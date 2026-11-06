import { createServer } from 'node:http';
import * as Sentry from '@sentry/node';
import { VERSAO_MOTOR } from '@calculafiscal/motor-fiscal';

/**
 * Worker de jobs assíncronos (lotes, importação de XML, oráculo, webhooks).
 * Nesta fase expõe o health check e o monitoramento de erros; a fila pg-boss entra com a conexão ao banco.
 */
const dsn = process.env['SENTRY_DSN'];
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env['APP_ENV'] ?? 'local',
    tracesSampleRate: 0.1,
    // LGPD: nada de dados do usuário, cookies, cabeçalhos, corpos ou query string.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
  });
}

function log(nivel: 'info' | 'erro', msg: string, extra: Record<string, unknown> = {}) {
  console.log(
    JSON.stringify({ nivel, msg, servico: 'worker', ts: new Date().toISOString(), ...extra }),
  );
}

const porta = Number(process.env['PORT'] ?? 8080);

const servidor = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', servico: 'worker', versaoMotor: VERSAO_MOTOR }));
    return;
  }
  res.writeHead(404).end();
});

servidor.listen(porta, () => log('info', 'worker iniciado', { porta, sentry: Boolean(dsn) }));

process.on('uncaughtException', (erro) => {
  log('erro', 'exceção não tratada', { erro: erro.message });
  Sentry.captureException(erro);
  void Sentry.flush(2000).finally(() => process.exit(1));
});

process.on('SIGTERM', () => servidor.close(() => process.exit(0)));
