import { z } from 'zod';
import { CENARIOS } from '@calculafiscal/regras/cenarios';

// Mensagens de validação do Zod em português (campos sem mensagem própria, chaves desconhecidas).
z.config(z.locales.pt());

/**
 * Contrato da API /v1. Estes schemas são a fonte da verdade: validam as requisições, conferem as
 * respostas nos testes e geram o OpenAPI 3.1 (GET /v1/openapi.json).
 * Valores monetários e alíquotas trafegam como string decimal com ponto ("8.02", "0.18").
 */

// As restrições ficam em regex (e não em refine) para aparecerem no OpenAPI publicado.

/** Decimal com ponto, até 9 dígitos inteiros (abaixo de R$ 1 bilhão) e 10 casas. */
const Decimal = z
  .string()
  .regex(
    /^\d{1,9}(\.\d{1,10})?$/,
    'decimal como texto, com ponto e até 9 dígitos inteiros: "4.89"',
  );

/** Fração menor que 1: "0", "0.18" (18%), "0.0925". */
const Fracao = z
  .string()
  .regex(/^0(\.\d{1,10})?$/, 'fração menor que 1, como texto com ponto: "0.18" para 18%');

/** Data de calendário real (AAAA-MM-DD), com ano bissexto: 2027-02-31 é recusada. */
export const DataCalendario = z.iso.date({
  error: 'data inexistente ou fora do formato AAAA-MM-DD',
});

const Status = z.enum([
  'EM_VIGOR',
  'PUBLICADO_EFEITO_FUTURO',
  'PROPOSTO',
  'PENDENTE',
  'ESTIMATIVA',
]);
const BaseMargem = z.enum(['PRECO_COM_TRIBUTO', 'RECEITA_LIQUIDA']);
const Cenario = z.enum(CENARIOS);

// ---------------------------------------------------------------- requisição

export const CompraV1 = z
  .object({
    totalNota: Decimal.describe(
      'Total da nota de compra por unidade, hoje (2026), com IPI e ICMS-ST.',
    ),
    aliquotaIcms: Fracao.describe('ICMS do fornecedor.'),
    aliquotaIpi: Fracao.describe('IPI pela TIPI de 2026.'),
    aliquotaPisCofins: Fracao.describe('PIS e Cofins do fornecedor, embutidos no preço.'),
    substituicaoTributaria: z
      .object({
        mva: Decimal.describe('MVA em fração (pode passar de 1).'),
        aliquotaInterna: Fracao,
      })
      .nullable()
      .default(null)
      .describe('Nulo quando a compra não tem ICMS-ST.'),
    freteEDespesas: Decimal.default('0'),
  })
  .strict();

export const ItemV1 = z
  .object({
    idExterno: z
      .string()
      .min(1)
      .max(100)
      .optional()
      .describe('Identificador do item no sistema de origem; volta igual na resposta.'),
    descricao: z.string().max(120).default(''),
    ncm: z
      .string()
      .regex(/^\d{4}\.?\d{2}\.?\d{2}$/)
      .optional()
      .describe('Necessário para o Imposto Seletivo.'),
    cClassTrib: z
      .string()
      .regex(/^\d{6}$/)
      .default('000001')
      .describe(
        'Tratamento de CBS/IBS. 000001 = tributação integral. Ver GET /v1/regras?tributo=REDUCAO_CBS_IBS.',
      ),
    compra: CompraV1,
  })
  .strict();

const comuns = {
  despesasVariaveis: Fracao,
  margem: Fracao,
  baseMargem: BaseMargem.default('PRECO_COM_TRIBUTO'),
};

