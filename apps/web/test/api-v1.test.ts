import { tabelaOficial } from '@calculafiscal/regras';
import { describe, expect, it, vi } from 'vitest';
import { autenticar, hashToken, type ConsultaToken } from '../src/lib/api/autenticacao';
import {
  ConsultaRegrasV1,
  EXEMPLO_SIMULACAO,
  RespostaCenariosV1,
  RespostaRegrasV1,
  RespostaSimulacaoV1,
  SimulacaoV1,
} from '../src/lib/api/contrato';
import { documentoOpenApi } from '../src/lib/api/openapi';
import { json, lerCorpoJson, rotaV1, TAMANHO_MAXIMO_CORPO } from '../src/lib/api/rota';
import { consultarRegras, hojeEmBrasilia, listarCenarios, simular } from '../src/lib/api/servicos';

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));

const tabela = tabelaOficial();
const TOKEN = `cf_test_${'a'.repeat(64)}`;

const linha = (extra: Partial<Awaited<ReturnType<ConsultaToken>> & object> = {}) => ({
  token_id: 't1',
  organization_id: 'org1',
  escopos: ['simular', 'regras:ler'],
  ambiente: 'test' as const,
  usados: 1,
  reinicio: new Date(Date.now() + 30_000).toISOString(),
  ...extra,
});

describe('contrato (OpenAPI 3.1 gerado do Zod)', () => {
  const doc = documentoOpenApi() as {
    openapi: string;
    paths: Record<string, Record<string, { requestBody?: unknown; responses: object }>>;
    components: { schemas: Record<string, unknown> };
  };

  it('publica as rotas, o esquema de erro e é JSON válido', () => {
    expect(doc.openapi).toBe('3.1.0');
    expect(Object.keys(doc.paths).sort()).toEqual([
      '/v1/cenarios',
      '/v1/openapi.json',
      '/v1/regras',
      '/v1/regras/pacote',
      '/v1/regras/versao',
      '/v1/simulacoes',
    ]);
    expect(doc.components.schemas['Problema']).toBeDefined();
    expect(JSON.parse(JSON.stringify(doc))).toEqual(doc);
  });

  it('o exemplo publicado é aceito pelo contrato', () => {
    expect(SimulacaoV1.safeParse(EXEMPLO_SIMULACAO).success).toBe(true);
  });

  it('a resposta real da simulação bate com o contrato (caso Coca-Cola)', () => {
    const r = simular(SimulacaoV1.parse(EXEMPLO_SIMULACAO), tabela, 'req-1');
    expect(RespostaSimulacaoV1.safeParse(r).success).toBe(true);
    const [item] = r.itens;
    expect(item?.idExterno).toBe('produto-123');
    if (item?.situacao !== 'calculado') throw new Error('esperava cálculo');
    const a2026 = item.resultado.anos[0];
    expect(a2026?.situacao === 'CALCULADO' && a2026.valores.precoComTributo).toBe('8.02');
    expect(r.versao_regras).toBe(tabela.versao);
  });

  it('regras e cenários batem com o contrato', () => {
    const reducoes = consultarRegras(
      { data: '2027-07-01', tributo: 'REDUCAO_CBS_IBS' },
      tabela,
      'req-2',
    );
    expect(RespostaRegrasV1.safeParse(reducoes).success).toBe(true);
    expect(reducoes.regras).toHaveLength(16);
    expect(RespostaCenariosV1.safeParse(listarCenarios(tabela, 'req-3')).success).toBe(true);
  });
});

