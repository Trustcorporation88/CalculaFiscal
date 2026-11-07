import { verificarPacote } from '@calculafiscal/regras/assinatura';
import { tabelaOficial } from '@calculafiscal/regras';
import { describe, expect, it, vi } from 'vitest';
import { respostaPacote, versaoDoPacote } from '../src/lib/api/pacote-regras';
import { criarLimitador, enderecoDe, rotaPublica } from '../src/lib/api/publica';

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));

const pedido = (cabecalhos: Record<string, string> = {}) =>
  new Request('https://imposto.trustcorp.com.br/v1/regras/pacote', { headers: cabecalhos });

describe('pacote de regras para o app (/v1/regras/versao e /pacote)', () => {
  it('a versão publicada é a mesma das regras do site', () => {
    const v = versaoDoPacote();
    expect(v.versao).toBe(tabelaOficial().versao);
    expect(v.formato).toBe(1);
    expect(v.tamanhoBytes).toBeGreaterThan(1000);
  });

  it('o pacote servido passa na verificação do app', async () => {
    const r = respostaPacote(pedido());
    expect(r.status).toBe(200);
    expect(r.headers.get('etag')).toBe(`"${tabelaOficial().versao}"`);
    const v = verificarPacote(await r.json());
    expect(v.ok).toBe(true);
  });

  it('responde 304 quando o app já tem a versão', () => {
    const r = respostaPacote(pedido({ 'If-None-Match': `"${tabelaOficial().versao}"` }));
    expect(r.status).toBe(304);
  });

  it('limita por endereço e devolve problem+json com Retry-After', async () => {
    let agora = 0;
    const limitador = criarLimitador(2, 60_000, () => agora);
    const rota = rotaPublica({ nome: 'teste', limitador }, () => new Response('ok'));
    const de = (ip: string) => pedido({ 'X-Real-IP': ip });
    expect(rota(de('1.1.1.1')).status).toBe(200);
    expect(rota(de('1.1.1.1')).status).toBe(200);
    const bloqueada = rota(de('1.1.1.1'));
    expect(bloqueada.status).toBe(429);
    expect(bloqueada.headers.get('content-type')).toContain('application/problem+json');
    expect(bloqueada.headers.get('retry-after')).toBe('60');
    expect(rota(de('2.2.2.2')).status).toBe(200);
    agora = 60_000;
    expect(rota(de('1.1.1.1')).status).toBe(200);
  });

  it('usa o último endereço do X-Forwarded-For (o que o proxy acrescentou)', () => {
    expect(enderecoDe(pedido({ 'X-Forwarded-For': '9.9.9.9, 3.3.3.3' }))).toBe('3.3.3.3');
    expect(enderecoDe(pedido())).toBe('desconhecido');
  });
});
