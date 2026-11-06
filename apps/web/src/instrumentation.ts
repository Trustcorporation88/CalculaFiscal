import * as Sentry from '@sentry/nextjs';

/** Inicializa o Sentry no servidor (Node e Edge). Sem SENTRY_DSN, não faz nada. */
export async function register() {
  const dsn = process.env['SENTRY_DSN'];
  if (!dsn) return;
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

export const onRequestError = Sentry.captureRequestError;
