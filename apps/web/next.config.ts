import { withSentryConfig } from '@sentry/nextjs/config';
import type { NextConfig } from 'next';

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self' https://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const config: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ['@calculafiscal/motor-fiscal', '@calculafiscal/regras'],
  // App do celular na versão web (iPhone): exportado do Expo para public/celular.
  async rewrites() {
    return [
      { source: '/celular', destination: '/celular/index.html' },
      { source: '/celular/', destination: '/celular/index.html' },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

// Eventos do navegador passam por /monitoramento (mesma origem): dispensa liberar o Sentry no CSP
// e não é bloqueado por bloqueadores de anúncio. Sem SENTRY_AUTH_TOKEN, o upload de source maps é pulado.
export default withSentryConfig(config, {
  silent: !process.env['CI'],
  tunnelRoute: '/monitoramento',
  telemetry: false,
});