/** Venda por regime: no Simples o DAS é obrigatório; no regime regular, os tributos da saída. */
export const VendaV1 = z.discriminatedUnion('regime', [
  z
    .object({
      regime: z.enum(['SIMPLES_DAS', 'SIMPLES_REGULAR']),
      aliquotaDas: z
        .string({
          error: (iss) =>
            iss.input === undefined
              ? 'Simples Nacional exige a alíquota efetiva do DAS.'
              : undefined,
        })
        .regex(/^0(\.\d{1,10})?$/, 'fração menor que 1, como texto com ponto: "0.08" para 8%')
        .describe('Alíquota efetiva do DAS.'),
      parcelaCbsIbsNoDas: Fracao.optional().describe(
        'Parte do DAS que é CBS/IBS. Ainda não definida pelo CGSN: sem ela, o Simples regular volta como dado pendente.',
      ),
      ...comuns,
    })
    .strict(),
  z
    .object({
      regime: z.enum(['PRESUMIDO', 'REAL']),
      aliquotaIcmsSaida: Fracao.default('0'),
      creditaIcmsEntrada: z.boolean().default(false),
      aliquotaPisCofinsSaida: Fracao.default('0'),
      creditoPisCofinsEntrada: Fracao.default('0'),
      ...comuns,
    })
    .strict(),
]);

export const LIMITE_ITENS_SINCRONO = 20;

export const SimulacaoV1 = z
  .object({
    cenario: Cenario.default('base'),
    impostoSimplificado: Fracao.default('0.265').describe(
      'Imposto por dentro do "cálculo simplificado", só para o comparativo.',
    ),
    venda: VendaV1,
    itens: z.array(ItemV1).min(1).max(LIMITE_ITENS_SINCRONO),
  })
  .strict();

export type SimulacaoV1 = z.infer<typeof SimulacaoV1>;
export type ItemV1 = z.infer<typeof ItemV1>;

// ---------------------------------------------------------------- resposta

const PassoMemoria = z.object({
  id: z.string(),
  descricao: z.string(),
  formula: z.string(),
  entradas: z.record(z.string(), z.string()),
  resultado: z.string(),
  regras: z.array(z.string()).describe('Regras aplicadas (id@versão).'),
});

const Valores = z.object({
  preco: z.string(),
  precoComTributo: z.string().describe('O que o cliente paga: preço + CBS + IBS por fora.'),
  custoLiquido: z.string(),
  totalNotaCompra: z.string(),
  icms: z.string(),
  pisCofins: z.string(),
  das: z.string(),
  cbs: z.string(),
  ibs: z.string(),
  creditoTransferido: z.string().nullable().describe('Nulo quando depende de dado pendente.'),
  despesas: z.string(),
  lucro: z.string(),
  margemSobrePrecoComTributo: z.string(),
  margemSobreReceitaLiquida: z.string(),
});

const ResultadoAno = z.discriminatedUnion('situacao', [
  z.object({
    ano: z.number().int(),
    situacao: z.literal('CALCULADO'),
    status: Status,
    valores: Valores,
    memoria: z.array(PassoMemoria),
  }),
  z.object({
    ano: z.number().int(),
    situacao: z.literal('DADO_PENDENTE'),
    status: Status,
    motivo: z.string(),
    memoria: z.array(PassoMemoria),
  }),
]);

const Fonte = z.object({
  chave: z.string(),
  tributo: z.string(),
  descricao: z.string(),
  aliquota: z.string(),
  vigencia: z.string(),
  norma: z.string(),
  artigo: z.string(),
  url: z.string().nullable(),
  status: Status,
  conferencia: z.enum(['OK', 'CONFERIR']),
  observacao: z.string().nullable(),
});

const ResumoAno = z.object({
  ano: z.number().int(),
  status: Status,
  precoComTributo: z.string().nullable(),
  sugerido: z.string().nullable(),
  margemSobrePrecoComTributo: z.string().nullable(),
});

export const ResultadoItemV1 = z.object({
  precoLiquidoFornecedor: z.string(),
  faixaPrecoLiquido: z.object({ de: z.string(), ate: z.string() }),
  ajusteNota: z.string().nullable(),
  tratamento: z
    .object({ codigo: z.string(), descricao: z.string(), reducao: z.string() })
    .nullable(),
  memoriaNota: PassoMemoria,
  anos: z.array(ResultadoAno).describe('2026 a 2033, no cenário pedido.'),
  sugestoes: z
    .array(z.object({ ano: z.number().int(), sugerido: z.string(), resultado: ResultadoAno }))
    .describe('Preço psicológico de cada ano e o resultado nesse preço.'),
  cenarios: z
    .array(z.object({ cenario: Cenario, anos: z.array(ResumoAno) }))
    .describe('Todos os cenários, resumidos.'),
  simplificado: z.discriminatedUnion('ok', [
    z.object({
      ok: z.literal(true),
      resultado: z.object({
        preco: z.string(),
        precoSemArredondar: z.string(),
        memoria: z.array(PassoMemoria),
      }),
    }),
    z.object({ ok: z.literal(false), motivo: z.string() }),
  ]),
  fontes: z.array(Fonte),
});

