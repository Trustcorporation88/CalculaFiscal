import { VERSAO_MOTOR } from '@calculafiscal/motor-fiscal';
import { z } from 'zod';
import {
  ConsultaRegrasV1,
  EXEMPLO_SIMULACAO,
  LIMITE_ITENS_SINCRONO,
  Problema,
  RespostaCenariosV1,
  RespostaRegrasV1,
  RespostaSimulacaoV1,
  SimulacaoV1,
} from './contrato';
import { LIMITE_POR_MINUTO } from './autenticacao';
import { PROBLEMAS } from './problema';

type Esquema = Record<string, unknown>;

const esquema = (s: z.ZodType, io: 'input' | 'output' = 'output'): Esquema => {
  const { $schema: _ignorado, ...resto } = z.toJSONSchema(s, {
    io,
    unrepresentable: 'any',
  }) as Esquema;
  return resto;
};

const refProblema = { $ref: '#/components/schemas/Problema' };

const respostasDeErro = (codigos: (keyof typeof PROBLEMAS)[]) =>
  Object.fromEntries(
    [...new Set(codigos.map((c) => PROBLEMAS[c].status))].map((status) => [
      String(status),
      {
        description: codigos
          .filter((c) => PROBLEMAS[c].status === status)
          .map((c) => `${c}: ${PROBLEMAS[c].title}`)
          .join('; '),
        content: { 'application/problem+json': { schema: refProblema } },
      },
    ]),
  );

const ERROS_COMUNS: (keyof typeof PROBLEMAS)[] = [
  'token-ausente',
  'token-invalido',
  'escopo-insuficiente',
  'limite-excedido',
  'erro-interno',
];

const cabecalhosLimite = {
  'X-Request-Id': { schema: { type: 'string' }, description: 'Identificador da requisição.' },
  'RateLimit-Limit': { schema: { type: 'string' } },
  'RateLimit-Remaining': { schema: { type: 'string' } },
  'RateLimit-Reset': { schema: { type: 'string' }, description: 'Segundos até a próxima janela.' },
};

/** Documento OpenAPI 3.1 gerado do contrato Zod. É o que GET /v1/openapi.json devolve. */
export function documentoOpenApi(): Esquema {
  const parametrosRegras = Object.entries(
    (esquema(ConsultaRegrasV1, 'input')['properties'] ?? {}) as Record<string, Esquema>,
  ).map(([nome, schema]) => ({
    name: nome,
    in: 'query',
    required: false,
    schema,
    ...(typeof schema['description'] === 'string' ? { description: schema['description'] } : {}),
  }));

  return {
    openapi: '3.1.0',
    info: {
      title: 'Calculadora Fiscal API',
      version: '1.0.0',
      description: [
        'Preço, margem e tributos (CBS, IBS, IS, ICMS e transição) de 2026 a 2033, com memória de cálculo.',
        'Valores monetários e alíquotas trafegam como texto decimal com ponto ("8.02", "0.18").',
        `Toda resposta traz request_id e as versões do motor (${VERSAO_MOTOR}) e das tabelas de regras.`,
        `Limite: ${LIMITE_POR_MINUTO} requisições por minuto por token; até ${LIMITE_ITENS_SINCRONO} itens por simulação síncrona.`,
      ].join('\n\n'),
    },
    servers: [{ url: '/', description: 'Mesmo endereço do site (staging = sandbox).' }],
    security: [{ token: [] }],
    components: {
      securitySchemes: {
        token: {
          type: 'http',
          scheme: 'bearer',
          description:
            'Token de serviço da organização (cf_test_... ou cf_live_...), criado em Painel > API.',
        },
      },
      schemas: { Problema: esquema(Problema) },
    },
    paths: {
      '/v1/simulacoes': {
        post: {
          operationId: 'simular',
          summary: 'Simula o preço de 2026 a 2033 para até 20 itens',
          description:
            'Mesmo cálculo da tela: linha do tempo, preço psicológico, cenários, comparativo e memória de cálculo. Escopo: simular. Um item com combinação impossível volta com situacao "erro" e não impede os outros.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: esquema(SimulacaoV1, 'input'),
                examples: {
                  cocaCola: {
                    summary: 'Caso Coca-Cola (premissas estimadas)',
                    value: EXEMPLO_SIMULACAO,
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Resultado por item.',
              headers: cabecalhosLimite,
              content: { 'application/json': { schema: esquema(RespostaSimulacaoV1) } },
            },
            ...respostasDeErro([
              'corpo-invalido',
              'corpo-grande',
              'tipo-de-conteudo',
              ...ERROS_COMUNS,
            ]),
          },
        },
      },
      '/v1/regras': {
        get: {
          operationId: 'listarRegras',
          summary: 'Regras vigentes numa data, com fonte, vigência e status',
          description:
            'Escopo: regras:ler. Use tributo=REDUCAO_CBS_IBS para os tratamentos (cClassTrib) com redução.',
          parameters: parametrosRegras,
          responses: {
            '200': {
              description: 'Regras vigentes.',
              headers: cabecalhosLimite,
              content: { 'application/json': { schema: esquema(RespostaRegrasV1) } },
            },
            ...respostasDeErro(['corpo-invalido', ...ERROS_COMUNS]),
          },
        },
      },
      '/v1/cenarios': {
        get: {
          operationId: 'listarCenarios',
          summary: 'Cenários disponíveis e suas premissas',
          description: 'Escopo: regras:ler.',
          responses: {
            '200': {
              description: 'Cenários.',
              headers: cabecalhosLimite,
              content: { 'application/json': { schema: esquema(RespostaCenariosV1) } },
            },
            ...respostasDeErro(ERROS_COMUNS),
          },
        },
      },
      '/v1/openapi.json': {
        get: {
          operationId: 'contrato',
          summary: 'Este documento',
          security: [],
          responses: { '200': { description: 'OpenAPI 3.1.' } },
        },
      },
    },
  };
}
