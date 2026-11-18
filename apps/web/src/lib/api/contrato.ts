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
const ModoFornecedor = z.enum(['PRECO_LIQUIDO', 'PRECO_BRUTO']);
const Cenario = z.enum(CENARIOS);

/** Fração de 0 a 1 (inclusive 1): usada na proporção de insumos tributados de serviços. */
const FracaoAteUm = z
  .string()
  .regex(
    /^(0(\.\d{1,10})?|1(\.0{1,10})?)$/,
    'fração entre 0 e 1, como texto com ponto: "0.20" para 20% ou "1" para 100%',
  );

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
    modoFornecedor: ModoFornecedor.default('PRECO_LIQUIDO').describe(
      'PRECO_LIQUIDO repassa a extinção de PIS/Cofins e IPI; PRECO_BRUTO mantém o preço bruto.',
    ),
  })
  .strict();

export const CustosServicoV1 = z
  .object({
    custoDireto: Decimal.describe('Custo direto total por serviço hoje (2026), em reais.'),
    parcelaInsumosTributados: FracaoAteUm.default('0').describe(
      'Fração do custo direto vinda de insumos adquiridos de fornecedores no regime regular.',
    ),
    aliquotaPisCofinsInsumos: Fracao.default('0').describe(
      'PIS e Cofins embutido nos insumos tributados em 2026.',
    ),
    modoFornecedor: ModoFornecedor.default('PRECO_LIQUIDO'),
  })
  .strict();

const itemComuns = {
  idExterno: z
    .string()
    .min(1)
    .max(100)
    .optional()
    .describe('Identificador do item no sistema de origem; volta igual na resposta.'),
  descricao: z.string().max(120).default(''),
  cClassTrib: z
    .string()
    .regex(/^\d{6}$/)
    .default('000001')
    .describe(
      'Tratamento de CBS/IBS. 000001 = tributação integral (ex.: 200003 cesta básica; 200052 profissões regulamentadas 30%).',
    ),
};

export const ItemMercadoriaV1 = z
  .object({
    natureza: z.literal('MERCADORIA').default('MERCADORIA'),
    ...itemComuns,
    ncm: z
      .string()
      .regex(/^\d{4}\.?\d{2}\.?\d{2}$/)
      .optional()
      .describe('Necessário para o Imposto Seletivo e conferência de anexo.'),
    compra: CompraV1,
  })
  .strict();

export const ItemServicoV1 = z
  .object({
    natureza: z.literal('SERVICO'),
    ...itemComuns,
    nbs: z
      .string()
      .regex(/^\d\.?\d{4}\.?\d{2}\.?\d{2}$/)
      .optional()
      .describe('Código NBS de 9 dígitos do serviço.'),
    servico: CustosServicoV1,
  })
  .strict();

export const ItemV1 = z.union([ItemMercadoriaV1, ItemServicoV1]);

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
      aliquotaIssSaida: Fracao.default('0').describe(
        'Alíquota nominal do ISS municipal quando o item for serviço (2% a 5%).',
      ),
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
  isCompra: z.string().describe('Imposto Seletivo embutido no preço do fornecedor (sem crédito).'),
  icms: z.string(),
  iss: z.string().describe('ISS municipal da prestação de serviço (zero em mercadorias).'),
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
  comparativoFornecedor: z
    .object({
      modoAlternativo: ModoFornecedor,
      anos: z.array(ResumoAno),
    })
    .describe('Resumo da linha do tempo na premissa alternativa do fornecedor (bruto x líquido).'),
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

