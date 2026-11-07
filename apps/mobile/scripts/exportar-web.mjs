// Exporta o app para a web e publica em apps/web/public/celular, servido pelo site em /celular.
// É o caminho do iPhone (que não instala APK): abrir no Safari e "Adicionar à Tela de Início".
// Rode depois de mudar o app: pnpm --filter @calculafiscal/mobile exportar:web
import { execSync } from 'node:child_process';
import { copyFileSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = dirname(dirname(fileURLToPath(import.meta.url)));
const destino = join(app, '..', 'web', 'public', 'celular');

rmSync(destino, { recursive: true, force: true });
execSync(`npx expo export -p web --output-dir "${destino}" --clear`, {
  cwd: app,
  stdio: 'inherit',
});

copyFileSync(join(app, 'assets', 'icon.png'), join(destino, 'icone.png'));
writeFileSync(
  join(destino, 'manifest.webmanifest'),
  JSON.stringify(
    {
      name: 'Calculadora Fiscal',
      short_name: 'Calculadora',
      start_url: '/celular/',
      scope: '/celular/',
      display: 'standalone',
      background_color: '#fbfaf7',
      theme_color: '#1f4e79',
      lang: 'pt-BR',
      icons: [{ src: '/celular/icone.png', sizes: '1024x1024', type: 'image/png' }],
    },
    null,
    2,
  ),
);

const pagina = join(destino, 'index.html');
const html = readFileSync(pagina, 'utf8')
  .replace('<html lang="en">', '<html lang="pt-BR">')
  .replace(
    '</head>',
    [
      '<meta name="apple-mobile-web-app-capable" content="yes">',
      '<meta name="mobile-web-app-capable" content="yes">',
      '<meta name="apple-mobile-web-app-title" content="Calculadora">',
      '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
      '<link rel="apple-touch-icon" href="/celular/icone.png">',
      '<link rel="manifest" href="/celular/manifest.webmanifest">',
      '</head>',
    ].join(''),
  );
writeFileSync(pagina, html);
console.log(`App web exportado para ${destino}`);