export const Problema = z
  .object({
    type: z.string().describe('URN estável do tipo de problema.'),
    title: z.string(),
    status: z.number().int(),
    detail: z.string().optional(),
    instance: z.string().optional(),
    codigo: z.string().describe('Código estável, igual ao final do type.'),
    versao_motor: z.string(),
    versao_regras: z.string(),
    request_id: z.string().optional(),
    erros: z
      .array(z.object({ campo: z.string(), mensagem: z.string() }))
      .optional()
      .describe('Campos inválidos, quando houver.'),
  })
  .describe('Erro no formato RFC 9457 (application/problem+json).');

export const RespostaSimulacaoV1 = z.object({
  request_id: z.string(),
  versao_motor: z.string(),
  versao_regras: z.string(),
  cenario: Cenario,
  itens: z.array(
    z.discriminatedUnion('situacao', [
      z.object({
        idExterno: z.string().nullable(),
        situacao: z.literal('calculado'),
        resultado: ResultadoItemV1,
      }),
      z.object({
        idExterno: z.string().nullable(),
        situacao: z.literal('erro'),
        problema: Problema,
      }),
    ]),
  ),
});
export type RespostaSimulacaoV1 = z.infer<typeof RespostaSimulacaoV1>;

export const RegraV1 = z.object({
  chave: z.string(),
  id: z.string(),
  versao: z.number().int(),
  tributo: z.string(),
  descricao: z.string(),
  vigencia: z.object({ inicio: z.string(), fim: z.string().nullable() }),
  abrangencia: z.record(z.string(), z.array(z.string())),
  valor: z.record(z.string(), z.unknown()),
  fonte: z.object({ norma: z.string(), artigo: z.string(), url: z.string().optional() }),
  cenarios: z.array(z.string()),
  status: Status,
  conferencia: z.enum(['OK', 'CONFERIR']),
  observacao: z.string().nullable(),
});

export const ConsultaRegrasV1 = z
  .object({
    data: DataCalendario.optional().describe('Data de vigência (AAAA-MM-DD). Padrão: hoje.'),
    tributo: z.string().max(30).optional(),
    ncm: z
      .string()
      .regex(/^\d{4}\.?\d{2}\.?\d{2}$/)
      .optional()
      .describe('Mantém as regras gerais e as do NCM (por prefixo).'),
    cClassTrib: z
      .string()
      .regex(/^\d{6}$/)
      .optional(),
  })
  .strict();

export const RespostaRegrasV1 = z.object({
  request_id: z.string(),
  versao_motor: z.string(),
  versao_regras: z.string(),
  data: z.string(),
  regras: z.array(RegraV1),
});

export const RespostaCenariosV1 = z.object({
  request_id: z.string(),
  versao_motor: z.string(),
  versao_regras: z.string(),
  cenarios: z.array(z.object({ id: Cenario, descricao: z.string() })),
});

// ---------------------------------------------------------------- exemplos

/** Caso Coca-Cola (premissas ESTIMATIVA): distribuidora no Simples, DAS 8%. */
export const EXEMPLO_SIMULACAO: z.input<typeof SimulacaoV1> = {
  cenario: 'base',
  venda: {
    regime: 'SIMPLES_DAS',
    aliquotaDas: '0.08',
    despesasVariaveis: '0.06',
    margem: '0.25',
    baseMargem: 'PRECO_COM_TRIBUTO',
  },
  itens: [
    {
      idExterno: 'produto-123',
      descricao: 'Coca-Cola 600 ml',
      ncm: '2202.10.00',
      compra: {
        totalNota: '4.89',
        aliquotaIcms: '0.18',
        aliquotaIpi: '0.026',
        aliquotaPisCofins: '0.13',
        substituicaoTributaria: { mva: '0.42', aliquotaInterna: '0.18' },
      },
    },
  ],
};