describe('validação da simulação', () => {
  const base = SimulacaoV1.parse(EXEMPLO_SIMULACAO);

  it('recusa campo desconhecido, fração de 100% e Simples sem DAS', () => {
    const extra = { ...EXEMPLO_SIMULACAO, outro: 1 };
    expect(SimulacaoV1.safeParse(extra).success).toBe(false);
    const fracao = structuredClone(EXEMPLO_SIMULACAO);
    fracao.venda.margem = '1';
    expect(SimulacaoV1.safeParse(fracao).success).toBe(false);
    const semDas = structuredClone(EXEMPLO_SIMULACAO);
    delete semDas.venda.aliquotaDas;
    const r = SimulacaoV1.safeParse(semDas);
    expect(!r.success && r.error.issues[0]?.path).toEqual(['venda', 'aliquotaDas']);
    expect(!r.success && r.error.issues[0]?.message).toBe(
      'Simples Nacional exige a alíquota efetiva do DAS.',
    );
  });

  it('mensagens do Zod sem texto próprio saem em português', () => {
    const r = SimulacaoV1.safeParse({ ...EXEMPLO_SIMULACAO, outro: 1 });
    expect(!r.success && r.error.issues[0]?.message).toMatch(/Chave/);
  });

  it('data inexistente na consulta de regras é recusada', () => {
    expect(ConsultaRegrasV1.safeParse({ data: '2027-02-31' }).success).toBe(false);
    expect(ConsultaRegrasV1.safeParse({ data: '2028-02-29' }).success).toBe(true);
  });

  it('o OpenAPI publica as mesmas restrições da validação (sem refine escondido)', () => {
    const texto = JSON.stringify(documentoOpenApi());
    // O padrão da fração, como aparece serializado no JSON.
    expect(texto).toContain(JSON.stringify(String.raw`^0(\.\d{1,10})?$`));
    expect(texto).toContain('"oneOf"');
    expect(texto).toContain('"format":"date"');
  });

  it('item impossível volta com problema; os outros são calculados', () => {
    const r = simular(
      {
        ...base,
        itens: [
          ...base.itens,
          {
            ...base.itens[0]!,
            idExterno: 'ruim',
            compra: { ...base.itens[0]!.compra, totalNota: '0.01', freteEDespesas: '5' },
          },
        ],
      },
      tabela,
      'req-4',
    );
    expect(r.itens.map((i) => i.situacao)).toEqual(['calculado', 'erro']);
    const ruim = r.itens[1];
    expect(ruim?.situacao === 'erro' && ruim.problema.codigo).toBe('entrada-impossivel');
    expect(RespostaSimulacaoV1.safeParse(r).success).toBe(true);
  });

  it('regime regular usa os tributos da saída e o tratamento do item', () => {
    const r = simular(
      SimulacaoV1.parse({
        ...EXEMPLO_SIMULACAO,
        venda: { regime: 'REAL', despesasVariaveis: '0.06', margem: '0.25' },
        itens: [{ ...EXEMPLO_SIMULACAO.itens[0], cClassTrib: '200034' }],
      }),
      tabela,
      'req-5',
    );
    const [item] = r.itens;
    expect(item?.situacao === 'calculado' && item.resultado.tratamento?.reducao).toBe('0.6');
  });
});

describe('autenticação por token', () => {
  it('sem cabeçalho ou com formato errado não consulta o banco', async () => {
    const consultar = vi.fn<ConsultaToken>();
    expect(await autenticar(null, consultar)).toEqual({ ok: false, codigo: 'token-ausente' });
    expect(await autenticar('Basic abc', consultar)).toEqual({
      ok: false,
      codigo: 'token-ausente',
    });
    expect(await autenticar('Bearer cf_test_curto', consultar)).toEqual({
      ok: false,
      codigo: 'token-invalido',
    });
    expect(consultar).not.toHaveBeenCalled();
  });

  it('consulta pelo SHA-256 do token, nunca pelo token', async () => {
    const consultar = vi.fn<ConsultaToken>().mockResolvedValue(linha());
    const r = await autenticar(`Bearer ${TOKEN}`, consultar);
    expect(consultar).toHaveBeenCalledWith(hashToken(TOKEN));
    expect(hashToken(TOKEN)).toMatch(/^[0-9a-f]{64}$/);
    expect(r.ok && r.credencial.organizationId).toBe('org1');
    const nada = vi.fn<ConsultaToken>().mockResolvedValue(null);
    expect(await autenticar(`Bearer ${TOKEN}`, nada)).toEqual({
      ok: false,
      codigo: 'token-invalido',
    });
  });
});

