/** Status de uma regra, do mais firme para o menos firme. */
export const ORDEM_STATUS = [
  'EM_VIGOR',
  'PUBLICADO_EFEITO_FUTURO',
  'PROPOSTO',
  'PENDENTE',
  'ESTIMATIVA',
] as const;
export type Status = (typeof ORDEM_STATUS)[number];

export type Regime = 'SIMPLES_DAS' | 'SIMPLES_REGULAR' | 'PRESUMIDO' | 'REAL';
export type BaseMargem = 'PRECO_COM_TRIBUTO' | 'RECEITA_LIQUIDA';

export interface ReferenciaRegra {
  readonly id: string;
  readonly versao: number;
  readonly status: Status;
}

/** Parâmetros de um ano, já resolvidos a partir das regras versionadas (pacote regras). */
export interface ParametrosAno {
  readonly ano: number;
  readonly cbs: string;
  readonly ibs: string;
  /** Falso em 2026: destaque de teste, compensado ou dispensado. */
  readonly cbsIbsComEfeito: boolean;
  /** Multiplica as alíquotas de ICMS (1 até 2028; 0,9 a 0,6 de 2029 a 2032; 0 em 2033). */
  readonly fatorIcms: string;
  readonly pisCofinsVigente: boolean;
  readonly ipiVigente: boolean;
  /** Imposto Seletivo do produto no ano (0 quando não incide). */
  readonly aliquotaIs: string;
  /**
   * Fração da CBS e do IBS reduzida pelo tratamento do produto (cClassTrib): '0.6' na redução de
   * 60%, '1' na alíquota zero. Ausente = tributação integral. Vale na compra e na venda.
   */
  readonly reducaoCbsIbs?: string;
  readonly regras: readonly ReferenciaRegra[];
}

/** Como o fornecedor vende ao comprador. Valores por unidade; percentuais em fração ("0.18"). */
export interface Fornecimento {
  /** Receita líquida do fornecedor, sem tributos. Premissa: constante ao longo dos anos. */
  readonly precoLiquido: string;
  /** ICMS próprio do fornecedor (nominal, antes do fator da transição). */
  readonly aliquotaIcms: string;
  /** IPI pela TIPI de 2026. */
  readonly aliquotaIpi: string;
  /** PIS e Cofins do fornecedor, por dentro (ex.: monofásico da indústria). */
  readonly aliquotaPisCofins: string;
  /** Substituição tributária cobrada do comprador. Nulo quando não há ST. */
  readonly substituicaoTributaria: {
    readonly mva: string;
    readonly aliquotaInterna: string;
  } | null;
  readonly freteEDespesas: string;
}

/** Como a empresa vende. */
export interface PerfilVenda {
  readonly regime: Regime;
  /** ICMS próprio na saída (nominal). Zero quando a ST encerrou a tributação. */
  readonly aliquotaIcmsSaida: string;
  readonly creditaIcmsEntrada: boolean;
  /** PIS e Cofins na saída. Zero no monofásico. */
  readonly aliquotaPisCofinsSaida: string;
  /** Alíquota de crédito de PIS e Cofins sobre a compra. Zero quando não há crédito. */
  readonly creditoPisCofinsEntrada: string;
  /** Simples Nacional: alíquota efetiva do DAS. */
  readonly aliquotaDas: string | null;
  /** Simples: fração do DAS que é CBS/IBS. A partilha por anexo ainda é PENDENTE. */
  readonly parcelaCbsIbsNoDas: string | null;
  readonly despesasVariaveis: string;
  readonly margem: string;
  readonly baseMargem: BaseMargem;
}
