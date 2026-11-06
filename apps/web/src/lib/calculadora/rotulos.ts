import type { BaseMargem, Regime } from '@calculafiscal/motor-fiscal';

/** Nome de cada campo como aparece na tela, nas exportações e nos erros do lote. */
export const ROTULO_CAMPO: Readonly<Record<string, string>> = {
  descricao: 'Descrição',
  ncm: 'NCM',
  cClassTrib: 'Tratamento de CBS e IBS (cClassTrib)',
  cenario: 'Cenário',
  notaCompra: 'Total da nota por unidade (R$)',
  aliquotaIcms: 'ICMS do fornecedor (%)',
  aliquotaIpi: 'IPI (%)',
  aliquotaPisCofins: 'PIS e Cofins do fornecedor (%)',
  freteEDespesas: 'Frete e despesas da compra (R$)',
  temSt: 'Compra com ICMS-ST',
  mva: 'MVA (%)',
  aliquotaInterna: 'Alíquota interna do ICMS-ST (%)',
  regime: 'Regime',
  aliquotaDas: 'Alíquota efetiva do DAS (%)',
  parcelaCbsIbsNoDas: 'Parte do DAS que é CBS e IBS (%)',
  aliquotaIcmsSaida: 'ICMS na venda (%)',
  creditaIcmsEntrada: 'Aproveita o crédito do ICMS da compra',
  aliquotaPisCofinsSaida: 'PIS e Cofins na venda (%)',
  creditoPisCofinsEntrada: 'Crédito de PIS e Cofins sobre a compra (%)',
  despesasVariaveis: 'Despesas variáveis (%)',
  margem: 'Margem desejada (%)',
  baseMargem: 'Base da margem',
  impostoSimplificado: 'Imposto do cálculo simplificado (%)',
};

export const ROTULO_REGIME: Readonly<Record<Regime, string>> = {
  SIMPLES_DAS: 'Simples Nacional, CBS e IBS dentro do DAS',
  SIMPLES_REGULAR: 'Simples Nacional, CBS e IBS no regime regular',
  PRESUMIDO: 'Lucro Presumido',
  REAL: 'Lucro Real',
};

export const ROTULO_BASE_MARGEM: Readonly<Record<BaseMargem, string>> = {
  PRECO_COM_TRIBUTO: 'Sobre o preço com tributo (o que o cliente paga)',
  RECEITA_LIQUIDA: 'Sobre a receita líquida',
};