describe('rotas /v1', () => {
  const pedir = (cabecalhos: Record<string, string> = {}) =>
    new Request('http://localhost/v1/teste', {
      method: 'POST',
      headers: { authorization: `Bearer ${TOKEN}`, ...cabecalhos },
    });
  const rota = (consultar: ConsultaToken, tratar = async () => json({ ok: true })) =>
    rotaV1({ escopo: 'simular', nome: 'teste', consultar }, tratar);

  it('200 com request_id e cabeçalhos de limite', async () => {
    const r = await rota(async () => linha({ usados: 10 }))(pedir());
    expect(r.status).toBe(200);
    expect(r.headers.get('X-Request-Id')).toMatch(/^[0-9a-f-]{36}$/);
    expect(r.headers.get('RateLimit-Remaining')).toBe('50');
    expect(r.headers.get('Cache-Control')).toBe('no-store');
  });

  it('401 em problem+json com WWW-Authenticate', async () => {
    const r = await rota(async () => null)(pedir());
    expect(r.status).toBe(401);
    expect(r.headers.get('Content-Type')).toMatch(/application\/problem\+json/);
    expect(r.headers.get('WWW-Authenticate')).toBe('Bearer');
    const corpo = (await r.json()) as {
      codigo: string;
      request_id: string;
      versao_motor: string;
      versao_regras: string;
    };
    expect(corpo.codigo).toBe('token-invalido');
    expect(corpo.versao_motor).toMatch(/^\d+\.\d+\.\d+$/);
    expect(corpo.versao_regras).toBe(tabela.versao);
    expect(corpo.request_id).toBe(r.headers.get('X-Request-Id'));
  });

  it('403 sem o escopo e 429 acima do limite', async () => {
    const semEscopo = await rota(async () => linha({ escopos: ['regras:ler'] }))(pedir());
    expect(semEscopo.status).toBe(403);
    const excedido = await rota(async () => linha({ usados: 61 }))(pedir());
    expect(excedido.status).toBe(429);
    expect(Number(excedido.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect(excedido.headers.get('RateLimit-Remaining')).toBe('0');
  });

  it('500 em problem+json quando algo falha, sem vazar o erro', async () => {
    const r = await rota(
      async () => linha(),
      async () => {
        throw new Error('segredo interno');
      },
    )(pedir());
    expect(r.status).toBe(500);
    expect(await r.text()).not.toMatch(/segredo interno/);
  });

  it('corpo: 415 sem JSON, 413 grande demais, 400 malformado', async () => {
    const corpo = (texto: string, tipo = 'application/json') =>
      new Request('http://localhost/v1/teste', {
        method: 'POST',
        headers: { 'content-type': tipo },
        body: texto,
      });
    const r415 = await lerCorpoJson(corpo('{}', 'text/plain'), 'r');
    expect(!r415.ok && r415.resposta.status).toBe(415);
    const r413 = await lerCorpoJson(corpo('x'.repeat(TAMANHO_MAXIMO_CORPO + 1)), 'r');
    expect(!r413.ok && r413.resposta.status).toBe(413);
    // Conta bytes, não caracteres: "é" ocupa 2 bytes em UTF-8.
    const multibyte = await lerCorpoJson(corpo('é'.repeat(TAMANHO_MAXIMO_CORPO / 2 + 1)), 'r');
    expect(!multibyte.ok && multibyte.resposta.status).toBe(413);
    const r400 = await lerCorpoJson(corpo('{'), 'r');
    expect(!r400.ok && r400.resposta.status).toBe(400);
    const ok = await lerCorpoJson(corpo('{"a":1}'), 'r');
    expect(ok.ok && ok.corpo).toEqual({ a: 1 });
  });
});

describe('regras por data e NCM', () => {
  it('filtra por NCM mantendo as regras gerais e usa a data de Brasília', () => {
    const r = consultarRegras({ data: '2027-03-01', ncm: '2202.10.00' }, tabela, 'r');
    expect(r.regras.some((x) => x.id === 'is.bebidas-acucaradas')).toBe(true);
    expect(r.regras.some((x) => x.id === 'is.cervejas')).toBe(false);
    expect(r.regras.some((x) => x.tributo === 'CBS')).toBe(true);
    const so200003 = consultarRegras(
      { data: '2027-03-01', tributo: 'REDUCAO_CBS_IBS', cClassTrib: '200003' },
      tabela,
      'r',
    );
    expect(so200003.regras.map((x) => x.id)).toEqual(['reducao.cclasstrib-200003']);
    expect(hojeEmBrasilia(new Date('2026-11-07T01:00:00Z'))).toBe('2026-11-06');
  });
});