export const ConsultaClassificacaoV1 = z
  .object({
    ncm: z
      .string()
      .regex(/^\d{4}\.?\d{2}\.?\d{2}$/, 'NCM com 8 dígitos, ex.: 1006.30.21 ou 10063021')
      .optional()
      .describe('Código NCM de 8 dígitos da mercadoria (informe ncm ou nbs, nunca os dois).'),
    nbs: z
      .string()
      .regex(/^\d\.?\d{4}\.?\d{2}\.?\d{2}$/, 'NBS com 9 dígitos, ex.: 1.2201.12.00 ou 122011200')
      .optional()
      .describe('Código NBS de 9 dígitos do serviço (informe ncm ou nbs, nunca os dois).'),
    cClassTrib: z
      .string()
      .regex(/^\d{6}$/, 'cClassTrib com 6 dígitos, ex.: 200003')
      .optional()
      .describe(
        'Opcional: valida se o NCM ou a NBS informada consta no anexo oficial desta classificação.',
      ),
  })
  .strict();

const ItemAnexoV1 = z.object({
  prefixo: z.string(),
  numero: z.string().nullable(),
  descricao: z.string().nullable(),
});

const SugestaoClassificacaoV1 = z.object({
  cst: z.string(),
  cClassTrib: z.string(),
  descricao: z.string(),
  reducao: z
    .string()
    .describe('Fração reduzida: "1" = alíquota zero, "0.6" = 60%, "0" = integral.'),
  artigo: z.string(),
  anexo: z.string().nullable(),
  tpRbsn: z.number().int().describe('Tipo de Receita Bruta do Simples Nacional (NT 2026.005).'),
  confianca: z.enum(['ALTA', 'MEDIA', 'PADRAO']),
  motivo: z.string(),
  itensAnexo: z.array(ItemAnexoV1),
  suportadoNaCalculadora: z.boolean(),
  regraId: z.string().nullable(),
});

const EnquadramentoIsV1 = z.discriminatedUnion('incidencia', [
  z.object({
    incidencia: z.literal('NAO_INCIDE'),
    regraId: z.null(),
    aliquota2027: z.null(),
    mensagem: z.string(),
  }),
  z.object({
    incidencia: z.literal('INCIDE_MP_1399'),
    regraId: z.string(),
    aliquota2027: z.string(),
    descricao: z.string(),
    mensagem: z.string(),
  }),
  z.object({
    incidencia: z.literal('PREVISTO_LC_214'),
    regraId: z.null(),
    aliquota2027: z.null(),
    prefixo: z.string(),
    mensagem: z.string(),
  }),
]);

const CriticaAnexoV1 = z.discriminatedUnion('situacao', [
  z.object({
    situacao: z.literal('VINCULADO'),
    cClassTrib: z.string(),
    anexo: z.string(),
    artigo: z.string(),
    itens: z.array(ItemAnexoV1),
    mensagem: z.string(),
  }),
  z.object({
    situacao: z.literal('NAO_VINCULADO'),
    cClassTrib: z.string(),
    anexo: z.string(),
    artigo: z.string(),
    excecaoAplicada: z.string().nullable(),
    mensagem: z.string(),
  }),
  z.object({
    situacao: z.literal('SEM_ANEXO'),
    cClassTrib: z.string(),
    artigo: z.string().nullable(),
    criterio: z.enum([
      'TRIBUTACAO_INTEGRAL',
      'REGISTRO_ANVISA',
      'SAUDE_MENSTRUAL_NCM_9619',
      'PRODUTO_IN_NATURA',
      'NAO_CATALOGADO',
    ]),
    compativelComCodigo: z.boolean(),
    mensagem: z.string(),
  }),
]);

export const RespostaClassificacaoV1 = z.object({
  request_id: z.string(),
  versao_motor: z.string(),
  versao_regras: z.string(),
  tipo: z.enum(['NCM', 'NBS']),
  codigo: z.string(),
  sugestoes: z.array(SugestaoClassificacaoV1),
  impostoSeletivo: EnquadramentoIsV1.nullable(),
  validacao: CriticaAnexoV1.nullable(),
  fonte: z.object({
    organizacao: z.string(),
    versaoBaseDados: z.string(),
    dataBaseDados: z.string(),
    notaTecnicaSimples: z.string(),
    repositorios: z.array(z.string()),
  }),
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
